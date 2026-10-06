import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import createDiagnosticFetch from "../src/services/supabase/supabaseDiagnosticFetch.js";
import { clearSupabaseDiagnostics, getSupabaseDiagnostics, recordSupabaseRequest, recordSupabaseSdkError, getSafeEndpoint } from "../src/services/supabase/supabaseDiagnostics.js";

test("real SDK preserves authorization headers and RPC error handling with diagnostic fetch", async () => {
  clearSupabaseDiagnostics();
  let calls = 0;
  const client = createClient("https://fixture.supabase.co", "fixture-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createDiagnosticFetch({ baseUrl: "https://fixture.supabase.co", scope: "admin", fetchImpl: async (input, init) => {
      calls++;
      assert.equal(new Headers(init.headers).get("apikey"), "fixture-anon-key");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-anon-key");
      assert.ok(String(input).includes("/rpc/get_admin_dashboard_summary"));
      return new Response(JSON.stringify({ code: "42501", message: "private fixture", details: "private detail", hint: "private hint" }), { status: 403, headers: { "content-type": "application/json" } });
    } }) }
  });
  const result = await client.rpc("get_admin_dashboard_summary", {});
  assert.equal(result.error.code, "42501");
  assert.equal(result.error.message, "private fixture");
  assert.equal(calls, 1);
  assert.equal(getSupabaseDiagnostics().errors, 1);
  assert.ok(!JSON.stringify(getSupabaseDiagnostics()).includes("private"));
});

test("fetch preserves input, options, response and readable body, without an extra request", async () => {
  const controller = new globalThis.AbortController();
  const input = "https://fixture.supabase.co/rest/v1/orders?phone=eq.0900000000";
  const init = { method: "POST", body: "private fixture", signal: controller.signal, headers: { Authorization: "secret fixture" } };
  const response = new globalThis.Response('{"id":"fixture"}', { status: 201 });
  let calls = 0;
  const wrapper = createDiagnosticFetch({ baseUrl: "https://fixture.supabase.co", fetchImpl: async (url, options) => {
    calls++; assert.equal(url, input); assert.equal(options, init); return response;
  }, record() { throw new Error("observer failure"); } });
  assert.equal(await wrapper(input, init), response);
  assert.equal(await response.text(), '{"id":"fixture"}');
  assert.equal(calls, 1);
});

test("fetch preserves original errors and aborted requests are separate from failures", async () => {
  clearSupabaseDiagnostics();
  const error = new Error("fixture token must never be retained");
  error.name = "AbortError";
  const wrapper = createDiagnosticFetch({ baseUrl: "https://fixture.supabase.co", fetchImpl: async () => { throw error; } });
  await assert.rejects(wrapper("https://fixture.supabase.co/rest/v1/orders"), (actual) => actual === error);
  const snapshot = getSupabaseDiagnostics();
  assert.equal(snapshot.aborted, 1);
  assert.equal(snapshot.errors, 0);
  assert.ok(!JSON.stringify(snapshot).includes("token"));
  const unusual = Object.defineProperty({}, "name", { get() { throw new Error("getter"); } });
  await assert.rejects(createDiagnosticFetch({ fetchImpl: async () => { throw unusual; } })("bad"), (actual) => actual === unusual);
});

test("privacy allowlist drops params, external origins, auth paths, raw errors and invalid request IDs", async () => {
  clearSupabaseDiagnostics();
  const baseUrl = "https://fixture.supabase.co";
  assert.equal(getSafeEndpoint(baseUrl + "/auth/v1/token?email=fixture@example.invalid", baseUrl), "auth");
  assert.equal(getSafeEndpoint("https://other.invalid/rest/v1/orders", baseUrl), "");
  assert.equal(getSafeEndpoint(baseUrl + "/rest/v1/rpc/phone_0900000000", baseUrl), "rpc/other");
  recordSupabaseRequest({ scope: "admin", endpoint: "table/orders", method: "GET", status: 500, durationMs: 30, requestId: "fixture@example.invalid" });
  recordSupabaseSdkError("get_customer_popular_products", { code: "23502", message: "private fixture", details: "phone" });
  recordSupabaseRequest({ endpoint: "rpc/phone_0900000000", status: 500 });
  const snapshot = getSupabaseDiagnostics();
  assert.equal(snapshot.requests, 1);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.entries.find((entry) => entry.kind === "sdk_error").code, "23502");
  assert.ok(!/private|phone|@|0900000000/.test(JSON.stringify(snapshot)));
});

test("bounded 15 minute window, reset and per endpoint p95 require sufficient completed samples", () => {
  clearSupabaseDiagnostics();
  const at = Date.now();
  for (let i = 1; i <= 250; i++) recordSupabaseRequest({ endpoint: "rpc/get_admin_dashboard_summary", scope: "admin", status: 200, durationMs: i }, at);
  const snapshot = getSupabaseDiagnostics(at);
  assert.equal(snapshot.requests, 200);
  assert.equal(snapshot.groups[0].p95HeadersMs, 240);
  assert.equal(getSupabaseDiagnostics(at + 900001).requests, 0);
  recordSupabaseRequest({ endpoint: "table/orders", status: 200 }, at);
  assert.equal(getSupabaseDiagnostics(at).groups[0].p95HeadersMs, null);
  clearSupabaseDiagnostics();
  assert.equal(getSupabaseDiagnostics(at).entries.length, 0);
});

test("HTTP error response is returned unchanged and its body is not consumed", async () => {
  clearSupabaseDiagnostics();
  const response = new globalThis.Response('{"code":"42703","details":"private fixture"}', { status: 400 });
  const wrapper = createDiagnosticFetch({ baseUrl: "https://fixture.supabase.co", fetchImpl: async () => response });
  assert.equal(await wrapper("https://fixture.supabase.co/rest/v1/orders"), response);
  assert.equal(response.bodyUsed, false);
  assert.equal(getSupabaseDiagnostics().errors, 1);
});
