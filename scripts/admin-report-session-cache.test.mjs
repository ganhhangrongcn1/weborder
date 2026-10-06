import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import createBoundary from "../src/services/supabase/sessionCacheBoundary.js";

const range = { dateFrom: "2026-10-01", dateTo: "2026-10-02", branchUuid: "branch-a" };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function harness(file, exportName, rpc) {
  const context = createContext({ Date });
  let session = { user: { id: "user-a" } }; let listener;
  const client = { rpc, auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; }
  } };
  const module = new SourceTextModule(await readFile(new URL("../src/services/" + file, import.meta.url), "utf8"), { context });
  await module.link((name) => name.includes("sessionCacheBoundary")
    ? new SyntheticModule(["default"], function () { this.setExport("default", createBoundary); }, { context })
    : new SyntheticModule(["getAdminSupabaseClient"], function () { this.setExport("getAdminSupabaseClient", async () => client); }, { context }));
  await module.evaluate();
  return { get: module.namespace[exportName], getBranches: module.namespace[exportName.replace("Rpc", "ForBranchesRpc")], change(event, id) { session = id ? { user: { id } } : null; listener(event, session); } };
}

for (const [file, name] of [["adminDashboardService.js", "getAdminDashboardSummaryRpc"], ["adminBusinessAnalyticsService.js", "getAdminBusinessAnalyticsRpc"]]) {
  test(file + ": cache stays separated by branch and is cleared on account changes", async () => {
    const calls = [];
    const h = await harness(file, name, async (_rpc, params) => { calls.push(params); return { data: [{}] }; });
    await h.get(range); await h.get(range);
    assert.equal(calls.length, 1);
    await h.get({ ...range, branchUuid: "branch-b" }); assert.equal(calls.length, 2);
    h.change("SIGNED_IN", "user-b"); await h.get(range); assert.equal(calls.length, 3);
    assert.equal(calls[2].p_branch_uuid, "branch-a");
  });

  test(file + ": old session response cannot clear the new request or populate its cache", async () => {
    const pending = [];
    const h = await harness(file, name, () => new Promise((resolve) => pending.push(resolve)));
    const old = h.get(range); await tick();
    h.change("SIGNED_OUT", null); h.change("SIGNED_IN", "user-b");
    const fresh = h.get(range); await tick();
    pending[0]({ data: [{}] }); assert.equal(await old, null);
    const joined = h.get(range); await tick(); assert.equal(pending.length, 2);
    pending[1]({ data: [{}] });
    assert.ok(await fresh); assert.ok(await joined);
    await h.get(range); assert.equal(pending.length, 2);
  });

  test(file + ": errors remain errors and cleanup allows another attempt", async () => {
    let calls = 0;
    const error = { code: "42501" };
    const h = await harness(file, name, async () => { calls++; return calls === 1 ? { error } : { data: [{}] }; });
    await assert.rejects(h.get(range), (actual) => actual === error);
    assert.ok(await h.get(range)); assert.equal(calls, 2);
  });

  test(file + ": branch aggregation discards an earlier completed result after a session change", async () => {
    const pending = [];
    const h = await harness(file, name, () => new Promise((resolve) => pending.push(resolve)));
    const result = h.getBranches(range, [{ value: "a", label: "A" }, { value: "b", label: "B" }]);
    await tick(); assert.equal(pending.length, 2);
    pending[0]({ data: [{}] }); await tick();
    h.change("SIGNED_OUT", null);
    pending[1]({ data: [{}] });
    assert.equal(await result, null);
  });
}
