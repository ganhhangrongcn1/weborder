import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createHandler } from "../../supabase/functions/attendance-zalo-consent/handler.mjs";

const payload = { event: "user.revoke.consent", appId: "2442731166050783503", userId: "999000111", timestamp: 1670553442564 };
const key = "synthetic-test-key";
function request(data = payload, signature) {
  const content = Object.keys(data).sort().map((field) => typeof data[field] === "object" ? JSON.stringify(data[field]) : String(data[field])).join("");
  return new Request("https://example.invalid/webhook", { method: "POST", body: JSON.stringify(data),
    headers: { "x-zevent-signature": signature ?? createHash("sha256").update(content + key).digest("hex") } });
}
test("signed request persists before acknowledgement and retries share a key", async () => {
  const rows = [];
  const handler = createHandler({ apiKey: key, persist: async (row) => rows.push(row) });
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 200);
  assert.equal(rows[0].event_key, rows[1].event_key);
  assert.equal(rows[0].zalo_user_id, payload.userId);
});
test("rejects invalid signature, wrong app, unsupported event and invalid identity", async () => {
  const handler = createHandler({ apiKey: key, persist: async () => assert.fail("Must not persist") });
  assert.equal((await handler(request(payload, "0".repeat(64)))).status, 401);
  assert.equal((await handler(request({ ...payload, appId: "other" }))).status, 403);
  assert.equal((await handler(request({ ...payload, event: "other" }))).status, 400);
  assert.equal((await handler(request({ ...payload, userId: {} }))).status, 400);
});
test("fails closed without a secret or durable storage", async () => {
  assert.equal((await createHandler({ persist: async () => {} })(request())).status, 503);
  assert.equal((await createHandler({ apiKey: key, persist: async () => { throw new Error("database unavailable"); } })(request())).status, 503);
});
test("accepts documented optional timestamp and signs nested extra fields", async () => {
  const { timestamp, ...withoutTime } = payload;
  const handler = createHandler({ apiKey: key, persist: async () => {} });
  assert.equal((await handler(request({ ...withoutTime, extra: { test: true } }))).status, 200);
});
