/* global Request, structuredClone */
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RECRUITMENT_CONFIG, validateFormConfig, validateConfiguredApplication } from "../supabase/functions/_shared/recruitmentForm.js";
import { createRecruitmentHandler } from "../supabase/functions/recruitment-api/handler.js";
import { handleRecruitmentAdmin } from "../supabase/functions/recruitment-api/admin.js";
import { adminPathToState, adminNavToPath } from "../src/app/routeState.js";
import { filterAdminNavigationByAccess, getAdminModuleAccessPolicy } from "../src/pages/admin/adminModuleAccessPolicy.js";
import { navGroups } from "../src/pages/admin/adminNavigation.js";
import { application } from "./recruitment-fixture.mjs";

const copy = () => structuredClone(DEFAULT_RECRUITMENT_CONFIG);
test("branches can pause and reopen without renaming branches or changing historical config", () => {
  const historical = copy();
  const config = copy();
  const branch = config.questions.find((q) => q.id === "branch");
  const paused = branch.options.find((value) => value.includes("Lê Hồng Phong"));
  branch.options = branch.options.filter((value) => value !== paused);
  const validated = validateFormConfig(config);
  assert.equal(validated.questions.find((q) => q.id === "branch").options.length, 3);
  assert.equal(validateConfiguredApplication({ ...application, branch: paused }, validated, "2026-10-29").valid, false);
  assert.ok(validateConfiguredApplication({ ...application, branch: paused }, validated, "2026-10-29").errors.branch);
  assert.equal(validateConfiguredApplication(application, validated, "2026-10-29").valid, true);
  assert.equal(historical.questions.find((q) => q.id === "branch").options.length, 4);
  branch.options.push(paused);
  assert.deepEqual(validateFormConfig(config).questions.find((q) => q.id === "branch").options,
    historical.questions.find((q) => q.id === "branch").options);
  branch.options = [];
  assert.throws(() => validateFormConfig(config));
});

test("server rejects paused branch and stale forms before saving or notifying", async () => {
  const config = copy();
  const branch = config.questions.find((q) => q.id === "branch");
  const paused = branch.options.find((value) => value.includes("Lê Hồng Phong"));
  branch.options = branch.options.filter((value) => value !== paused);
  let writes = 0;
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { config, revision: 5 } }) }) }) }),
    rpc: async () => { writes++; throw new Error("Must not save a paused/stale form"); }
  };
  const handle = createRecruitmentHandler({ getClient: () => client,
    env: (key) => key === "RECRUITMENT_INTAKE_ENABLED" ? "true" : "" });
  for (const [formVersion, expected] of [[4, 409], [5, 400]]) {
    const response = await handle(new Request("https://isolated.invalid", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        action: "submit", requestId: "11111111-1111-4111-8111-111111111111", formVersion,
        application: { ...application, branch: paused }
      })
    }));
    assert.equal(response.status, expected);
  }
  assert.equal(writes, 0);
});
test("HR menu route maps and stays hidden for branch operators", () => {
  assert.equal(adminPathToState("/admin/recruitment").section, "recruitment");
  const item = navGroups.find((group) => group.id === "people-supervision").items.find((q) => q.id === "recruitment-main");
  assert.equal(adminNavToPath(item), "/admin/recruitment");
  const policy = getAdminModuleAccessPolicy({ isSupabaseAdminMode: true, adminProfile: { role: "admin", branch_uuid: "branch" } });
  assert.equal(filterAdminNavigationByAccess(navGroups, policy).flatMap((group) => group.items).some((q) => q.id === item.id), false);
});
test("question edits preserve core IDs/types, branch classification and required contact", () => {
  for (const id of ["fullName", "phone", "branch"]) {
    const config = copy(); config.questions.find((q) => q.id === id).required = false;
    assert.throws(() => validateFormConfig(config));
  }
  const wrongBranch = copy(); wrongBranch.questions.find((q) => q.id === "branch").options = ["invented"];
  assert.throws(() => validateFormConfig(wrongBranch));
  const changedType = copy(); changedType.questions[0].type = "textarea";
  assert.throws(() => validateFormConfig(changedType));
  const removed = copy(); removed.questions.pop(); assert.throws(() => validateFormConfig(removed));
  const reserved = copy(); reserved.questions.push({ id: "__proto__", label: "evil", active: true, type: "text" });
  assert.throws(() => validateFormConfig(reserved));
});
test("new questions are server validated; hidden/optional values are not stored", () => {
  const config = copy();
  config.questions.find((q) => q.id === "gender").active = false;
  config.questions.find((q) => q.id === "school").required = false;
  config.questions.push({ id: "extra_availability", label: "Ngày bắt đầu", active: true, required: true, type: "text" });
  const validated = validateFormConfig(config);
  assert.equal(validateConfiguredApplication(application, validated, "2026-10-14").valid, false);
  const result = validateConfiguredApplication({ ...application, school: "", extra_availability: "Ngày mai", forged: "ignore" }, validated, "2026-10-14");
  assert.equal(result.valid, true);
  assert.equal(result.data.gender, undefined);
  assert.equal(result.data.forged, undefined);
  assert.equal(result.data.school, "");
});

