import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const directory = new URL("../.tmp/pay2s-tests/", import.meta.url);
await mkdir(directory, { recursive: true });
const output = await build({ entryPoints: ["supabase/functions/pay2s-payment-webhook/index.ts"],
  bundle: true, write: false, format: "esm", platform: "node",
  plugins: [{ name: "mock-client", setup(builder) {
    builder.onResolve({ filter: /^npm:@supabase/ }, () => ({ path: "supabase", namespace: "mock" }));
    builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const createClient = () => globalThis.pay2sTestClient;" }));
  } }]
});
await writeFile(new URL("webhook.mjs", directory), output.outputFiles[0].contents);
let handler;
const env = { PAY2S_WEBHOOK_TOKEN: "test-webhook-token", SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-server-key" };
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } };
await import(new URL("webhook.mjs", directory));
const transaction = { id: 10, gateway: "ACB", accountNumber: "00123456789", transferType: "IN", transferAmount: 25000,
  transactionDate: "2026-11-02 10:00:00", content: "TT GHR-12345" };
const request = (body = { transactions: [transaction] }, token = "test-webhook-token") => new globalThis.Request("https://example.invalid", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
});

test("Pay2S endpoint validates token and whole batch before touching database", async () => {
  globalThis.pay2sTestClient = { rpc: () => { throw new Error("Database must not be called"); } };
  assert.equal((await handler(request(undefined, "wrong"))).status, 401);
  assert.equal((await handler(request({ transactions: [] }))).status, 400);
  assert.equal((await handler(request({ transactions: [transaction, { ...transaction, id: "" }] }))).status, 400);
  const saved = env.PAY2S_WEBHOOK_TOKEN; delete env.PAY2S_WEBHOOK_TOKEN;
  assert.equal((await handler(request())).status, 503);
  env.PAY2S_WEBHOOK_TOKEN = saved;
});

test("database failure is retryable; completed duplicates and ignored events are ACKed", async () => {
  globalThis.pay2sTestClient = { rpc: async () => ({ error: new Error("DB unavailable") }) };
  assert.equal((await handler(request())).status, 500);
  globalThis.pay2sTestClient = { rpc: async () => ({ data: { reason: "processed", complete: true } }) };
  assert.equal((await (await handler(request())).json()).success, true);
  globalThis.pay2sTestClient = { rpc: async () => ({ data: { reason: "transaction_conflict" } }) };
  assert.equal((await handler(request())).status, 500);
});

test("POS payments finish receipt after durable settlement without printing a second bill", async () => {
  let updates = 0;
  globalThis.pay2sTestClient = {
    rpc: async () => ({ data: { reason: "settled", complete: false, session: { id: "test-session", source: "pos" } } }),
    from: (table) => {
      assert.equal(table, "pay2s_webhook_receipts");
      return { update: () => ({ eq: async () => { updates += 1; return { error: null }; } }) };
    }
  };
  assert.equal((await handler(request())).status, 200);
  assert.equal(updates, 1);
});

test("SePay still settles its own POS sessions and ignores Pay2S sessions", async () => {
  const sepayBuild = await build({ entryPoints: ["supabase/functions/sepay-pos-webhook/index.ts"],
    bundle: true, write: false, format: "esm", platform: "node",
    plugins: [{ name: "mock-sepay-client", setup(builder) {
      builder.onResolve({ filter: /^npm:@supabase/ }, () => ({ path: "supabase", namespace: "mock" }));
      builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const createClient = () => globalThis.pay2sTestClient;" }));
    } }]
  });
  await writeFile(new URL("sepay.mjs", directory), sepayBuild.outputFiles[0].contents);
  await import(new URL("sepay.mjs", directory));
  const sepayHandler = handler;
  const session = { id: "session", payment_reference: "POS-20261102-123456", provider: "sepay", source: "pos",
    status: "pending_payment", amount_expected: 25000, expires_at: new Date(Date.now() + 600000).toISOString() };
  let paymentUpdates = 0;
  globalThis.pay2sTestClient = { from(table) {
    const query = { insert: async () => ({ error: null }), update(value) { this.patch = value; return this; },
      select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, in() { return this; },
      async maybeSingle() {
        assert.equal(table, "pos_payment_sessions");
        if (this.patch) { paymentUpdates += 1; return { data: { ...session, ...this.patch }, error: null }; }
        return { data: session, error: null };
      }
    }; return query;
  } };
  const call = () => sepayHandler(new globalThis.Request("https://example.invalid", { method: "POST", body: JSON.stringify({
    ...transaction, content: "TT POS-20261102-123456", transferType: "in"
  }) }));
  const ownResponse = await (await call()).json();
  assert.equal(ownResponse.success, true);
  assert.equal(ownResponse.updated, true);
  assert.equal(paymentUpdates, 1);
  session.provider = "pay2s";
  const guarded = await (await call()).json();
  assert.equal(guarded.reason, "pay2s_session");
  assert.equal(paymentUpdates, 1);
});
