import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient
} from "./supabase/supabaseRuntimeClient.js";
import {
  getCashBreakdownTotal,
  normalizeCashBreakdown
} from "./posCashBreakdownService.js";

const POS_ACTIVE_SHIFT_KEY = "ghr:pos-active-shift:v2";
const POS_SHIFT_COLUMNS = [
  "id",
  "branch_uuid",
  "branch_name",
  "register_key",
  "status",
  "cashier_name",
  "opened_by_profile_id",
  "opened_by_auth_user_id",
  "opening_cash",
  "opening_cash_breakdown",
  "opening_note",
  "opened_at",
  "closed_by_profile_id",
  "closed_by_auth_user_id",
  "closing_cash_counted",
  "closing_cash_breakdown",
  "closing_note",
  "closed_at",
  "paid_order_count",
  "cash_order_count",
  "qr_order_count",
  "cancelled_order_count",
  "cash_sales_snapshot",
  "qr_sales_snapshot",
  "cancelled_amount_snapshot",
  "cash_refund_snapshot",
  "qr_refund_snapshot",
  "expected_cash_snapshot",
  "cash_difference",
  "closing_summary",
  "created_at",
  "updated_at"
].join(",");

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRegisterKey(value = "") {
  return toText(value).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "main";
}

function getStorageKey(branchValue = "", registerKey = "main") {
  return `${POS_ACTIVE_SHIFT_KEY}:${toText(branchValue) || "default"}:${normalizeRegisterKey(registerKey)}`;
}

async function getClient() {
  return getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
}

async function getAuthenticatedContext() {
  const client = await getClient();
  if (!client) {
    return {
      client: null,
      userId: "",
      message: "Supabase chưa sẵn sàng."
    };
  }

  const { data, error } = await client.auth.getSession();
  const userId = toText(data?.session?.user?.id);
  if (error || !userId) {
    return {
      client,
      userId: "",
      message: "Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại."
    };
  }

  return {
    client,
    userId,
    message: ""
  };
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeShift(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const id = toText(raw.id || raw.shiftId);
  const branchUuid = toText(raw.branch_uuid || raw.branchUuid || raw.branchValue);
  const openedAt = toText(raw.opened_at || raw.openedAt);
  if (!id || !branchUuid || !openedAt) return null;

  const registerKey = normalizeRegisterKey(raw.register_key || raw.registerKey);
  const closingSummary = getObject(raw.closing_summary || raw.closingSummary);
  const openingCashBreakdown = normalizeCashBreakdown(raw.opening_cash_breakdown || raw.openingCashBreakdown);
  const closingCashBreakdown = normalizeCashBreakdown(raw.closing_cash_breakdown || raw.closingCashBreakdown);

  return {
    id,
    shiftId: id,
    branchValue: branchUuid,
    branchUuid,
    branchName: toText(raw.branch_name || raw.branchName),
    registerKey,
    status: toText(raw.status).toLowerCase() || "open",
    cashierName: toText(raw.cashier_name || raw.cashierName),
    openedByProfileId: toText(raw.opened_by_profile_id || raw.openedByProfileId),
    openedByAuthUserId: toText(raw.opened_by_auth_user_id || raw.openedByAuthUserId),
    openingCash: Math.max(0, toNumber(raw.opening_cash ?? raw.openingCash, 0)),
    openingCashBreakdown,
    openingNote: toText(raw.opening_note || raw.openingNote),
    openedAt,
    closedByProfileId: toText(raw.closed_by_profile_id || raw.closedByProfileId),
    closedByAuthUserId: toText(raw.closed_by_auth_user_id || raw.closedByAuthUserId),
    closingCashCounted: raw.closing_cash_counted ?? raw.closingCashCounted ?? null,
    closingCashBreakdown,
    closingNote: toText(raw.closing_note || raw.closingNote),
    closedAt: toText(raw.closed_at || raw.closedAt),
    paidOrderCount: Math.max(0, toNumber(raw.paid_order_count ?? raw.paidOrderCount, 0)),
    cashOrderCount: Math.max(0, toNumber(raw.cash_order_count ?? raw.cashOrderCount, 0)),
    qrOrderCount: Math.max(0, toNumber(raw.qr_order_count ?? raw.qrOrderCount, 0)),
    cancelledOrderCount: Math.max(0, toNumber(raw.cancelled_order_count ?? raw.cancelledOrderCount, 0)),
    cashSalesSnapshot: Math.max(0, toNumber(raw.cash_sales_snapshot ?? raw.cashSalesSnapshot, 0)),
    qrSalesSnapshot: Math.max(0, toNumber(raw.qr_sales_snapshot ?? raw.qrSalesSnapshot, 0)),
    cancelledAmountSnapshot: Math.max(0, toNumber(raw.cancelled_amount_snapshot ?? raw.cancelledAmountSnapshot, 0)),
    cashRefundSnapshot: Math.max(0, toNumber(raw.cash_refund_snapshot ?? raw.cashRefundSnapshot, 0)),
    qrRefundSnapshot: Math.max(0, toNumber(raw.qr_refund_snapshot ?? raw.qrRefundSnapshot, 0)),
    expectedCashSnapshot: Math.max(0, toNumber(raw.expected_cash_snapshot ?? raw.expectedCashSnapshot, 0)),
    cashDifference: raw.cash_difference ?? raw.cashDifference ?? null,
    closingSummary,
    createdAt: toText(raw.created_at || raw.createdAt),
    updatedAt: toText(raw.updated_at || raw.updatedAt)
  };
}

function cacheShift(shift = null) {
  const normalized = normalizeShift(shift);
  if (typeof window === "undefined" || !normalized) return normalized;
  try {
    window.localStorage.setItem(
      getStorageKey(normalized.branchUuid, normalized.registerKey),
      JSON.stringify(normalized)
    );
  } catch {
    // localStorage may be unavailable.
  }
  return normalized;
}

export function readCachedActivePosShift(branchValue = "", registerKey = "main") {
  if (typeof window === "undefined") return null;
  try {
    return normalizeShift(JSON.parse(window.localStorage.getItem(getStorageKey(branchValue, registerKey)) || "null"));
  } catch {
    return null;
  }
}

export function clearCachedActivePosShift(branchValue = "", registerKey = "main") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getStorageKey(branchValue, registerKey));
  } catch {
    // localStorage may be unavailable.
  }
}

