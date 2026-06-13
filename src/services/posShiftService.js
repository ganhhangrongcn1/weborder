const POS_ACTIVE_SHIFT_KEY = "ghr:pos-active-shift:v1";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStorageKey(branchValue = "") {
  return `${POS_ACTIVE_SHIFT_KEY}:${toText(branchValue) || "default"}`;
}

function buildShiftId(branchValue = "") {
  const branchPart = toText(branchValue).replace(/[^a-zA-Z0-9_-]/g, "").slice(-10) || "pos";
  return `SHIFT-${branchPart}-${Date.now()}`;
}

function normalizeShift(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const id = toText(raw.id || raw.shiftId);
  const branchValue = toText(raw.branchValue);
  const openedAt = toText(raw.openedAt);
  if (!id || !branchValue || !openedAt) return null;

  return {
    id,
    shiftId: id,
    branchValue,
    branchName: toText(raw.branchName),
    cashierName: toText(raw.cashierName),
    openingCash: Math.max(0, toNumber(raw.openingCash, 0)),
    openingNote: toText(raw.openingNote),
    openedAt,
    status: toText(raw.status) || "open"
  };
}

export function readActivePosShift(branchValue = "") {
  try {
    return normalizeShift(JSON.parse(localStorage.getItem(getStorageKey(branchValue)) || "null"));
  } catch {
    return null;
  }
}

export function openPosShift({
  branchValue = "",
  branchName = "",
  cashierName = "",
  openingCash = 0,
  openingNote = ""
} = {}) {
  const shift = normalizeShift({
    id: buildShiftId(branchValue),
    branchValue,
    branchName,
    cashierName,
    openingCash,
    openingNote,
    openedAt: new Date().toISOString(),
    status: "open"
  });

  if (!shift) {
    return {
      ok: false,
      message: "Không mở được ca POS. Vui lòng đăng nhập lại chi nhánh."
    };
  }

  localStorage.setItem(getStorageKey(branchValue), JSON.stringify(shift));
  return {
    ok: true,
    shift
  };
}

export function clearActivePosShift(branchValue = "") {
  localStorage.removeItem(getStorageKey(branchValue));
}

export function getPosShiftOrderStats(orders = [], shift = null) {
  const shiftId = toText(shift?.id || shift?.shiftId);
  const openingCash = Math.max(0, toNumber(shift?.openingCash, 0));
  const rows = (Array.isArray(orders) ? orders : []).filter((order) => {
    if (!shiftId) return false;
    const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
    return toText(order.shiftId || metadata.shiftId || metadata.shift_id) === shiftId;
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
