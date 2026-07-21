import { initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { buildPosQrImageUrl, getPosQrPaymentConfig } from "./posPaymentService.js";

export const QR_ORDER_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

function toText(value = "") {
  return String(value || "").trim();
}

function toAmount(value = 0) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeKey(value = "") {
  return toText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getOrderPaymentMethod(order = {}) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  return toText(
    safeOrder.paymentMethod ||
      safeOrder.payment_method ||
      metadata.paymentMethod ||
      metadata.payment_method
  ).toLowerCase();
}

function getOrderSource(order = {}) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  return toText(
    safeOrder.orderSource ||
      safeOrder.source ||
      safeOrder.channel ||
      safeOrder.platform ||
      metadata.orderSource ||
      metadata.order_source ||
      metadata.source ||
      metadata.channel
  ).toLowerCase();
}

function getOrderFulfillmentType(order = {}) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  return toText(
    safeOrder.fulfillmentType ||
      safeOrder.fulfillment_type ||
      metadata.fulfillmentType ||
      metadata.fulfillment_type
  ).toLowerCase();
}

export function isQrBankPaymentOrder(order = {}) {
  return getOrderPaymentMethod(order) === "bank_qr";
}

export function isMomoPaymentOrder(order = {}) {
  return getOrderPaymentMethod(order) === "momo";
}

export function isQrCounterBankPaymentOrder(order = {}) {
  if (!isQrBankPaymentOrder(order)) return false;
  return getOrderSource(order) === "qr_counter";
}

export function isQrCounterPrepaidOrder(order = {}) {
  return getOrderSource(order) === "qr_counter" && ["bank_qr", "momo"].includes(getOrderPaymentMethod(order));
}

export function isPrepaidPickupOrder(order = {}) {
  const paymentMethod = getOrderPaymentMethod(order);
  if (!["bank_qr", "momo"].includes(paymentMethod)) return false;

  const source = getOrderSource(order);
  if (source === "qr_counter") return true;

  return ["online", "website", "web"].includes(source) && getOrderFulfillmentType(order) === "pickup";
}

export function getQrOrderPaymentStatus(order = {}, session = null) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  const sessionStatus = toText(session?.status).toLowerCase();
  return toText(
    ["paid", "converted", "expired", "cancelled", "canceled", "failed"].includes(sessionStatus)
      ? sessionStatus
      :
      safeOrder.paymentStatus ||
      metadata.paymentStatus ||
      metadata.payment_status ||
      ""
  ).toLowerCase();
}

export function isQrOrderPaid(order = {}, session = null) {
  return ["paid", "converted", "paid_after_cancel"].includes(getQrOrderPaymentStatus(order, session));
}

export function isQrOrderPaymentExpired(order = {}, session = null) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  const status = getQrOrderPaymentStatus(order, session);
  if (["paid", "converted", "paid_after_cancel"].includes(status)) return false;
  const orderStatus = toText(safeOrder.status || metadata.status || metadata.orderStatus).toLowerCase();
  const kitchenStatus = toText(safeOrder.kitchenStatus || metadata.kitchenStatus || metadata.kitchen_status).toLowerCase();
  const explicitlyExpired = ["expired", "cancelled", "canceled", "failed"].includes(status) ||
    ["cancelled", "canceled"].includes(orderStatus) ||
    ["cancelled", "canceled"].includes(kitchenStatus);
  if (explicitlyExpired) return true;
  if (!isPrepaidPickupOrder(safeOrder)) return false;

  const expiresAt = new Date(
    session?.expires_at ||
      session?.expiresAt ||
      safeOrder.paymentExpiresAt ||
      safeOrder.payment_expires_at ||
      metadata.paymentExpiresAt ||
      metadata.payment_expires_at ||
      ""
  ).getTime();
  if (Number.isFinite(expiresAt)) return expiresAt <= Date.now();

  const createdAt = new Date(
    safeOrder.createdAt ||
      safeOrder.created_at ||
      safeOrder.orderTime ||
      metadata.createdAt ||
      metadata.created_at ||
      ""
  ).getTime();
  return Number.isFinite(createdAt) && createdAt + QR_ORDER_PAYMENT_TIMEOUT_MS <= Date.now();
}