export function readActivePosShift(branchValue = "", registerKey = "main") {
  return readCachedActivePosShift(branchValue, registerKey);
}

export async function fetchActivePosShift({ branchUuid = "", registerKey = "main" } = {}) {
  const safeBranchUuid = toText(branchUuid);
  const safeRegisterKey = normalizeRegisterKey(registerKey);
  if (!safeBranchUuid) {
    return {
      ok: false,
      shift: null,
      message: "Thiếu chi nhánh POS."
    };
  }

  const auth = await getAuthenticatedContext();
  if (!auth.client || !auth.userId) {
    return {
      ok: false,
      shift: readCachedActivePosShift(safeBranchUuid, safeRegisterKey),
      message: auth.message
    };
  }

  const { data, error } = await auth.client
    .from("pos_shifts")
    .select(POS_SHIFT_COLUMNS)
    .eq("branch_uuid", safeBranchUuid)
    .eq("register_key", safeRegisterKey)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      shift: readCachedActivePosShift(safeBranchUuid, safeRegisterKey),
      message: error.message || "Không tải được ca POS đang mở."
    };
  }

  const shift = normalizeShift(data);
  if (shift) cacheShift(shift);
  if (!shift) clearCachedActivePosShift(safeBranchUuid, safeRegisterKey);

  return {
    ok: true,
    shift,
    message: ""
  };
}

