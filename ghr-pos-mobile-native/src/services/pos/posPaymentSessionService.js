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
const AUTH_REFRESH_LEEWAY_SECONDS = 90;
const TRANSIENT_RETRY_DELAY_MS = 450;

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

function waitForRetry(delayMs = TRANSIENT_RETRY_DELAY_MS) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

function getErrorStatus(error = null) {
  return Number(
    error?.context?.status
      || error?.status
      || error?.statusCode
      || 0
  );
}

function isAuthFailure(error = null, data = null) {
  const status = getErrorStatus(error);
  const message = toText(data?.message || error?.message).toLowerCase();
  if (status === 403) return false;
  return status === 401
    || /jwt|token|unauthori|đăng nhập/.test(message);
}

function isTransientConnectionFailure(error = null, data = null) {
  const status = getErrorStatus(error);
  const message = toText(data?.message || error?.message).toLowerCase();
  return status === 0
    || status === 408
    || status === 429
    || status >= 500
    || /network|fetch|timeout|timed out|kết nối|ket noi|offline|socket/.test(message);
}

function isSessionNearExpiry(session = null) {
  const expiresAtSeconds = Number(session?.expires_at || 0);
  if (!expiresAtSeconds) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAtSeconds - nowSeconds <= AUTH_REFRESH_LEEWAY_SECONDS;
}

export async function refreshPosPaymentAuthSession({ forceRefresh = false } = {}) {
  if (!supabase) {
    return { ok: false, session: null, message: "Supabase chưa sẵn sàng." };
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  const currentSession = authData?.session || null;
  if (authError || !currentSession?.access_token) {
    return {
      ok: false,
      session: null,
      message: "Phiên đăng nhập POS không còn hợp lệ. Vui lòng đăng nhập lại."
    };
  }

  if (!forceRefresh && !isSessionNearExpiry(currentSession)) {
    return { ok: true, session: currentSession, refreshed: false, message: "" };
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedSession = refreshData?.session || null;
  if (refreshError || !refreshedSession?.access_token) {
    return {
      ok: false,
      session: null,
      message: "Không tự làm mới được phiên POS. Vui lòng kiểm tra mạng hoặc đăng nhập lại."
    };
  }

  await supabase.realtime.setAuth(refreshedSession.access_token);
  return { ok: true, session: refreshedSession, refreshed: true, message: "" };
}

function normalizeSessionRow(row = {}) {
  const checkoutSnapshot = getObject(row.checkout_snapshot);
  const providerPayload = getObject(row.provider_payload);
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
    providerPayload,
    momoPayUrl: toText(providerPayload.payUrl || providerPayload.pay_url),
    momoDeeplink: toText(providerPayload.deeplink),
    momoQrValue: toText(providerPayload.qrCodeUrl || providerPayload.qr_code_url || providerPayload.payUrl || providerPayload.pay_url),
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
  const initialAuth = await refreshPosPaymentAuthSession();
  if (!initialAuth.ok) return { ok: false, message: initialAuth.message };

  const invokeWithSession = async (session) => {
    const result = await supabase.functions.invoke("pos-payment-session-api", {
      body,
      headers: { Authorization: `Bearer ${toText(session?.access_token)}` }
    });
    if (result.error && !result.data && result.error.context?.clone) {
      try {
        return { ...result, data: await result.error.context.clone().json() };
      } catch {
        // A gateway or network error may not contain a JSON response.
      }
    }
    return result;
  };

  let { data, error } = await invokeWithSession(initialAuth.session);

  if (error && isAuthFailure(error, data)) {
    const refreshedAuth = await refreshPosPaymentAuthSession({ forceRefresh: true });
    if (!refreshedAuth.ok) return { ok: false, message: refreshedAuth.message };
    ({ data, error } = await invokeWithSession(refreshedAuth.session));
  } else if (error && isTransientConnectionFailure(error, data)) {
    await waitForRetry();
    const retryAuth = await refreshPosPaymentAuthSession();
    if (retryAuth.ok) {
      ({ data, error } = await invokeWithSession(retryAuth.session));
    }
  }

  if (error) {
    const requiresLogin = isAuthFailure(error, data);
    const forbidden = getErrorStatus(error) === 403;
    return {
      ok: false,
      message: requiresLogin
        ? "Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại."
        : toText(data?.message) || (forbidden
          ? "Tài khoản không có quyền thực hiện thao tác thanh toán này."
          : toText(error.message) || "Không gọi được dịch vụ thanh toán. Kiểm tra mạng rồi thử lại.")
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

export function attachPosPaymentSessionOrder(sessionId = "", orderId = "") {
  return invokeSessionAction({
    action: "attach_order",
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
