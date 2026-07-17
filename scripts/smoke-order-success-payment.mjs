import assert from "node:assert/strict";
import { isQrCounterBankPaymentOrder } from "../src/services/qrPaymentService.js";

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

assert.equal(isQrCounterBankPaymentOrder(null), false);
assert.equal(isQrCounterBankPaymentOrder(cashWebsiteOrder), false);
assert.equal(isQrCounterBankPaymentOrder(accidentalWebsiteQrOrder), false);
assert.equal(isQrCounterBankPaymentOrder(cashQrCounterOrder), false);
assert.equal(isQrCounterBankPaymentOrder(qrCounterOrder), true);
assert.equal(isQrCounterBankPaymentOrder(qrCounterMetadataOrder), true);

console.log("Order Success payment smoke test passed (cash website + QR counter).");