export async function openPosShift({
  branchUuid = "",
  branchName = "",
  registerKey = "main",
  cashierName = "",
  profileId = "",
  openingCash = 0,
  openingCashBreakdown = null,
  openingNote = ""
} = {}) {
  const safeBranchUuid = toText(branchUuid);
  const safeRegisterKey = normalizeRegisterKey(registerKey);
  if (!safeBranchUuid) {
    return {
      ok: false,
      shift: null,
      message: "Không mở được ca POS vì thiếu chi nhánh."
    };
  }

  const auth = await getAuthenticatedContext();
  if (!auth.client || !auth.userId) {
    return {
      ok: false,
      shift: null,
      message: auth.message
    };
  }

  const existing = await fetchActivePosShift({
    branchUuid: safeBranchUuid,
    registerKey: safeRegisterKey
  });
  if (existing.ok && existing.shift?.id) {
    return {
      ok: true,
      shift: existing.shift,
      reused: true,
      message: "Đã khôi phục ca POS đang mở."
    };
  }

  const normalizedOpeningBreakdown = normalizeCashBreakdown(openingCashBreakdown);
  const payload = {
    branch_uuid: safeBranchUuid,
    branch_name: toText(branchName),
    register_key: safeRegisterKey,
    status: "open",
    cashier_name: toText(cashierName) || "Thu ngân",
    opened_by_profile_id: toText(profileId) || null,
    opened_by_auth_user_id: auth.userId,
    opening_cash: Math.max(0, Math.round(
      normalizedOpeningBreakdown ? getCashBreakdownTotal(normalizedOpeningBreakdown) : toNumber(openingCash, 0)
    )),
    opening_cash_breakdown: normalizedOpeningBreakdown || {},
    opening_note: toText(openingNote)
  };

  const { data, error } = await auth.client
    .from("pos_shifts")
    .insert(payload)
    .select(POS_SHIFT_COLUMNS)
    .single();

  if (error) {
    const message = toText(error.message).toLowerCase().includes("duplicate")
      ? "Quầy này đang có ca mở. Bấm tải lại để khôi phục ca."
      : error.message || "Không mở được ca POS.";
    return {
      ok: false,
      shift: null,
      message
    };
  }

  return {
    ok: true,
    shift: cacheShift(data),
    reused: false,
    message: "Đã mở ca POS."
  };
}

export function clearActivePosShift(branchValue = "", registerKey = "main") {
  clearCachedActivePosShift(branchValue, registerKey);
}

function isCancelledStatus(value = "") {
  return ["cancelled", "canceled", "cancel"].includes(toText(value).toLowerCase());
}

function isPaidOrder(order = {}) {
  const metadata = getObject(order.metadata);
  const paymentStatus = toText(metadata.paymentStatus || metadata.payment_status || "paid").toLowerCase();
  return paymentStatus === "paid" && !isCancelledStatus(order.status || metadata.status || metadata.orderStatus);
}

function normalizePaymentMethod(value = "") {
  const method = toText(value).toLowerCase();
  if (["bank_qr", "qr", "transfer", "bank_transfer", "sepay"].includes(method)) return "bank_qr";
  return "cash";
}

