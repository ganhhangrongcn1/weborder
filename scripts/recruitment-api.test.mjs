/* global Request, Response */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateRecruitment } from "../supabase/functions/_shared/recruitmentSchema.js";
import { createRecruitmentHandler } from "../supabase/functions/recruitment-api/handler.js";
import { drainRecruitmentNotifications } from "../supabase/functions/recruitment-api/notifications.js";
import { DEFAULT_RECRUITMENT_CONFIG } from "../supabase/functions/_shared/recruitmentForm.js";
import { application } from "./recruitment-fixture.mjs";

const request = (payload, headers = {}, method = "POST") => new Request("https://isolated.invalid", {
  method, headers: { "content-type": "application/json", origin: "https://ganhhangrong.vn", ...headers },
  ...(method === "POST" ? { body: typeof payload === "string" ? payload : JSON.stringify(payload) } : {})
});
const payload = (data = application) => ({ action: "submit", requestId: randomUUID(), application: data, formVersion: 1 });
function setup(overrides = {}, rpcResult = { data: { applicationId: randomUUID() }, error: null }) {
  let calls = 0;
  const envValues = { RECRUITMENT_INTAKE_ENABLED: "true", RECRUITMENT_HASH_SECRET: "isolated-test-secret", ...overrides };
  const handle = createRecruitmentHandler({
    env: (key) => envValues[key] || "",
    getClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { config: DEFAULT_RECRUITMENT_CONFIG, revision: 1 } }) }) }) }),
      rpc: async (name, args) => {
      calls++;
      assert.equal(name, "submit_recruitment_application");
      assert.match(args.p_ip_hash, /^[a-f0-9]{64}$/);
      assert.equal(args.p_application.website, undefined);
      return rpcResult;
    } }),
    fetchImpl: () => { throw new Error("No external notification during submission"); }
  });
  return { handle, calls: () => calls };
}
test("normalization preserves all 13 answers and does not score gender", () => {
  const result = validateRecruitment({ ...application, phone: "+84 900 000 000" }, "2026-10-14");
  assert.equal(result.valid, true);
  assert.equal(result.data.phone, "0900000000");
  assert.equal(result.data.gender, "LGBT");
  assert.equal(Object.keys(result.data).length, 14); // 13 answers + educationOther
});
for (const [name, change, field] of [
  ["missing required school", { school: " " }, "school"],
  ["invalid calendar date", { birthDate: "2001-02-29" }, "birthDate"],
  ["future date", { birthDate: "2090-01-01" }, "birthDate"],
  ["unknown branch", { branch: "not a branch" }, "branch"],
  ["unknown gender", { gender: "other" }, "gender"],
  ["empty shift", { shifts: [] }, "shifts"],
  ["forged work type", { workTypes: ["forged"] }, "workTypes"],
  ["missing education other", { educationOther: "" }, "educationOther"],
  ["oversized textarea", { impression: "x".repeat(2001) }, "impression"],
  ["invalid phone", { phone: "1234" }, "phone"]
]) test(name, async () => {
  const { handle, calls } = setup();
  const response = await handle(request(payload({ ...application, ...change })));
  assert.equal(response.status, 400);
  assert.ok((await response.json()).fields[field]);
  assert.equal(calls(), 0);
});
test("save confirmed => receipt only; submit never calls n8n", async () => {
  const { handle, calls } = setup();
  const response = await handle(request(payload()));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(calls(), 1);
});
for (const [name, result, status] of [
  ["database error cannot report success", { error: { message: "db unavailable" } }, 503],
  ["empty database acknowledgement cannot report success", { data: {} }, 503],
  ["rate limit", { error: { message: "RATE_LIMITED" } }, 429],
  ["idempotency conflict", { error: { message: "REQUEST_CONFLICT" } }, 409]
]) test(name, async () => {
  const { handle } = setup({}, result);
  const response = await handle(request(payload()));
  assert.equal(response.status, status);
  assert.equal((await response.json()).ok, false);
});
test("intake disabled, honeypot, unauthorized dispatch, origin, oversized and malformed body reject before DB", async () => {
  const { handle, calls } = setup();
  const inputs = [
    [request(payload({ ...application, website: "spam" })), 400],
    [request({ action: "retry_notifications" }), 401],
    [request(payload(), { origin: "https://evil.invalid" }), 403],
    [request("x".repeat(32769)), 413], [request("{"), 400],
    [request(payload(), { "content-type": "text/plain" }), 415]
  ];
  for (const [req, status] of inputs) assert.equal((await handle(req)).status, status);
  assert.equal(calls(), 0);
  assert.equal((await setup({ RECRUITMENT_INTAKE_ENABLED: "false" }).handle(request(payload()))).status, 503);
});
test("public CORS preflight does not require login", async () => {
  const response = await setup().handle(request(null, {}, "OPTIONS"));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ganhhangrong.vn");
});

test("background scheduling failure cannot revoke a committed application receipt", async () => {
  const handle = createRecruitmentHandler({
    env: (key) => ({ RECRUITMENT_INTAKE_ENABLED: "true", RECRUITMENT_HASH_SECRET: "test" })[key] || "",
    getClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { config: DEFAULT_RECRUITMENT_CONFIG, revision: 1 } }) }) }) }),
      rpc: async () => ({ data: { applicationId: "isolated-committed" } })
    }),
    onSaved: () => { throw new Error("scheduler unavailable"); }
  });
  const result = await (await handle(request(payload()))).json();
  assert.equal(result.ok, true);
  assert.equal(result.applicationId, "isolated-committed");
});
test("notification is off by default and does not claim old rows", async () => {
  const result = await drainRecruitmentNotifications({ client: {}, env: () => "" });
  assert.equal(result.enabled, false);
});
for (const [name, fetchImpl, expectedStatus] of [
  ["webhook unavailable preserves failed pending record", async () => { throw new Error("offline"); }, "uncertain"],
  ["HTTP 200 without matching durable acknowledgement is not sent", async () => Response.json({ ok: true }), "uncertain"],
  ["matching acknowledgement marks only leased record sent", async () => Response.json({ ok: true, application_id: "isolated-id" }), "sent"]
]) test(name, async () => {
  let patch;
  const filters = [];
  const chain = { eq: (key, value) => { filters.push([key, value]); return chain; }, then: (resolve) => resolve({ error: null }) };
  const client = {
    rpc: async () => ({ data: [{ id: "isolated-id", application, submitted_at: "2026-10-14T00:00:00Z", notification_attempts: 1, notification_lease: "lease" }] }),
    from: () => ({ update: (value) => { patch = value; return chain; } })
  };
  const values = { RECRUITMENT_NOTIFICATIONS_ENABLED: "true", RECRUITMENT_N8N_WEBHOOK_URL: "https://isolated.invalid", RECRUITMENT_N8N_WEBHOOK_SECRET: "test" };
  await drainRecruitmentNotifications({ client, env: (key) => values[key], fetchImpl });
  assert.equal(patch.notification_status, expectedStatus);
  assert.deepEqual(filters, [["id", "isolated-id"], ["notification_lease", "lease"]]);
});
