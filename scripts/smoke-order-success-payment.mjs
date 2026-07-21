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
  isPrepaidPickupOrder,
  isQrOrderPaid,
  isQrOrderPaymentExpired,
  isQrCounterBankPaymentOrder,
  isQrCounterPrepaidOrder
} from "../src/services/qrPaymentService.js";
import {
  getCustomerOrderDisplayStatus,
  getCustomerOrderJourney
} from "../src/services/customerOrderStatusService.js";

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

const websitePickupBankOrder = {
  source: "online",
  fulfillmentType: "pickup",
  paymentMethod: "bank_qr"
};

const websitePickupMomoOrder = {
  source: "online",
  fulfillmentType: "pickup",
  paymentMethod: "momo"
};

const websiteDeliveryMomoOrder = {
  source: "online",
  fulfillmentType: "delivery",
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
assert.equal(isPrepaidPickupOrder(qrCounterOrder), true);
assert.equal(isPrepaidPickupOrder(websitePickupBankOrder), true);
assert.equal(isPrepaidPickupOrder(websitePickupMomoOrder), true);
assert.equal(isPrepaidPickupOrder(websiteDeliveryMomoOrder), false);
assert.equal(isPrepaidPickupOrder(accidentalWebsiteQrOrder), false);
assert.equal(isMomoPaymentOrder(momoQrCounterOrder), true);
assert.equal(isQrCounterBankPaymentOrder(momoQrCounterOrder), false);
assert.equal(isQrOrderPaid({ ...momoQrCounterOrder, paymentStatus: "paid_after_cancel" }), true);
const expiredMomoOrder = {
  ...momoQrCounterOrder,
  status: "pending_payment",
  kitchenStatus: "waiting_payment",
  paymentStatus: "unpaid",
  createdAt: new Date(Date.now() - (11 * 60 * 1000)).toISOString()
};
assert.equal(isQrOrderPaymentExpired(expiredMomoOrder), true);
assert.equal(isQrOrderPaymentExpired({ ...expiredMomoOrder, paymentStatus: "paid" }), false);
assert.equal(isQrOrderPaymentExpired(momoQrCounterOrder, { status: "expired" }), true);
assert.deepEqual(getCustomerOrderDisplayStatus(expiredMomoOrder), {
  key: "cancelled",
  label: "Đã hết hạn thanh toán",
  tone: "cancelled",
  step: 0,
  paymentExpired: true
});

function formatScheduledPickup(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute} - ${year}-${month}-${day}`;
}

const scheduledPickupOrder = {
  id: "GHR-SCHEDULED",
  source: "online",
  fulfillmentType: "pickup",
  paymentMethod: "COD",
  paymentStatus: "pending",
  status: "preparing",
  kitchenStatus: "pending",
  pickupTimeText: formatScheduledPickup(new Date(Date.now() + 60 * 60 * 1000))
};
const scheduledPickupStatus = getCustomerOrderDisplayStatus(scheduledPickupOrder);
const scheduledPickupJourney = getCustomerOrderJourney(scheduledPickupOrder);
assert.equal(scheduledPickupStatus.key, "scheduled");
assert.equal(scheduledPickupStatus.label, "Quán đã nhận đơn");
assert.equal(scheduledPickupJourney.title, "Quán đã nhận đơn");
assert.match(scheduledPickupJourney.description, /bắt đầu làm lúc/);
assert.deepEqual(scheduledPickupJourney.steps.map((step) => step.label), ["Đã nhận", "Chờ giờ làm", "Đang làm", "Nhận món"]);

const readyPickupJourney = getCustomerOrderJourney({
  ...scheduledPickupOrder,
  status: "ready_for_pickup",
  kitchenStatus: "ready"
});
assert.equal(readyPickupJourney.title, "Món đã sẵn sàng");
assert.match(readyPickupJourney.description, /ghé quầy nhận món ngay/);
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
const customerOrderActionSource = await readFile(new URL("../src/services/customerOrderActionService.js", import.meta.url), "utf8");
const trackingViewSource = await readFile(new URL("../src/features/orders/TrackingView.jsx", import.meta.url), "utf8");
const orderActionPanelSource = await readFile(new URL("../src/components/customer/CustomerOrderActionPanel.jsx", import.meta.url), "utf8");
const momoWebhookSource = await readFile(new URL("../supabase/functions/momo-payment-webhook/index.ts", import.meta.url), "utf8");
const sepayWebhookSource = await readFile(new URL("../supabase/functions/sepay-pos-webhook/index.ts", import.meta.url), "utf8");

assert.match(checkoutViewSource, /fulfillmentType === "pickup" \? paymentMethod : "COD"/);
assert.match(checkoutPricingSource, /isQrCounterOrder \|\| fulfillmentType === "pickup"/);
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
assert.match(qrPaymentFunctionSource, /isWebsitePickup/);
assert.match(qrPaymentFunctionSource, /returnTokenHash/);
assert.doesNotMatch(qrPaymentFunctionSource, /provider_payload:\s*\{[^}]*returnToken/s);
assert.match(qrPaymentFunctionSource, /cancel_unpaid/);
assert.match(qrPaymentFunctionSource, /customerActionTokenHash/);
assert.doesNotMatch(qrPaymentFunctionSource, /kitchen_status:\s*"cancelled"/);
assert.match(customerOrderActionSource, /https:\/\/zalo\.me\/\$\{CUSTOMER_SUPPORT_ZALO_PHONE\}/);
assert.match(trackingViewSource, /handleReorderOrder/);
assert.match(trackingViewSource, /Thanh toán tiếp/);
assert.match(orderActionPanelSource, /Xác nhận hủy/);
assert.match(orderActionPanelSource, /Liên hệ Zalo/);
assert.match(momoWebhookSource, /payment_received_after_cancel/);
assert.doesNotMatch(momoWebhookSource, /kitchen_status:\s*"cancelled"/);
assert.match(sepayWebhookSource, /paid_after_cancel/);
assert.match(sepayWebhookSource, /shouldStartPickupKitchen/);

console.log("Order Success payment smoke test passed (cash + SePay/MoMo for QR counter and website pickup).");
