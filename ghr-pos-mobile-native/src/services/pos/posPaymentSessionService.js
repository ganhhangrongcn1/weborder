import AsyncStorage from "@react-native-async-storage/async-storage";

import { createPosOrderIdentity } from "../../shared/pos/posOrderIdentity";
import { supabase } from "../supabase/client";

export const POS_PAYMENT_SESSION_STATUSES = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  CONVERTING: "converting",
  CONVERTED: "converted",
  FAILED: "failed"
});

const ACTIVE_SESSION_STORAGE_KEY = "ghr_pos_active_payment_sessions";

function toText(value = "") {
  return String(value ?? "").normalize("NFC").trim();
}

function toMoney(value = 0) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStatus(value = "") {
  return toText(value).toLowerCase() || POS_PAYMENT_SESSION_STATUSES.PENDING_PAYMENT;
}

function normalizeSessionRow(row = {}) {
  const checkoutSnapshot = getObject(row.checkout_snapshot);
  const orderIdentity = getObject(checkoutSnapshot.orderIdentity);
  return {
    id: toText(row.id),
    paymentReference: toText(row.payment_reference),
    orderCode: toText(orderIdentity.orderCode || row.payment_reference),
    displayOrderCode: toText(orderIdentity.displayOrderCode || row.payment_reference),
    requestKey: toText(row.request_key),
    provider: toText(row.provider),
    source: toText(row.source) || "pos",
    status: normalizeStatus(row.status),
    branchUuid: toText(row.branch_uuid),
    posShiftId: toText(row.pos_shift_id || checkoutSnapshot.posShiftId || checkoutSnapshot.pos_shift_id),
    branchName: toText(row.branch_name),
    cashierName: toText(row.cashier_name),
    customerName: toText(row.customer_name),
    customerPhone: toText(row.customer_phone),
    pagerNumber: toText(row.pager_number),
    amountExpected: toMoney(row.amount_expected),
    amountPaid: toMoney(row.amount_paid),
    cartSnapshot: Array.isArray(row.cart_snapshot) ? row.cart_snapshot : [],
    checkoutSnapshot,
    orderIdentity,
    orderId: toText(row.order_id),
    expiresAt: toText(row.expires_at),
    paidAt: toText(row.paid_at),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    isPaymentSession: true
  };
}