function authClient(profile = null, user = null) {
  return { auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }) };
}
for (const [name, profile, user, token] of [
  ["anonymous", null, null, ""], ["forged JWT", null, null, "fake"],
  ["staff", { role: "staff", status: "active" }, { id: "u" }, "valid"],
  ["branch admin", { role: "admin", status: "active", branch_uuid: "branch" }, { id: "u" }, "valid"],
  ["disabled admin", { role: "admin", status: "disabled" }, { id: "u" }, "valid"]
]) test(`${name} cannot read, edit or retrieve applicant detail`, async () => {
  const handle = createRecruitmentHandler({ getClient: () => authClient(profile, user), env: () => "" });
  for (const action of ["admin_form", "admin_save_form", "admin_detail", "admin_dashboard"]) {
    const response = await handle(new Request("https://isolated.invalid", {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action })
    }));
    assert.equal(response.status, 403);
  }
});
test("admin filters/pagination apply to server list AND complete aggregate; summary omits long answers", async () => {
  const calls = [];
  const chain = {};
  for (const method of ["select", "order", "eq", "gte", "lt", "range"]) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.then = (resolve) => resolve({ data: [{ id: "isolated", application, submitted_at: "2026-10-14T00:00:00Z", notification_status: "pending" }], count: 100 });
  const client = { from: () => chain, rpc: async (name, args) => { calls.push([name, args]); return { data: { total: 100 } }; } };
  const result = await handleRecruitmentAdmin({ action: "admin_dashboard", branch: application.branch, from: "2026-10-14", to: "2026-10-14", page: 2 }, client);
  assert.equal(result.count, 100);
  assert.equal(result.rows[0].selfDescription, undefined);
  assert.ok(calls.some((c) => c[0] === "range" && c[1] === 50 && c[2] === 74));
  const summary = calls.find((c) => c[0] === "recruitment_summary")[1];
  assert.equal(summary.p_branch, application.branch);
  assert.equal(summary.p_from, "2026-10-13T17:00:00.000Z");
  assert.equal(summary.p_to, "2026-10-14T17:00:00.000Z");
  await assert.rejects(handleRecruitmentAdmin({ action: "admin_dashboard", from: "2026-02-30" }, client), /Ngày/);
});
test("config save uses revision compare-and-swap and reports conflict", async () => {
  const calls = [];
  const chain = {};
  for (const method of ["update", "eq", "select"]) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.maybeSingle = async () => ({ data: null });
  await assert.rejects(handleRecruitmentAdmin({ action: "admin_save_form", config: copy(), revision: 1 }, { from: () => chain }), /phiên khác/);
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "revision" && c[2] === 1));
});

test("webhook delivery gate requires shared secret and database lease", async () => {
  let calls = 0;
  const handle = createRecruitmentHandler({
    env: (key) => key === "RECRUITMENT_N8N_WEBHOOK_SECRET" ? "isolated-secret" : "",
    getClient: () => ({ rpc: async (name, args) => {
      calls++; assert.equal(name, "authorize_recruitment_delivery");
      assert.equal(args.p_id, "11111111-1111-4111-8111-111111111111");
      return { data: { allowed: true, sent: false, row: { id: args.p_id, application, submitted_at: "2026-10-14T00:00:00Z" } } };
    } })
  });
  const payload = { action: "claim_delivery", applicationId: "11111111-1111-4111-8111-111111111111", lease: "22222222-2222-4222-8222-222222222222" };
  const req = (secret) => new Request("https://isolated.invalid", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body: JSON.stringify(payload) });
  assert.equal((await handle(req("wrong"))).status, 401);
  assert.equal(calls, 0);
  const result = await (await handle(req("isolated-secret"))).json();
  assert.equal(result.allowed, true);
  assert.ok(result.message.includes(application.fullName));
  assert.equal(calls, 1);
});
