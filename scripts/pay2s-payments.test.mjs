import test from "node:test";
import assert from "node:assert/strict";
import { resolveBankTransferRoute } from "../supabase/functions/_shared/bankTransferRouting.js";
import { parsePay2sTransaction, verifyPay2sToken } from "../supabase/functions/_shared/pay2sPayload.js";
import { hashPay2sTestPhones } from "../src/services/pay2sTestPhoneService.js";
import { buildQrOrderPaymentImageUrl, getQrOrderPaymentConfig } from "../src/services/qrPaymentService.js";

const settings = { accountNumber: "00123456789", bankBin: "970416", bankName: "ACB", accountName: "TEST" };
const payload = { id: 123, accountNumber: "00123456789", gateway: "ACB", transferAmount: 25000,
  transferType: "IN", transactionDate: "2026-11-02 10:00:00", content: "TT GHR-12345" };

test("Pay2S is off by default; MoMo and non-test customers keep their provider", async () => {
  assert.equal((await resolveBankTransferRoute(settings, "0900000001")).provider, "sepay");
  assert.equal((await resolveBankTransferRoute({ ...settings, pay2sMode: "live" }, "", "momo")).provider, "momo");
  const config = { ...settings, pay2sMode: "test", pay2sTestPhoneHashes: await hashPay2sTestPhones("0900000001") };
  assert.equal((await resolveBankTransferRoute(config, "0900000002")).provider, "sepay");
  assert.equal((await resolveBankTransferRoute(config, "+84900000001")).provider, "pay2s");
  assert.equal((await resolveBankTransferRoute(config, "")).provider, "sepay");
});

test("routing snapshots the receiving account and rejects incomplete bank details", async () => {
  const route = await resolveBankTransferRoute({ ...settings, pay2sMode: "live" });
  assert.equal(route.providerPayload.bankTransfer.accountNumber, "00123456789");
  assert.equal(route.providerPayload.bankTransfer.bankBin, "970416");
  await assert.rejects(resolveBankTransferRoute({ pay2sMode: "live" }));
  const mbRoute = await resolveBankTransferRoute({ ...settings, pay2sMode: "live", pay2sBankBin: "970422", pay2sAccountNumber: "0099999999", pay2sAccountName: "MB TEST" });
  assert.equal(mbRoute.providerPayload.bankTransfer.accountNumber, "0099999999");
  assert.equal(mbRoute.providerPayload.bankTransfer.bankBin, "970422");
  assert.equal(settings.accountNumber, "00123456789");
  await assert.rejects(resolveBankTransferRoute({ ...settings, pay2sMode: "live", pay2sBankBin: "970422" }));
});

test("test phone configuration normalizes and deduplicates numbers", async () => {
  assert.equal((await hashPay2sTestPhones("0900000001, +84900000001")).length, 1);
  await assert.rejects(hashPay2sTestPhones("123"));
});

test("Pay2S payload supports missing paymentCode and Vietnam local timestamps", () => {
  const tx = parsePay2sTransaction(payload);
  assert.deepEqual(tx.references, ["GHR12345"]);
  assert.equal(tx.transactionDate, "2026-11-02T03:00:00.000Z");
  assert.equal(tx.accountNumber, "00123456789");
  assert.equal(tx.bankBin, "970416");
  assert.equal(parsePay2sTransaction({ ...payload, gateway: "MBB" }).bankBin, "970422");
  assert.deepEqual(parsePay2sTransaction({ ...payload, content: "TT GHR-12345-QR-77889" }).references, ["GHR12345QR77889"]);
  assert.deepEqual(parsePay2sTransaction({ ...payload, content: "XGHR12345Y" }).references, []);
  assert.deepEqual(parsePay2sTransaction({ ...payload, content: "TT POS-20261102-123456" }).references, ["POS20261102123456"]);
});

test("bad amounts, missing identities and bad dates cannot settle orders", () => {
  for (const patch of [{ transferAmount: -1 }, { transferAmount: 1.5 }, { id: "" }, { accountNumber: "" },
    { transactionDate: "invalid" }, { transferType: "unknown" }]) {
    assert.throws(() => parsePay2sTransaction({ ...payload, ...patch }));
  }
});

test("webhook authentication fails closed", async () => {
  assert.equal(await verifyPay2sToken("Bearer test-token", "test-token"), true);
  assert.equal(await verifyPay2sToken("Bearer wrong", "test-token"), false);
  assert.equal(await verifyPay2sToken(null, "test-token"), false);
  assert.equal(await verifyPay2sToken("Bearer test-token", ""), false);
});

test("website waits for its session and shows the same MB account in QR and text", () => {
  const branch = { paymentSettings: { bankBin: "970403", accountNumber: "11111111", accountName: "SACOM TEST" } };
  const order = { id: "GHR-12345", source: "online", fulfillmentType: "pickup", paymentMethod: "bank_qr", total: 25000 };
  const session = { id: "test", provider: "pay2s", providerPayload: { bankTransfer: {
    bankBin: "970422", bankName: "MB Bank", accountNumber: "0022222222", accountName: "MB TEST"
  } } };
  assert.equal(buildQrOrderPaymentImageUrl({ branch, order }), "");
  assert.match(buildQrOrderPaymentImageUrl({ branch, order, session }), /970422-0022222222/);
  assert.equal(getQrOrderPaymentConfig(branch, session).accountNumber, "0022222222");
  assert.equal(getQrOrderPaymentConfig(branch, session).bankName, "MB Bank");
  assert.equal(buildQrOrderPaymentImageUrl({ branch, order, session: { id: "bad", provider: "pay2s" } }), "");
});
