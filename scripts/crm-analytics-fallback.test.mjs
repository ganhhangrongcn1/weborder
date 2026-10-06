import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

async function harness(rpc) {
  const context = createContext({ console: { warn() {} }, Date });
  const module = new SourceTextModule(await readFile(new URL("../src/services/adminCrmAnalyticsService.js", import.meta.url), "utf8"), { context });
  await module.link(() => new SyntheticModule(["getSupabaseRuntimeClient", "initSupabaseRuntimeClient"], function () {
    this.setExport("getSupabaseRuntimeClient", () => ({ rpc }));
    this.setExport("initSupabaseRuntimeClient", async () => ({ rpc }));
  }, { context }));
  await module.evaluate();
  return module.namespace.getAdminCrmAnalyticsRpc;
}

test("only a missing cached RPC invokes the legacy fallback", async () => {
  for (const code of ["42883", "PGRST202"]) {
    const calls = [];
    const get = await harness(async (name) => {
      calls.push(name);
      return calls.length === 1 ? { error: { code, message: "Could not find the function public.get_admin_crm_analytics_cached(p_force_refresh)" } } : { data: [{ summary: { total_customers: 7 } }] };
    });
    assert.equal((await get()).summary.totalCustomers, 7);
    assert.deepEqual(calls, ["get_admin_crm_analytics_cached", "get_admin_crm_analytics"]);
  }
});

test("missing columns, permissions, cancellation and unrelated missing objects do not start a second heavy RPC", async () => {
  for (const code of ["42703", "42501", "57014", "42P01", "42883", "PGRST202"]) {
    let calls = 0;
    const get = await harness(async () => { calls++; return { error: { code, message: "column fixture does not exist" } }; });
    assert.equal(await get(), null);
    assert.equal(calls, 1);
  }
});

test("late older refresh cannot replace the newest cached result", async () => {
  const pending = [];
  const get = await harness(() => new Promise((resolve) => pending.push(resolve)));
  const old = get({ force: true }); const fresh = get({ force: true });
  pending[1]({ data: [{ summary: { total_customers: 20 } }] });
  await fresh;
  pending[0]({ data: [{ summary: { total_customers: 10 } }] });
  assert.equal((await old).summary.totalCustomers, 10);
  assert.equal((await get()).summary.totalCustomers, 20);
});

test("successful reads retain the existing one minute cache and concurrent read guard", async () => {
  let calls = 0; let resolve;
  const get = await harness(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const first = get(); const second = get();
  assert.equal(calls, 1);
  resolve({ data: [{ summary: { total_customers: 3 } }] });
  await Promise.all([first, second]);
  assert.equal((await get()).summary.totalCustomers, 3);
  assert.equal(calls, 1);
});

test("finishing an older request does not clear the newer in-flight guard", async () => {
  const pending = [];
  const get = await harness(() => new Promise((resolve) => pending.push(resolve)));
  const old = get({ force: true }); const fresh = get({ force: true });
  pending[0]({ data: [{ summary: { total_customers: 10 } }] });
  await old;
  const joined = get();
  assert.equal(pending.length, 2);
  pending[1]({ data: [{ summary: { total_customers: 20 } }] });
  assert.equal((await joined).summary.totalCustomers, 20);
  await fresh;
});
