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

export function isQrBankPaymentOrder(order = {}) {
  const metadata = getObject(order.metadata);
  return toText(order.paymentMethod || metadata.paymentMethod || metadata.payment_method).toLowerCase() === "bank_qr";
}

export function getQrOrderPaymentStatus(order = {}, session = null) {
  const metadata = getObject(order.metadata);
  const sessionStatus = toText(session?.status).toLowerCase();
  return toText(
    ["paid", "converted"].includes(sessionStatus) ? sessionStatus :
      order.paymentStatus ||
      metadata.paymentStatus ||
      metadata.payment_status ||
      ""
  ).toLowerCase();
}

export function isQrOrderPaid(order = {}, session = null) {
  return ["paid", "converted"].includes(getQrOrderPaymentStatus(order, session));
}

export function getQrOrderPaymentReference(order = {}, session = null) {
  const metadata = getObject(order.metadata);
  return toText(
    session?.payment_reference ||
      session?.paymentReference ||
      order.paymentReference ||
      order.payment_reference ||
      metadata.paymentReference ||
      metadata.payment_reference ||
      order.orderCode ||
      order.id
  ).toUpperCase();
}

export function findQrOrderPaymentBranch(order = {}, branches = []) {
  const branchCandidates = [
    order.pickupBranchUuid,
    order.pickup_branch_uuid,
    order.branchUuid,
    order.branch_uuid,
    order.pickupBranchId,
    order.pickup_branch_id,
    order.branchId,
    order.branch_id,
    order.pickupBranchName,
    order.pickup_branch_name,
    order.branchName,
    order.branch_name
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
  return buildPosQrImageUrl({
    branch,
    amount: session?.amount_expected || order.totalAmount || order.total,
    orderIdentity: {
      orderCode: order.orderCode || order.id,
      displayOrderCode: order.orderCode || order.id,
      paymentReference: getQrOrderPaymentReference(order, session)
    }
  });
}

export function getQrOrderPaymentConfig(branch = {}) {
  return getPosQrPaymentConfig(branch);
}

function normalizeSession(session = null) {
  if (!session || typeof session !== "object") return null;
  return {
    ...session,
    amountExpected: toAmount(session.amount_expected || session.amountExpected),
    amountPaid: toAmount(session.amount_paid || session.amountPaid),
    paymentReference: getQrOrderPaymentReference({}, session)
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
  const orderId = toText(order.id || order.orderCode);
  if (!orderId) {
    return { ok: false, message: "Thiếu mã đơn để tạo QR thanh toán." };
  }

  return invokeQrPaymentFunction({
    action: "create",
    order_id: orderId,
    payment_reference: getQrOrderPaymentReference(order)
  });
}

export async function readQrOrderPaymentSession({ order = {}, sessionId = "" } = {}) {
  return invokeQrPaymentFunction({
    action: "read",
    session_id: sessionId,
    order_id: toText(order.id || order.orderCode),
    payment_reference: getQrOrderPaymentReference(order)
  });
}
