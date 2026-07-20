import assert from "node:assert/strict";
import {
  buildMomoPaymentQrImageUrl,
  buildQrOrderPaymentImageUrl,
  getMomoPaymentLinks,
  isMomoPaymentOrder,
  isQrCounterBankPaymentOrder,
  isQrCounterPrepaidOrder
} from "../src/services/qrPaymentService.js";

const cashWebsiteOrder = {
  orderSource: "online",
  paymentMethod: "COD"
};

const accidentalWebsiteQrOrder = {
  orderSource: "online",
  paymentMethod: "bank_qr"
};

const cashQrCounterOrder = {
  source: "qr_counter",
  paymentMethod: "COD"
};

const qrCounterOrder = {
  source: "qr_counter",
  paymentMethod: "bank_qr"
};

const qrCounterMetadataOrder = {
  metadata: {
    order_source: "qr_counter",
    payment_method: "bank_qr"
  }
};

const momoQrCounterOrder = {
  source: "qr_counter",
  paymentMethod: "momo"
};

assert.equal(isQrCounterBankPaymentOrder(null), false);
assert.equal(isQrCounterBankPaymentOrder(cashWebsiteOrder), false);
assert.equal(isQrCounterBankPaymentOrder(accidentalWebsiteQrOrder), false);
assert.equal(isQrCounterBankPaymentOrder(cashQrCounterOrder), false);
assert.equal(isQrCounterBankPaymentOrder(qrCounterOrder), true);
assert.equal(isQrCounterBankPaymentOrder(qrCounterMetadataOrder), true);
assert.equal(isQrCounterPrepaidOrder(qrCounterOrder), true);
assert.equal(isQrCounterPrepaidOrder(momoQrCounterOrder), true);
assert.equal(isMomoPaymentOrder(momoQrCounterOrder), true);
assert.equal(isQrCounterBankPaymentOrder(momoQrCounterOrder), false);
const momoSession = {
  provider_payload: {
    qrCodeUrl: "000201010212TESTMOMO6304ABCD",
    payUrl: "https://test-payment.momo.vn/v2/gateway/pay?t=test"
  }
};
assert.equal(buildQrOrderPaymentImageUrl({ order: momoQrCounterOrder, session: momoSession }), "");
assert.match(await buildMomoPaymentQrImageUrl(momoSession), /^data:image\/png;base64,/);
assert.equal(getMomoPaymentLinks(momoSession).payUrl, momoSession.provider_payload.payUrl);

console.log("Order Success payment smoke test passed (cash website + SePay/MoMo QR counter).");
