import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMomoPaymentQrImageUrl,
  buildQrOrderPaymentImageUrl,
  getFallbackMomoPaymentUrl,
  getMomoPaymentLinks,
  getPreferredMomoPaymentUrl,
  isZaloInAppBrowser,
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
    payUrl: "https://test-payment.momo.vn/v2/gateway/pay?t=test",
    deeplink: "momo://app?action=payWithApp"
  }
};
const momoSessionWithoutDirectQr = {
  provider_payload: {
    payUrl: "https://payment.momo.vn/v2/gateway/pay?t=production",
    deeplink: "momo://app?action=payWithApp"
  }
};
assert.equal(buildQrOrderPaymentImageUrl({ order: momoQrCounterOrder, session: momoSession }), "");
assert.match(await buildMomoPaymentQrImageUrl(momoSession), /^data:image\/png;base64,/);
assert.equal(await buildMomoPaymentQrImageUrl(momoSessionWithoutDirectQr), "");
assert.equal(getMomoPaymentLinks(momoSession).payUrl, momoSession.provider_payload.payUrl);
assert.equal(getMomoPaymentLinks(momoSession).deeplink, momoSession.provider_payload.deeplink);
assert.equal(isZaloInAppBrowser("Mozilla/5.0 Zalo/25.07.01"), true);
assert.equal(isZaloInAppBrowser("Mozilla/5.0 Chrome/138.0"), false);
assert.equal(getPreferredMomoPaymentUrl(momoSession, "Mozilla/5.0 Zalo/25.07.01"), momoSession.provider_payload.payUrl);
assert.equal(getFallbackMomoPaymentUrl(momoSession, "Mozilla/5.0 Zalo/25.07.01"), momoSession.provider_payload.deeplink);
assert.equal(getPreferredMomoPaymentUrl(momoSession, "Mozilla/5.0 Chrome/138.0"), momoSession.provider_payload.deeplink);

const checkoutViewSource = await readFile(new URL("../src/features/checkout/CheckoutView.jsx", import.meta.url), "utf8");
const checkoutPricingSource = await readFile(new URL("../src/features/checkout/components/CheckoutPricingSection.jsx", import.meta.url), "utf8");
const orderSuccessSource = await readFile(new URL("../src/features/orders/OrderSuccessView.jsx", import.meta.url), "utf8");
const momoReturnHookSource = await readFile(new URL("../src/hooks/useMomoReturnRecovery.js", import.meta.url), "utf8");
const qrPaymentFunctionSource = await readFile(new URL("../supabase/functions/qr-payment-session-api/index.ts", import.meta.url), "utf8");

assert.match(checkoutViewSource, /useState\(isQrCounterOrder \? "momo" : "COD"\)/);
assert.ok(checkoutPricingSource.indexOf('setPaymentMethod?.("momo")') < checkoutPricingSource.indexOf('setPaymentMethod?.("bank_qr")'));
assert.doesNotMatch(checkoutPricingSource, /SePay tự xác nhận/);
assert.match(checkoutPricingSource, /Thanh toán ví MoMo/);
assert.match(checkoutPricingSource, /\/brand\/momo-logo-app\.png/);
assert.match(checkoutViewSource, /Thanh toán bằng MoMo/);
assert.doesNotMatch(orderSuccessSource, /Không cần quét thêm mã/);
assert.match(orderSuccessSource, /Xác nhận thanh toán trên MoMo/);
assert.match(orderSuccessSource, /Mở ứng dụng MoMo/);
assert.doesNotMatch(orderSuccessSource, /Hoàn tất thanh toán/);
assert.match(orderSuccessSource, /Đang mở đơn hàng/);
assert.doesNotMatch(orderSuccessSource, /Chưa tìm thấy đơn hàng/);
assert.match(orderSuccessSource, /Chỉ xác nhận đơn khi thanh toán thành công/);
assert.match(momoReturnHookSource, /recoverMomoReturnOrder/);
assert.match(qrPaymentFunctionSource, /momoReturnToken/);
assert.match(qrPaymentFunctionSource, /returnTokenHash/);
assert.doesNotMatch(qrPaymentFunctionSource, /provider_payload:\s*\{[^}]*returnToken/s);

console.log("Order Success payment smoke test passed (cash website + SePay/MoMo QR counter).");
