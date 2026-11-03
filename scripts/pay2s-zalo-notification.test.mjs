import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const directory = new URL("../.tmp/pay2s-zalo-tests/", import.meta.url);
await mkdir(directory, { recursive: true });
let handler;
globalThis.Deno = { env: { get: (key) => ({ PAY2S_WEBHOOK_TOKEN: "test-token", SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-key" })[key] }, serve: (value) => { handler = value; } };
const output = await build({ entryPoints: ["supabase/functions/pay2s-payment-webhook/index.ts"], bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "isolated-payment", setup(builder) {
    builder.onResolve({ filter: /^npm:@supabase/ }, () => ({ path: "client", namespace: "mock" }));
    builder.onResolve({ filter: /bankTransferSettlement\.ts$/ }, () => ({ path: "settlement", namespace: "mock" }));
    builder.onResolve({ filter: /posPaidOrderLoyalty\.ts$/ }, () => ({ path: "loyalty", namespace: "mock" }));
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: path === "client"
      ? "export const createClient = () => globalThis.notificationClient;"
      : path === "settlement" ? "export const markOrderPaidFromPaymentSession = async () => ({ok:true,printJob:{reason:'already_exists'}});"
        : "export const settlePaidPosOrderLoyalty = async () => {};" }));
  } }] });
await writeFile(new URL("handler.mjs", directory), output.outputFiles[0].contents);
await import(new URL("handler.mjs", directory));

test("Pay2S website sends minimal Zalo payload once; POS and duplicate receipts do not send", async () => {
  let source = "qr_order", complete = false, fetchCount = 0, notificationStatus = "", receiptCount = 0;
  const order = { id: "test-order", order_code: "GHR-TEST", payment_method: "bank_qr", total_amount: 2400,
    metadata: { orderSource: "online", paymentStatus: "paid", items: [{ name: "Món thử", quantity: 1, lineTotal: 2400 }], privateField: "must-not-leave-server" } };
  globalThis.notificationClient = {
    rpc: async () => ({ data: { reason: "settled", syncOrder: true, complete, session: { id: "session", source, order_id: order.id } } }),
    from(table) {
      const query = { select() { return this; }, eq() { return this; },
        single: async () => ({ data: order }), maybeSingle: async () => ({ data: table === "orders" ? order : { status: notificationStatus } }),
        insert: async () => notificationStatus ? { error: { code: "23505" } } : (notificationStatus = "processing", {}),
        update(patch) { if (table === "web_order_notifications") notificationStatus = patch.status; else receiptCount++; return this; },
        then(resolve) { resolve({ error: null }); }
      }; return query;
    }
  };
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCount++;
    assert.match(url, /n8nhosting-13007771\.phoai\.vn\/webhook\//);
    assert.deepEqual([...options.body.keys()].sort(), ["event", "eventKey", "orderCode", "orderId", "zaloMessage"].sort());
    assert.match(options.body.get("zaloMessage"), /Đã thanh toán/);
    assert.match(options.body.get("zaloMessage"), /Món thử/);
    assert.ok(!options.body.toString().includes("must-not-leave-server"));
    return new Response("ok", { status: 200 });
  };
  const call = () => handler(new Request("https://example.invalid", { method: "POST", headers: { Authorization: "Bearer test-token" }, body: JSON.stringify({ transactions: [{ id: 10, gateway: "MB", accountNumber: "123", transferType: "IN", transferAmount: 2400, transactionDate: "2026-11-03 10:00:00", content: "GHR123456" }] }) }));
  try {
    assert.equal((await call()).status, 200);
    assert.equal(fetchCount, 1);
    assert.equal(notificationStatus, "sent");
    await call(); // Incomplete receipt retry is also guarded by notification event key.
    assert.equal(fetchCount, 1);
    complete = true; await call(); assert.equal(fetchCount, 1);
    complete = false; source = "pos"; await call(); assert.equal(fetchCount, 1);
    source = "qr_order"; notificationStatus = ""; order.metadata.orderSource = "pos_mobile";
    await call(); assert.equal(fetchCount, 1); assert.equal(notificationStatus, "");
    order.metadata.orderSource = "online";
    source = "qr_order"; notificationStatus = "";
    globalThis.fetch = async () => { throw new Error("n8n unavailable"); };
    assert.equal((await call()).status, 200);
    assert.equal(notificationStatus, "failed");
    assert.equal(receiptCount, 5);
  } finally { globalThis.fetch = savedFetch; }
});
