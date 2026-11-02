import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { buildPosQrImageUrl, getPosQrPaymentConfig } from "../ghr-pos-mobile-native/src/services/pos/posPaymentService.js";

const branch = { paymentSettings: { bankBin: "970403", accountNumber: "11111111", accountName: "SACOM TEST" } };
const session = { provider: "pay2s", providerPayload: { bankTransfer: { bankBin: "970422", accountNumber: "0022222222", accountName: "MB TEST" } } };

test("native QR display/printing uses MB snapshot while SePay keeps its Sacombank account", () => {
  const input = { branch, amount: 25000, orderIdentity: { paymentReference: "GHR-12345" } };
  assert.match(buildPosQrImageUrl(input), /970403-11111111/);
  assert.match(buildPosQrImageUrl({ ...input, session }), /970422-0022222222/);
  assert.equal(getPosQrPaymentConfig(branch, session).accountName, "MB TEST");
  assert.equal(buildPosQrImageUrl({ ...input, session: { provider: "pay2s" } }), "");
});

test("native session API sends snapshot capability and preserves the server-selected Pay2S provider", async () => {
  const output = await build({ entryPoints: ["ghr-pos-mobile-native/src/services/pos/posPaymentSessionService.js"],
    bundle: true, write: false, format: "esm", platform: "node",
    plugins: [{ name: "native-test-dependencies", setup(builder) {
      builder.onResolve({ filter: /supabase\/client$/ }, () => ({ path: "client", namespace: "mock" }));
      builder.onResolve({ filter: /^@react-native-async-storage/ }, () => ({ path: "storage", namespace: "mock" }));
      builder.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: args.path === "client"
        ? "export const supabase = globalThis.nativePay2sClient;"
        : "export default { getItem: async () => null, setItem: async () => {} };" }));
    } }]
  });
  let requested;
  globalThis.nativePay2sClient = {
    auth: { getSession: async () => ({ data: { session: { access_token: "test-only", expires_at: Math.floor(Date.now()/1000)+3600 } } }) },
    functions: { invoke: async (_name, options) => {
      requested = options.body;
      return { data: { ok: true, session: { id: "test", provider: "pay2s", payment_reference: "POS-20261102-123456", status: "pending_payment", provider_payload: session.providerPayload } }, error: null };
    } }
  };
  const directory = new URL("../.tmp/pay2s-tests/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("native-session.mjs", directory), output.outputFiles[0].contents);
  const api = await import(new URL("native-session.mjs", directory));
  const result = await api.createPosPaymentSession({ paymentReference: "POS-20261102-123456", branchUuid: "test" });
  assert.equal(result.session.provider, "pay2s");
  assert.equal(result.session.providerPayload.bankTransfer.bankBin, "970422");
  assert.equal(requested.bank_account_snapshot, true);
  assert.equal(requested.session.bank_account_snapshot, true);
});
