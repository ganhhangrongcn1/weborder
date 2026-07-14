import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

const SHIFT_SELECT = [
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
  "paid_order_count",
  "cash_order_count",
  "qr_order_count",
  "cancelled_order_count",
  "cash_sales_snapshot",
  "qr_sales_snapshot",
  "cancelled_amount_snapshot",
  "expected_cash_snapshot",
  "cash_difference",
  "closing_summary",
  "updated_at"
].join(",");

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST202"]);
const PERMISSION_ERROR_CODES = new Set(["42501"]);
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isMissingTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return MISSING_TABLE_CODES.has(code) || message.includes("could not find the table") || message.includes("does not exist");
}

function isPermissionError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return PERMISSION_ERROR_CODES.has(code) || message.includes("permission denied") || message.includes("row-level security");
}

function isMissingColumnError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return MISSING_COLUMN_CODES.has(code) || message.includes("could not find") || message.includes("column");
}

function getShiftReadErrorMessage(error) {
  if (isMissingTableError(error)) {
    return "Chưa bật dữ liệu ca POS. Cần chạy SQL tạo bảng pos_shifts trước.";
  }
  if (isPermissionError(error)) {
    return "Tài khoản admin hiện tại chưa có quyền đọc ca POS. Cần kiểm tra role/RLS của bảng pos_shifts.";
  }
  if (isMissingColumnError(error)) {
    return "Bảng pos_shifts chưa đủ cột cho màn Tổng quan ca. Cần chạy đủ SQL ca POS mới nhất.";
  }
  return error?.message || "Không tải được tổng quan ca.";
}

function isUuidLike(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(toText(value));
}

function normalizeShift(row = {}) {
  const closingSummary = getObject(row.closing_summary);
  const openingCash = toNumber(row.opening_cash, 0);
  const cashSales = toNumber(row.cash_sales_snapshot ?? closingSummary.cashTotal ?? closingSummary.cash_total, 0);
  const expectedCash = toNumber(
    row.expected_cash_snapshot ?? closingSummary.expectedCash ?? closingSummary.expected_cash,
    openingCash
  );
  const status = toText(row.status || "open").toLowerCase();
  const closingCashCounted = row.closing_cash_counted === null || row.closing_cash_counted === undefined
    ? null
    : toNumber(row.closing_cash_counted, 0);
  const cashDifference = row.cash_difference === null || row.cash_difference === undefined
    ? (closingCashCounted === null ? null : closingCashCounted - expectedCash)
    : toNumber(row.cash_difference, 0);
  return {
    id: toText(row.id),
    branchUuid: toText(row.branch_uuid),
    branchName: toText(row.branch_name),
    registerKey: toText(row.register_key || "main"),
    status,
    cashierName: toText(row.cashier_name),
    openingCash,
    openingNote: toText(row.opening_note),
    openedAt: toText(row.opened_at),
    closedAt: toText(row.closed_at),
    closingCashCounted,
    closingNote: toText(row.closing_note),
    paidOrderCount: Math.max(0, Math.round(toNumber(row.paid_order_count, 0))),
    cashOrderCount: Math.max(0, Math.round(toNumber(row.cash_order_count, 0))),
    qrOrderCount: Math.max(0, Math.round(toNumber(row.qr_order_count, 0))),
    cancelledOrderCount: Math.max(0, Math.round(toNumber(row.cancelled_order_count, 0))),
    cashSales,
    qrSales: toNumber(row.qr_sales_snapshot, 0),
    cancelledAmount: toNumber(row.cancelled_amount_snapshot, 0),
    expectedCash,
    cashDifference,
    closingSummary,
    updatedAt: toText(row.updated_at)
  };
}

export function getShiftHealth(shift = {}) {
  const isClosed = shift.status === "closed";
  const difference = shift.cashDifference;

  if (isClosed && Number.isFinite(difference) && difference < 0) {
    const missingAmount = Math.abs(difference);
    return {
      tone: "danger",
      label: "Thiếu tiền",
      note: `Thiếu ${missingAmount.toLocaleString("vi-VN")}đ`
    };
  }

  if (isClosed && Number.isFinite(difference)) {
    return {
      tone: "success",
      label: difference > 0 ? "Dư tiền" : "Đủ tiền",
      note: difference > 0
        ? `Dư ${difference.toLocaleString("vi-VN")}đ`
        : "Tiền thực đếm khớp với tiền phải có"
    };
  }

  return {
    tone: "neutral",
    label: "Đang mở",
    note: "Chưa có số tiền kết ca để so sánh"
  };
}

export async function readAdminShiftOverview({
  dateFrom = "",
  dateTo = "",
  branchUuid = "",
  limit = 80
} = {}) {
  const client =
    getSupabaseAdminAuthClient() ||
    (await initSupabaseAdminAuthClient()) ||
    getSupabaseRuntimeClient() ||
    (await initSupabaseRuntimeClient());
  if (!client) {
    return {
      ok: false,
      shifts: [],
      message: "Chưa kết nối được Supabase."
    };
  }

  let query = client
    .from("pos_shifts")
    .select(SHIFT_SELECT)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(Math.max(10, Math.min(200, Number(limit || 80))));

  if (dateFrom) query = query.gte("closed_at", dateFrom);
  if (dateTo) query = query.lt("closed_at", dateTo);
  if (branchUuid && branchUuid !== "all" && isUuidLike(branchUuid)) query = query.eq("branch_uuid", branchUuid);

  const { data, error } = await query;
  recordAdminRequest("read admin shift overview", "pos_shifts");

  if (error) {
    return {
      ok: false,
      shifts: [],
      message: getShiftReadErrorMessage(error)
    };
  }

  return {
    ok: true,
    shifts: (Array.isArray(data) ? data : []).map(normalizeShift),
    message: ""
  };
}

export default {
  readAdminShiftOverview,
  getShiftHealth
};