export async function fetchPosShiftSummary({ shiftId = "", openingCash = 0 } = {}) {
  const safeShiftId = toText(shiftId);
  const emptySummary = {
    orderCount: 0,
    cashOrderCount: 0,
    qrOrderCount: 0,
    cancelledOrderCount: 0,
    pendingQrCount: 0,
    cashTotal: 0,
    qrTotal: 0,
    cancelledTotal: 0,
    revenue: 0,
    openingCash: Math.max(0, toNumber(openingCash, 0)),
    expectedCash: Math.max(0, toNumber(openingCash, 0)),
    updatedAt: new Date().toISOString()
  };

  if (!safeShiftId) {
    return {
      ok: false,
      summary: emptySummary,
      message: "Thiếu mã ca POS."
    };
  }

  const auth = await getAuthenticatedContext();
  if (!auth.client || !auth.userId) {
    return {
      ok: false,
      summary: emptySummary,
      message: auth.message
    };
  }

  const [ordersResult, sessionsResult] = await Promise.all([
    auth.client
      .from("orders")
      .select("id,status,payment_method,total_amount,metadata,created_at,pos_shift_id")
      .eq("pos_shift_id", safeShiftId)
      .order("created_at", { ascending: false })
      .limit(1000),
    auth.client
      .from("pos_payment_sessions")
      .select("id,status,amount_expected,amount_paid,pos_shift_id,created_at")
      .eq("pos_shift_id", safeShiftId)
      .order("created_at", { ascending: false })
      .limit(1000)
  ]);

  if (ordersResult.error) {
    return {
      ok: false,
      summary: emptySummary,
      message: ordersResult.error.message || "Không tải được đơn trong ca."
    };
  }
  if (sessionsResult.error) {
    return {
      ok: false,
      summary: emptySummary,
      message: sessionsResult.error.message || "Không tải được phiên QR trong ca."
    };
  }

  const orders = Array.isArray(ordersResult.data) ? ordersResult.data : [];
  const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data : [];
  const paidOrders = orders.filter(isPaidOrder);
  const cancelledOrders = orders.filter((order) => isCancelledStatus(order.status || getObject(order.metadata).status));

  const totals = paidOrders.reduce((summary, order) => {
    const method = normalizePaymentMethod(order.payment_method || getObject(order.metadata).paymentMethod);
    const amount = Math.max(0, toNumber(order.total_amount, 0));
    if (method === "bank_qr") {
      summary.qrOrderCount += 1;
      summary.qrTotal += amount;
    } else {
      summary.cashOrderCount += 1;
      summary.cashTotal += amount;
    }
    return summary;
  }, {
    cashOrderCount: 0,
    qrOrderCount: 0,
    cashTotal: 0,
    qrTotal: 0
  });

  const pendingQrCount = sessions.filter((session) => {
    const status = toText(session.status).toLowerCase();
    return ["draft", "pending_payment"].includes(status);
  }).length;
  const cancelledTotal = cancelledOrders.reduce(
    (sum, order) => sum + Math.max(0, toNumber(order.total_amount, 0)),
    0
  );
  const safeOpeningCash = Math.max(0, toNumber(openingCash, 0));

  return {
    ok: true,
    summary: {
      orderCount: paidOrders.length,
      cashOrderCount: totals.cashOrderCount,
      qrOrderCount: totals.qrOrderCount,
      cancelledOrderCount: cancelledOrders.length,
      pendingQrCount,
      cashTotal: totals.cashTotal,
      qrTotal: totals.qrTotal,
      cancelledTotal,
      revenue: totals.cashTotal + totals.qrTotal,
      openingCash: safeOpeningCash,
      expectedCash: safeOpeningCash + totals.cashTotal,
      updatedAt: new Date().toISOString()
    },
    message: ""
  };
}