async function readRememberedSessions() {
  try {
    return getObject(JSON.parse(await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

export async function rememberPosPaymentSession(branchUuid = "", sessionId = "") {
  const safeBranchUuid = toText(branchUuid);
  const safeSessionId = toText(sessionId);
  if (!safeBranchUuid || !safeSessionId) return;

  const sessions = await readRememberedSessions();
  await AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...sessions,
      [safeBranchUuid]: safeSessionId
    })
  );
}

export async function readRememberedPosPaymentSession(branchUuid = "") {
  const sessions = await readRememberedSessions();
  return toText(sessions[toText(branchUuid)]);
}

export async function forgetPosPaymentSession(branchUuid = "") {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return;

  const sessions = await readRememberedSessions();
  delete sessions[safeBranchUuid];
  await AsyncStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

async function invokeSessionAction(body = {}) {
  if (!supabase) {
    return { ok: false, message: "Supabase chưa sẵn sàng." };
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  const accessToken = toText(authData?.session?.access_token);
  if (authError || !accessToken) {
    return { ok: false, message: "Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const { data, error } = await supabase.functions.invoke("pos-payment-session-api", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (error) {
    return {
      ok: false,
      message: toText(data?.message || error.message) || "Không gọi được dịch vụ thanh toán."
    };
  }

  if (!data?.ok) {
    return {
      ok: false,
      message: toText(data?.message) || "Dịch vụ thanh toán từ chối yêu cầu."
    };
  }

  return {
    ok: true,
    session: normalizeSessionRow(data.session),
    sessions: Array.isArray(data.sessions)
      ? data.sessions.map((session) => normalizeSessionRow(session))
      : [],
    reused: Boolean(data.reused)
  };
}

export async function createPosPaymentSession(input = {}) {
  const orderIdentity = input.orderIdentity || createPosOrderIdentity(new Date());
  const paymentReference = toText(input.paymentReference || orderIdentity.orderCode).toUpperCase();
  const source = toText(input.source).toLowerCase() || "pos";
  if (!paymentReference) {
    return { ok: false, message: "Thiếu mã tham chiếu thanh toán." };
  }

  return invokeSessionAction({
    action: "create",
    session: {
      payment_reference: paymentReference,
      request_key: toText(input.requestKey) || null,
      provider: toText(input.provider).toLowerCase() || "sepay",
      source,
      status: POS_PAYMENT_SESSION_STATUSES.PENDING_PAYMENT,
      branch_uuid: toText(input.branchUuid) || null,
      pos_shift_id: toText(input.posShiftId) || null,
      branch_name: toText(input.branchName),
      cashier_name: toText(input.cashierName),
      customer_name: toText(input.customerName),
      customer_phone: toText(input.customerPhone) || null,
      pager_number: toText(input.pagerNumber) || null,
      currency: "VND",
      amount_expected: toMoney(input.amountExpected),
      amount_paid: 0,
      cart_snapshot: Array.isArray(input.cart) ? input.cart : [],
      order_id: toText(input.orderId) || null,
      checkout_snapshot: input.checkout && typeof input.checkout === "object"
        ? input.checkout
        : { orderIdentity },
      provider_payload: {}
    }
  });
}

export async function readPosPaymentSession(sessionId = "") {
  const safeSessionId = toText(sessionId);
  if (!safeSessionId) return null;
  const result = await invokeSessionAction({
    action: "read",
    session_id: safeSessionId
  });
  if (!result.ok) throw new Error(result.message);
  return result.session;
}

export async function listPosPaymentSessions(branchUuid = "") {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return [];

  const result = await invokeSessionAction({
    action: "list",
    branch_uuid: safeBranchUuid
  });
  if (!result.ok) throw new Error(result.message);
  return result.sessions;
}

export function subscribePosPaymentSessions(branchUuid = "", onChange) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid || typeof onChange !== "function") {
    return () => {};
  }

  const channel = supabase
    .channel(`pos-payment-sessions-${safeBranchUuid}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "pos_payment_sessions",
        filter: `branch_uuid=eq.${safeBranchUuid}`
      },
      (payload) => {
        const row = payload?.new || payload?.old || {};
        const session = normalizeSessionRow(row);
        if (!session.id) return;
        onChange(session, payload);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function cancelPosPaymentSession(sessionId = "", reason = "") {
  return invokeSessionAction({
    action: "cancel",
    session_id: toText(sessionId),
    reason: toText(reason)
  });
}

export function confirmPosPaymentSessionManually(sessionId = "") {
  return invokeSessionAction({
    action: "confirm_paid",
    session_id: toText(sessionId)
  });
}

export function markPosPaymentSessionConverted(sessionId = "", orderId = "") {
  return invokeSessionAction({
    action: "convert",
    session_id: toText(sessionId),
    order_id: toText(orderId)
  });
}

export function isPosPaymentSessionPaid(session = {}) {
  const status = normalizeStatus(session.status);
  return ["paid", "converting", "converted"].includes(status);
}

export function isPosPaymentSessionExpired(session = {}, now = Date.now()) {
  const status = normalizeStatus(session.status);
  if (!["draft", "pending_payment"].includes(status)) return false;
  const expiresAt = toText(session.expiresAt);
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryTime)) return false;
  return expiryTime <= now;
}

export function isPosPaymentSessionTerminal(session = {}) {
  const status = normalizeStatus(session.status);
  return ["cancelled", "expired", "converted", "failed"].includes(status) || isPosPaymentSessionExpired(session);
}
