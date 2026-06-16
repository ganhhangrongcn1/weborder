import { supabase } from "../supabase/client";

const POS_SHIFT_SELECT = [
  "id",
  "branch_uuid",
  "branch_name",
  "register_key",
  "status",
  "cashier_name",
  "opening_cash",
  "opening_note",
  "opened_at",
  "closed_at",
  "closing_cash_counted",
  "closing_note",
  "closing_summary"
].join(",");

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isCancelledStatus(value = "") {
  return ["cancelled", "canceled", "cancel"].includes(toText(value).toLowerCase());
}

function normalizePaymentMethod(value = "") {
  const method = toText(value).toLowerCase();
  if (["bank_qr", "qr", "transfer", "bank_transfer", "sepay"].includes(method)) return "bank_qr";
  return "cash";
}

function isPaidOrder(row = {}) {
  const metadata = getObject(row.metadata);
  const paymentStatus = toText(metadata.paymentStatus || metadata.payment_status || "paid").toLowerCase();
  return paymentStatus === "paid" && !isCancelledStatus(row.status || metadata.status || metadata.orderStatus);
}

function normalizeShift(row = null) {
  if (!row || typeof row !== "object") return null;
  return {
    id: toText(row.id),
    branchUuid: toText(row.branch_uuid),
    branchName: toText(row.branch_name),
    registerKey: toText(row.register_key || "main"),
    status: toText(row.status).toLowerCase(),
    cashierName: toText(row.cashier_name),
    openingCash: Math.max(0, toNumber(row.opening_cash, 0)),
    openingNote: toText(row.opening_note),
    openedAt: toText(row.opened_at),
    closedAt: toText(row.closed_at),
    closingCashCounted: Math.max(0, toNumber(row.closing_cash_counted, 0)),
    closingNote: toText(row.closing_note),
    closingSummary: getObject(row.closing_summary)
  };
}

function buildEmptyShiftSummary(openingCash = 0) {
  const safeOpeningCash = Math.max(0, toNumber(openingCash, 0));
  return {
    orderCount: 0,
    cashOrderCount: 0,
    qrOrderCount: 0,
    cancelledOrderCount: 0,
    pendingQrCount: 0,
    cashTotal: 0,
    qrTotal: 0,
    cancelledTotal: 0,
    revenue: 0,
    openingCash: safeOpeningCash,
    expectedCash: safeOpeningCash,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchActivePosShift({ branchUuid, registerKey = "main" } = {}) {
  if (!supabase) {
    return {
      ok: true,
      shift: null,
      message: ""
    };
  }

  if (!toText(branchUuid)) {
    return { ok: false, shift: null, message: "Thiếu chi nhánh." };
  }

  const { data, error } = await supabase
    .from("pos_shifts")
    .select(POS_SHIFT_SELECT)
    .eq("branch_uuid", toText(branchUuid))
    .eq("register_key", toText(registerKey) || "main")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, shift: null, message: error.message || "Không tải được ca POS." };
  }

  return {
    ok: true,
    shift: normalizeShift(data),
    message: ""
  };
}

export async function openPosShift({
  branchUuid,
  branchName,
  registerKey = "main",
  cashierName,
  profileId,
  authUserId,
  openingCash = 0,
  openingNote = ""
}) {
  if (!toText(branchUuid)) {
    return { ok: false, shift: null, message: "Thiếu chi nhánh." };
  }

  if (supabase) {
    const existing = await fetchActivePosShift({ branchUuid, registerKey });
    if (existing.ok && existing.shift?.id) {
      return {
        ok: true,
        shift: existing.shift,
        reused: true,
        message: "Đã khôi phục ca POS đang mở."
      };
    }

    const payload = {
      branch_uuid: toText(branchUuid),
      branch_name: toText(branchName),
      register_key: toText(registerKey) || "main",
      status: "open",
      cashier_name: toText(cashierName) || "Thu ngân",
      opened_by_profile_id: toText(profileId) || null,
      opened_by_auth_user_id: toText(authUserId) || null,
      opening_cash: Math.max(0, Math.round(toNumber(openingCash, 0))),
      opening_note: toText(openingNote)
    };

    const { data, error } = await supabase
      .from("pos_shifts")
      .insert(payload)
      .select(POS_SHIFT_SELECT)
      .single();

    if (error) {
      return { ok: false, shift: null, message: error.message || "Không mở được ca POS." };
    }

    return {
      ok: true,
      shift: normalizeShift(data),
      reused: false,
      message: "Đã mở ca POS."
    };
  }

  const shift = {
    id: `SHIFT-${Date.now()}`,
    branchUuid: toText(branchUuid),
    branchName: toText(branchName),
    registerKey: toText(registerKey) || "main",
    status: "open",
    cashierName: toText(cashierName) || "Thu ngân",
    openingCash: Math.max(0, toNumber(openingCash, 0)),
    openingNote: toText(openingNote),
    openedAt: new Date().toISOString()
  };

  return {
    ok: true,
    shift,
    reused: false,
    message: "Đã mở ca POS."
  };
}

