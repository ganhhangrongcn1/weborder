import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient
} from "./supabase/supabaseRuntimeClient.js";

export const POS_PAYMENT_SESSION_SOURCES = Object.freeze({
  POS: "pos",
  WEB: "web",
  QR_ORDER: "qr_order"
});

export const POS_PAYMENT_SESSION_STATUSES = Object.freeze({
  DRAFT: "draft",
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  CONVERTING: "converting",
  CONVERTED: "converted",
  FAILED: "failed"
});

const EDITABLE_STATUSES = new Set([
  POS_PAYMENT_SESSION_STATUSES.DRAFT
]);

const CANCELLABLE_STATUSES = new Set([
  POS_PAYMENT_SESSION_STATUSES.DRAFT,
  POS_PAYMENT_SESSION_STATUSES.PENDING_PAYMENT
]);

const TERMINAL_STATUSES = new Set([
  POS_PAYMENT_SESSION_STATUSES.CANCELLED,
  POS_PAYMENT_SESSION_STATUSES.EXPIRED,
  POS_PAYMENT_SESSION_STATUSES.CONVERTED,
  POS_PAYMENT_SESSION_STATUSES.FAILED
]);

function toText(value = "") {
  return String(value ?? "").trim();
}

function toMoney(value = 0) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function normalizePhone(value = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return digits;
}

function normalizeStatus(value = "") {
  const status = toText(value).toLowerCase();
  return Object.values(POS_PAYMENT_SESSION_STATUSES).includes(status)
    ? status
    : POS_PAYMENT_SESSION_STATUSES.DRAFT;
}

function normalizeSource(value = "") {
  const source = toText(value).toLowerCase();
  return Object.values(POS_PAYMENT_SESSION_SOURCES).includes(source)
    ? source
    : POS_PAYMENT_SESSION_SOURCES.POS;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

async function getClient() {
  return getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
}

async function getAuthenticatedClient() {
  const client = await getClient();
  if (!client) {
    return {
      client: null,
      accessToken: "",
      message: "Supabase chưa sẵn sàng."
    };
  }

  const { data, error } = await client.auth.getSession();
  const accessToken = toText(data?.session?.access_token);
  if (error || !accessToken) {
    return {
      client,
      accessToken: "",
      message: "Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại."
    };
  }

  return {
    client,
    accessToken,
    message: ""
  };
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
    source: normalizeSource(row.source),
    status: normalizeStatus(row.status),
    branchUuid: toText(row.branch_uuid),
    branchName: toText(row.branch_name),
    cashierName: toText(row.cashier_name),
    customerName: toText(row.customer_name),
    customerPhone: normalizePhone(row.customer_phone),
    pagerNumber: toText(row.pager_number),
    amountExpected: toMoney(row.amount_expected),
    amountPaid: toMoney(row.amount_paid),
    cartSnapshot: Array.isArray(row.cart_snapshot) ? row.cart_snapshot : [],
    checkoutSnapshot,
    orderIdentity,
    orderId: toText(row.order_id),
    expiresAt: toText(row.expires_at),
    paidAt: toText(row.paid_at),
    cancelledAt: toText(row.cancelled_at),
    convertedAt: toText(row.converted_at),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    isPaymentSession: true
  };
}

async function invokeSessionAction(body = {}) {
  const auth = await getAuthenticatedClient();
  if (!auth.client || !auth.accessToken) {
    return { ok: false, message: auth.message };
  }

  const { data, error } = await auth.client.functions.invoke("pos-payment-session-api", {
    body,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    }
  });
  if (error) {
    let functionMessage = "";
    try {
      const errorBody = await error.context?.json?.();
      functionMessage = toText(errorBody?.message);
    } catch {
      functionMessage = "";
    }
    return {
      ok: false,
      message: functionMessage || toText(data?.message || error.message) || "Không gọi được dịch vụ thanh toán."
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
    reused: Boolean(data.reused)
  };
}

export function buildPosPaymentSessionDraft(input = {}) {
  const paymentReference = toText(input.paymentReference).toUpperCase();
  if (!paymentReference) {
    throw new Error("Thiếu mã tham chiếu thanh toán.");
  }

  return {
    payment_reference: paymentReference,
    request_key: toText(input.requestKey) || null,
    provider: toText(input.provider).toLowerCase() || "sepay",
    source: normalizeSource(input.source),
    status: POS_PAYMENT_SESSION_STATUSES.DRAFT,
    branch_uuid: toText(input.branchUuid) || null,
    branch_name: toText(input.branchName),
    cashier_name: toText(input.cashierName),
    customer_name: toText(input.customerName),
    customer_phone: normalizePhone(input.customerPhone) || null,
    pager_number: toText(input.pagerNumber) || null,
    currency: toText(input.currency).toUpperCase() || "VND",
    amount_expected: toMoney(input.amountExpected),
    amount_paid: 0,
    cart_snapshot: Array.isArray(input.cart) ? input.cart : [],
    checkout_snapshot: input.checkout && typeof input.checkout === "object"
      ? input.checkout
      : {},
    provider_payload: {}
  };
}

export async function createPosPaymentSession(input = {}) {
  let session = null;
  try {
    session = buildPosPaymentSessionDraft(input);
  } catch (error) {
    return { ok: false, message: error?.message || "Dữ liệu thanh toán chưa hợp lệ." };
  }

  return invokeSessionAction({
    action: "create",
    session: {
      ...session,
      status: POS_PAYMENT_SESSION_STATUSES.PENDING_PAYMENT
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

export async function subscribePosPaymentSession(sessionId = "", onChange) {
  const safeSessionId = toText(sessionId);
  if (!safeSessionId || typeof onChange !== "function") return () => {};

  const client = await getClient();
  if (!client) return () => {};

  const channel = client
    .channel(`pos-payment-session-${safeSessionId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "pos_payment_sessions",
        filter: `id=eq.${safeSessionId}`
      },
      (payload) => {
        const nextRow = payload?.new;
        if (!nextRow?.id) return;
        onChange(normalizeSessionRow(nextRow), payload);
      }
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // noop
    }
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

export function canEditPosPaymentSession(session = {}) {
  return EDITABLE_STATUSES.has(normalizeStatus(session.status));
}

export function canCancelPosPaymentSession(session = {}) {
  return CANCELLABLE_STATUSES.has(normalizeStatus(session.status));
}

export function isPosPaymentSessionTerminal(session = {}) {
  return TERMINAL_STATUSES.has(normalizeStatus(session.status));
}

export function isPosPaymentSessionPaid(session = {}) {
  const status = normalizeStatus(session.status);
  return status === POS_PAYMENT_SESSION_STATUSES.PAID
    || status === POS_PAYMENT_SESSION_STATUSES.CONVERTING
    || status === POS_PAYMENT_SESSION_STATUSES.CONVERTED;
}