export async function closePosShift({
  shift = null,
  summary = null,
  closingCashCounted = 0,
  closingCashBreakdown = null,
  closingNote = ""
} = {}) {
  const normalizedShift = normalizeShift(shift);
  const shiftId = toText(normalizedShift?.id);
  if (!shiftId) {
    return {
      ok: false,
      shift: null,
      message: "Thiếu ca POS cần kết."
    };
  }

  const auth = await getAuthenticatedContext();
  if (!auth.client || !auth.userId) {
    return {
      ok: false,
      shift: null,
      message: auth.message
    };
  }

  const safeSummary = getObject(summary);
  const normalizedClosingBreakdown = normalizeCashBreakdown(closingCashBreakdown);
  const countedCash = Math.max(0, Math.round(
    normalizedClosingBreakdown ? getCashBreakdownTotal(normalizedClosingBreakdown) : toNumber(closingCashCounted, 0)
  ));
  const cashTotal = Math.max(0, toNumber(safeSummary.cashTotal, 0));
  const qrTotal = Math.max(0, toNumber(safeSummary.qrTotal, 0));
  const cancelledTotal = Math.max(0, toNumber(safeSummary.cancelledTotal, 0));
  const openingCash = Math.max(0, toNumber(normalizedShift.openingCash, 0));
  const expectedCash = Math.max(0, toNumber(safeSummary.expectedCash, openingCash + cashTotal));
  const closedAt = new Date().toISOString();
  const note = toText(closingNote);

  const payload = {
    status: "closed",
    closed_by_auth_user_id: auth.userId,
    closing_cash_counted: countedCash,
    closing_cash_breakdown: normalizedClosingBreakdown || {},
    closing_note: note,
    closed_at: closedAt,
    paid_order_count: Math.max(0, Math.round(toNumber(safeSummary.orderCount, 0))),
    cash_order_count: Math.max(0, Math.round(toNumber(safeSummary.cashOrderCount, 0))),
    qr_order_count: Math.max(0, Math.round(toNumber(safeSummary.qrOrderCount, 0))),
    cancelled_order_count: Math.max(0, Math.round(toNumber(safeSummary.cancelledOrderCount, 0))),
    cash_sales_snapshot: cashTotal,
    qr_sales_snapshot: qrTotal,
    cancelled_amount_snapshot: cancelledTotal,
    cash_refund_snapshot: Math.max(0, toNumber(safeSummary.cashRefundTotal, 0)),
    qr_refund_snapshot: Math.max(0, toNumber(safeSummary.qrRefundTotal, 0)),
    expected_cash_snapshot: expectedCash,
    closing_summary: {
      ...safeSummary,
      openingCash,
      openingCashBreakdown: normalizedShift.openingCashBreakdown || {},
      closingCashCounted: countedCash,
      closingCashBreakdown: normalizedClosingBreakdown || {},
      closingNote: note,
      expectedCash,
      cashDifference: countedCash - expectedCash,
      closedAt
    }
  };

  const { data, error } = await auth.client
    .from("pos_shifts")
    .update(payload)
    .eq("id", shiftId)
    .eq("status", "open")
    .select(POS_SHIFT_COLUMNS)
    .single();

  if (error) {
    return {
      ok: false,
      shift: null,
      message: error.message || "Không kết được ca POS."
    };
  }

  clearCachedActivePosShift(normalizedShift.branchUuid, normalizedShift.registerKey);

  return {
    ok: true,
    shift: normalizeShift(data),
    message: "Đã kết ca POS."
  };
}

export function getPosShiftOrderStats(orders = [], shift = null) {
  const shiftId = toText(shift?.id || shift?.shiftId);
  const openingCash = Math.max(0, toNumber(shift?.openingCash, 0));
  const rows = (Array.isArray(orders) ? orders : []).filter((order) => {
    if (!shiftId) return false;
    const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
    return toText(order.posShiftId || order.pos_shift_id || order.shiftId || metadata.posShiftId || metadata.pos_shift_id || metadata.shiftId || metadata.shift_id) === shiftId;
  });

  const paidRows = rows.filter((order) => {
    const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
    const paymentStatus = toText(order.paymentStatus || metadata.paymentStatus || metadata.payment_status).toLowerCase();
    const status = toText(order.status || order.orderStatus).toLowerCase();
    return paymentStatus === "paid" && !["cancelled", "canceled", "cancel"].includes(status);
  });

  const cashTotal = paidRows
    .filter((order) => toText(order.paymentMethod || order.payment_method || order.metadata?.paymentMethod).toLowerCase() === "cash")
    .reduce((sum, order) => sum + toNumber(order.totalAmount ?? order.total, 0), 0);
  const qrTotal = paidRows
    .filter((order) => toText(order.paymentMethod || order.payment_method || order.metadata?.paymentMethod).toLowerCase() === "bank_qr")
    .reduce((sum, order) => sum + toNumber(order.totalAmount ?? order.total, 0), 0);
  const cancelledCount = rows.filter((order) => {
    const status = toText(order.status || order.orderStatus).toLowerCase();
    return ["cancelled", "canceled", "cancel"].includes(status);
  }).length;

  return {
    orderCount: paidRows.length,
    cancelledCount,
    revenue: cashTotal + qrTotal,
    cashTotal,
    qrTotal,
    openingCash,
    expectedCash: openingCash + cashTotal
  };
}