export async function fetchPosShiftSummary({ shiftId = "", openingCash = 0 } = {}) {
  const safeShiftId = toText(shiftId);
  const emptySummary = buildEmptyShiftSummary(openingCash);

  if (!safeShiftId) {
    return {
      ok: false,
      summary: emptySummary,
      message: "Thiếu mã ca POS."
    };
  }

  if (!supabase) {
    return {
      ok: true,
      summary: emptySummary,
      message: ""
    };
  }

  const [ordersResult, sessionsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,payment_method,total_amount,metadata,created_at,pos_shift_id")
      .eq("pos_shift_id", safeShiftId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
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

  const pendingQrCount = sessions.filter((session) =>
    ["draft", "pending_payment"].includes(toText(session.status).toLowerCase())
  ).length;
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
  closingNote = "",
  authUserId = ""
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

  if (!supabase) {
    return {
      ok: true,
      shift: {
        ...normalizedShift,
        status: "closed",
        closedAt: new Date().toISOString(),
        closingCashCounted: Math.max(0, Math.round(toNumber(closingCashCounted, 0))),
        closingNote: toText(closingNote)
      },
      message: "Đã kết ca POS."
    };
  }

  const safeSummary = getObject(summary);
  const countedCash = Math.max(0, Math.round(toNumber(closingCashCounted, 0)));
  const openingCashValue = Math.max(0, toNumber(normalizedShift.openingCash, 0));
  const cashTotal = Math.max(0, toNumber(safeSummary.cashTotal, 0));
  const expectedCash = Math.max(0, toNumber(safeSummary.expectedCash, openingCashValue + cashTotal));
  const closedAt = new Date().toISOString();
  const note = toText(closingNote);
  const payload = {
    status: "closed",
    closed_by_auth_user_id: toText(authUserId) || null,
    closing_cash_counted: countedCash,
    closing_cash_breakdown: {},
    closing_note: note,
    closed_at: closedAt,
    paid_order_count: Math.max(0, Math.round(toNumber(safeSummary.orderCount, 0))),
    cash_order_count: Math.max(0, Math.round(toNumber(safeSummary.cashOrderCount, 0))),
    qr_order_count: Math.max(0, Math.round(toNumber(safeSummary.qrOrderCount, 0))),
    cancelled_order_count: Math.max(0, Math.round(toNumber(safeSummary.cancelledOrderCount, 0))),
    cash_sales_snapshot: cashTotal,
    qr_sales_snapshot: Math.max(0, toNumber(safeSummary.qrTotal, 0)),
    cancelled_amount_snapshot: Math.max(0, toNumber(safeSummary.cancelledTotal, 0)),
    cash_refund_snapshot: 0,
    qr_refund_snapshot: 0,
    expected_cash_snapshot: expectedCash,
    cash_difference: countedCash - expectedCash,
    closing_summary: {
      ...safeSummary,
      openingCash: openingCashValue,
      closingCashCounted: countedCash,
      closingNote: note,
      expectedCash,
      cashDifference: countedCash - expectedCash,
      closedAt
    }
  };

  const { data, error } = await supabase
    .from("pos_shifts")
    .update(payload)
    .eq("id", shiftId)
    .eq("status", "open")
    .select(POS_SHIFT_SELECT)
    .single();

  if (error) {
    return {
      ok: false,
      shift: null,
      message: error.message || "Không kết được ca POS."
    };
  }

  return {
    ok: true,
    shift: normalizeShift(data),
    message: "Đã kết ca POS."
  };
}