export function getQrOrderPaymentReference(order = {}, session = null) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  return toText(
    session?.payment_reference ||
      session?.paymentReference ||
      safeOrder.paymentReference ||
      safeOrder.payment_reference ||
      metadata.paymentReference ||
      metadata.payment_reference ||
      safeOrder.orderCode ||
      safeOrder.id
  ).toUpperCase();
}

export function findQrOrderPaymentBranch(order = {}, branches = []) {
  const safeOrder = getObject(order);
  const branchCandidates = [
    safeOrder.pickupBranchUuid,
    safeOrder.pickup_branch_uuid,
    safeOrder.branchUuid,
    safeOrder.branch_uuid,
    safeOrder.pickupBranchId,
    safeOrder.pickup_branch_id,
    safeOrder.branchId,
    safeOrder.branch_id,
    safeOrder.pickupBranchName,
    safeOrder.pickup_branch_name,
    safeOrder.branchName,
    safeOrder.branch_name
  ].map(normalizeKey).filter(Boolean);

  return (Array.isArray(branches) ? branches : []).find((branch) => {
    const keys = [
      branch.id,
      branch.uuid,
      branch.branchUuid,
      branch.branch_uuid,
      branch.code,
      branch.slug,
      branch.name
    ].map(normalizeKey).filter(Boolean);
    return keys.some((key) => branchCandidates.includes(key));
  }) || {};
}

export function buildQrOrderPaymentImageUrl({ order = {}, branch = {}, session = null } = {}) {
  const safeOrder = getObject(order);
  if (isMomoPaymentOrder(safeOrder)) return "";
  return buildPosQrImageUrl({
    branch,
    amount: session?.amount_expected || safeOrder.totalAmount || safeOrder.total,
    orderIdentity: {
      orderCode: safeOrder.orderCode || safeOrder.id,
      displayOrderCode: safeOrder.orderCode || safeOrder.id,
      paymentReference: getQrOrderPaymentReference(safeOrder, session)
    }
  });
}

export function getQrOrderPaymentConfig(branch = {}) {
  return getPosQrPaymentConfig(branch);
}

export function getMomoPaymentLinks(session = null) {
  const providerPayload = getObject(session?.providerPayload || session?.provider_payload);
  return {
    payUrl: toText(providerPayload.payUrl || providerPayload.pay_url),
    deeplink: toText(providerPayload.deeplink),
    qrCodeUrl: toText(providerPayload.qrCodeUrl || providerPayload.qr_code_url)
  };
}

export function isZaloInAppBrowser(userAgent = "") {
  const safeUserAgent = toText(
    userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")
  );
  return /zalo/i.test(safeUserAgent);
}

export function getPreferredMomoPaymentUrl(session = null, userAgent = "") {
  const links = getMomoPaymentLinks(session);
  return isZaloInAppBrowser(userAgent)
    ? links.payUrl || links.deeplink
    : links.deeplink || links.payUrl;
}

export function getFallbackMomoPaymentUrl(session = null, userAgent = "") {
  const links = getMomoPaymentLinks(session);
  const preferredUrl = getPreferredMomoPaymentUrl(session, userAgent);
  const fallbackUrl = preferredUrl === links.payUrl ? links.deeplink : links.payUrl;
  return fallbackUrl && fallbackUrl !== preferredUrl ? fallbackUrl : "";
}

export async function buildMomoPaymentQrImageUrl(session = null) {
  const { qrCodeUrl } = getMomoPaymentLinks(session);
  const qrPayload = qrCodeUrl;
  if (!qrPayload) return "";

  const qrCodeModule = await import("qrcode");
  const qrCode = qrCodeModule.default || qrCodeModule;
  return qrCode.toDataURL(qrPayload, {
    width: 420,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#24170f",
      light: "#ffffff"
    }
  });
}

function normalizeSession(session = null) {
  if (!session || typeof session !== "object") return null;
  return {
    ...session,
    amountExpected: toAmount(session.amount_expected || session.amountExpected),
    amountPaid: toAmount(session.amount_paid || session.amountPaid),
    paymentReference: getQrOrderPaymentReference({}, session),
    providerPayload: getObject(session.provider_payload || session.providerPayload)
  };
}

