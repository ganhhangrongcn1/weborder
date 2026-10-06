import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import createSessionCacheBoundary from "../src/services/supabase/sessionCacheBoundary.js";

async function harness(rpc) {
  const context = createContext({ console: { warn() {} }, Date });
  const module = new SourceTextModule(await readFile(new URL("../src/services/adminCrmAnalyticsService.js", import.meta.url), "utf8"), { context });
  let session = { user: { id: "fixture" } };
  let listener;
  const client = { rpc, auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: (callback) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; } } };
  await module.link((specifier) => specifier.includes("sessionCacheBoundary") ? new SyntheticModule(["default"], function () { this.setExport("default", createSessionCacheBoundary); }, { context }) : new SyntheticModule(["getSupabaseRuntimeClient", "initSupabaseRuntimeClient"], function () {
    this.setExport("getSupabaseRuntimeClient", () => client);
    this.setExport("initSupabaseRuntimeClient", async () => client);
  }, { context }));
  await module.evaluate();
  const get = module.namespace.getAdminCrmAnalyticsRpc;
  get.changeSession = (event, id) => { session = id ? { user: { id } } : null; listener(event, session); };
  return get;
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
  await new Promise((resolve) => setTimeout(resolve, 0));
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
  await new Promise((done) => setTimeout(done, 0));
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
  await new Promise((resolve) => setTimeout(resolve, 0));
  pending[0]({ data: [{ summary: { total_customers: 10 } }] });
  await old;
  const joined = get();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pending.length, 2);
  pending[1]({ data: [{ summary: { total_customers: 20 } }] });
  assert.equal((await joined).summary.totalCustomers, 20);
  await fresh;
});

test("CRM account changes clear cached results and reload for the new session", async () => {
  let calls = 0;
  const get = await harness(async () => ({ data: [{ summary: { total_customers: ++calls } }] }));
  assert.equal((await get()).summary.totalCustomers, 1);
  get.changeSession("SIGNED_IN", "other-fixture");
  assert.equal((await get()).summary.totalCustomers, 2);
  assert.equal(calls, 2);
});

test("CRM response after logout is discarded, without repopulating the cache", async () => {
  const pending = [];
  const get = await harness(() => new Promise((resolve) => pending.push(resolve)));
  const old = get(); await new Promise((resolve) => setTimeout(resolve, 0));
  get.changeSession("SIGNED_OUT", null);
  pending[0]({ data: [{ summary: { total_customers: 99 } }] });
  assert.equal(await old, null);
  get.changeSession("SIGNED_IN", "other-fixture");
  const fresh = get(); await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pending.length, 2);
  pending[1]({ data: [{ summary: { total_customers: 2 } }] });
  assert.equal((await fresh).summary.totalCustomers, 2);
});
