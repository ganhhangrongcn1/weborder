import { initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { buildPosQrImageUrl, getPosQrPaymentConfig } from "./posPaymentService.js";

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

export function getQrOrderPaymentStatus(order = {}, session = null) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  const sessionStatus = toText(session?.status).toLowerCase();
  return toText(
    ["paid", "converted"].includes(sessionStatus) ? sessionStatus :
      safeOrder.paymentStatus ||
      metadata.paymentStatus ||
      metadata.payment_status ||
      ""
  ).toLowerCase();
}

export function isQrOrderPaid(order = {}, session = null) {
  return ["paid", "converted"].includes(getQrOrderPaymentStatus(order, session));
}

export function isQrOrderPaymentExpired(order = {}, session = null) {
  const safeOrder = getObject(order);
  const metadata = getObject(safeOrder.metadata);
  const status = getQrOrderPaymentStatus(order, session);
  const orderStatus = toText(safeOrder.status || metadata.status || metadata.orderStatus).toLowerCase();
  const kitchenStatus = toText(safeOrder.kitchenStatus || metadata.kitchenStatus || metadata.kitchen_status).toLowerCase();
  return ["expired", "cancelled", "canceled", "failed"].includes(status) ||
    ["cancelled", "canceled"].includes(orderStatus) ||
    ["cancelled", "canceled"].includes(kitchenStatus);
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
    return {
      ok: false,
      message: error.message || "Không gọi được dịch vụ thanh toán QR."
    };
  }
  if (!data?.ok) {
    return {
      ok: false,
      message: data?.message || "Không tạo được phiên thanh toán QR.",
      session: normalizeSession(data?.session)
    };
  }
  return {
    ok: true,
    session: normalizeSession(data.session),
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