function normalizeRecoveredOrder(order = null) {
  if (!order || typeof order !== "object") return null;
  const safeOrder = getObject(order);
  const orderId = toText(safeOrder.id || safeOrder.orderCode);
  if (!orderId) return null;

  return {
    ...safeOrder,
    id: orderId,
    orderCode: toText(safeOrder.orderCode || orderId),
    displayOrderCode: toText(safeOrder.displayOrderCode || safeOrder.orderCode || orderId),
    phone: toText(safeOrder.phone || safeOrder.customerPhone),
    customerPhone: toText(safeOrder.customerPhone || safeOrder.phone),
    totalAmount: toAmount(safeOrder.totalAmount || safeOrder.total),
    total: toAmount(safeOrder.total || safeOrder.totalAmount),
    items: Array.isArray(safeOrder.items) ? safeOrder.items : []
  };
}

async function invokeQrPaymentFunction(payload) {
  const client = await initSupabaseRuntimeClient();
  if (!client?.functions?.invoke) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase để tạo phiên thanh toán QR."
    };
  }

  let data = null;
  let error = null;
  try {
    const result = await client.functions.invoke("qr-payment-session-api", {
      body: payload
    });
    data = result.data;
    error = result.error;
  } catch (invokeError) {
    return {
      ok: false,
      message: invokeError?.message || "Không gọi được dịch vụ thanh toán QR."
    };
  }
  if (error) {
    let errorPayload = data;
    if (!errorPayload && error?.context?.json) {
      try {
        errorPayload = await error.context.json();
      } catch {
        errorPayload = null;
      }
    }
    return {
      ok: false,
      code: toText(errorPayload?.code),
      message: errorPayload?.message || error.message || "Không gọi được dịch vụ thanh toán QR.",
      session: normalizeSession(errorPayload?.session),
      order: normalizeRecoveredOrder(errorPayload?.order)
    };
  }
  if (!data?.ok) {
    return {
      ok: false,
      code: toText(data?.code),
      message: data?.message || "Không tạo được phiên thanh toán QR.",
      session: normalizeSession(data?.session),
      order: normalizeRecoveredOrder(data?.order)
    };
  }
  return {
    ok: true,
    code: toText(data.code),
    message: toText(data.message),
    session: normalizeSession(data.session),
    order: normalizeRecoveredOrder(data.order),
    reused: Boolean(data.reused)
  };
}

export async function createQrOrderPaymentSession({ order = {} } = {}) {
  const safeOrder = getObject(order);
  const orderId = toText(safeOrder.id || safeOrder.orderCode);
  if (!orderId) {
    return { ok: false, message: "Thiếu mã đơn để tạo QR thanh toán." };
  }

  return invokeQrPaymentFunction({
    action: "create",
    order_id: orderId,
    payment_reference: getQrOrderPaymentReference(safeOrder),
    provider: isMomoPaymentOrder(safeOrder) ? "momo" : "sepay"
  });
}

export async function readQrOrderPaymentSession({ order = {}, sessionId = "" } = {}) {
  const safeOrder = getObject(order);
  return invokeQrPaymentFunction({
    action: "read",
    session_id: sessionId,
    order_id: toText(safeOrder.id || safeOrder.orderCode),
    payment_reference: getQrOrderPaymentReference(safeOrder)
  });
}

export async function cancelQrOrderPayment({ order = {}, customerActionToken = "" } = {}) {
  const safeOrder = getObject(order);
  const orderId = toText(safeOrder.id || safeOrder.orderCode);
  if (!orderId) {
    return { ok: false, code: "ORDER_REQUIRED", message: "Thiếu mã đơn cần hủy." };
  }

  const result = await invokeQrPaymentFunction({
    action: "cancel_unpaid",
    order_id: orderId,
    customer_action_token: toText(customerActionToken)
  });

  return {
    ...result,
    code: toText(result?.code || result?.status).toUpperCase()
  };
}

export async function recoverMomoReturnOrder({ returnToken = "" } = {}) {
  const safeReturnToken = toText(returnToken);
  if (!safeReturnToken) {
    return { ok: false, message: "Thiếu mã mở lại đơn hàng MoMo." };
  }

  return invokeQrPaymentFunction({
    action: "recover_momo_return",
    return_token: safeReturnToken
  });
}
