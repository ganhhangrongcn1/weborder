import { buildPrintJobPayload } from "./printerService.js";
import {
  getSupabaseAdminAuthClient,
  getSupabaseKitchenAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseAdminAuthClient,
  initSupabaseKitchenAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { getCashBreakdownEntries, normalizeCashBreakdown } from "./posCashBreakdownService.js";

const PRINT_JOB_STATUS = {
  pending: "pending",
  printing: "printing",
  printed: "printed",
  failed: "failed"
};

const CUSTOMER_BILL_JOB_TYPE = "customer_bill";
const KITCHEN_TICKET_JOB_TYPE = "kitchen_ticket";
const DEFAULT_PRINTER_KEY = "cashier-80mm";
const DEFAULT_KITCHEN_PRINTER_KEY = "kitchen-80mm";
const POS_SHIFT_CLOSE_SOURCE_TYPE = "pos_shift_close";
const POS_PAYMENT_QR_SOURCE_TYPE = "pos_payment_qr";
const AUTO_PRINT_WINDOW_MINUTES = 5;
const AUTO_PRINT_EXPIRED_MESSAGE = "Lệnh in quá 5 phút. Bấm In lại nếu cần.";
const PRINT_JOB_STATUS_COLUMNS = [
  "id",
  "branch_uuid",
  "printer_key",
  "job_type",
  "status",
  "order_id",
  "order_code",
  "source_type",
  "requested_by",
  "requested_at",
  "claimed_by_device",
  "claimed_at",
  "printed_at",
  "failed_at",
  "error_message",
  "retry_count",
  "created_at",
  "updated_at"
].join(",");
const PRINT_JOB_COLUMNS = [
  PRINT_JOB_STATUS_COLUMNS,
  "payload"
].join(",");

function toText(value = "") {
  return String(value || "").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getOrderBranchUuid(order = {}, fallbackBranchUuid = "") {
  return toText(
    order.branchUuid ||
      order.deliveryBranchUuid ||
      order.pickupBranchUuid ||
      getObject(order.raw).branch_uuid ||
      getObject(order.raw).delivery_branch_uuid ||
      getObject(order.raw).pickup_branch_uuid ||
      fallbackBranchUuid
  );
}

function getOrderCode(order = {}) {
  return toText(order.displayOrderCode || order.orderCode || order.order_code || order.id);
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value = 0) {
  return `${Math.max(0, Math.round(toNumber(value))).toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value = "") {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function buildLine(char = "-", width = 42) {
  return char.repeat(width);
}

function alignReceiptLine(label = "", value = "", width = 42) {
  const left = toText(label);
  const right = toText(value);
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

function pushCashBreakdownLines(lines, title, breakdown, width) {
  const entries = getCashBreakdownEntries(breakdown);
  if (!entries.length) return;

  lines.push(buildLine("-", width));
  lines.push(title);
  entries.forEach((entry) => {
    lines.push(alignReceiptLine(`${entry.label} x ${entry.count}`, toMoney(entry.total), width));
  });
}

function buildPosQrReceiptText({
  branchName = "",
  amount = 0,
  transferContent = "",
  orderCode = "",
  customerName = ""
} = {}) {
  const width = 42;
  const lines = [
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:QUÉT MÃ THANH TOÁN",
    buildLine("-", width)
  ];

  if (branchName) lines.push(`Chi nhánh: ${toText(branchName)}`);
  if (orderCode) lines.push(`Mã bill: ${toText(orderCode)}`);
  if (customerName) lines.push(`Khách: ${toText(customerName)}`);

  lines.push(alignReceiptLine("Số tiền", toMoney(amount), width));
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Đưa mã này cho khách quét");
  lines.push("@@QR");
  lines.push(buildLine("-", width));
  lines.push(`Nội dung: ${toText(transferContent)}`);
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Cảm ơn quý khách!");
  return lines.join("\n");
}

function _buildPosShiftCloseReceiptText({
  shift = {},
  summary = {},
  closingCashCounted = 0,
  closingCashBreakdown = null,
  closingNote = ""
} = {}) {
  const width = 42;
  const expectedCash = toNumber(summary.expectedCash ?? shift.expectedCashSnapshot ?? 0);
  const _openingBreakdown = normalizeCashBreakdown(
    shift.openingCashBreakdown ||
    shift.opening_cash_breakdown ||
    summary.openingCashBreakdown
  );
  const _closingBreakdown = normalizeCashBreakdown(
    closingCashBreakdown ||
    shift.closingCashBreakdown ||
    shift.closing_cash_breakdown ||
    summary.closingCashBreakdown
  );
  const countedCash = toNumber(closingCashCounted ?? shift.closingCashCounted ?? 0);
  const difference = countedCash - expectedCash;
  const shortShiftId = toText(shift.id || shift.shiftId).slice(0, 8).toUpperCase();
  const lines = [
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:PHIẾU KẾT CA",
    `@@BIG:${shortShiftId || "POS"}`,
    buildLine("-", width),
    `Chi nhánh: ${toText(shift.branchName) || "POS"}`,
    `Thu ngân: ${toText(shift.cashierName) || "Thu ngân"}`,
    `Mở ca: ${formatDateTime(shift.openedAt)}`,
    `Kết ca: ${formatDateTime(shift.closedAt || new Date().toISOString())}`,
    buildLine("-", width),
    alignReceiptLine("Tiền đầu ca", toMoney(shift.openingCash), width),
    alignReceiptLine("Tiền mặt đã thu", toMoney(summary.cashTotal || shift.cashSalesSnapshot), width),
    alignReceiptLine("QR đã thu", toMoney(summary.qrTotal || shift.qrSalesSnapshot), width),
    alignReceiptLine("Dự kiến trong két", toMoney(expectedCash), width),
    alignReceiptLine("Thực đếm", toMoney(countedCash), width),
    alignReceiptLine(
      difference === 0 ? "Chênh lệch" : difference > 0 ? "Thừa tiền" : "Thiếu tiền",
      `${difference < 0 ? "-" : ""}${toMoney(Math.abs(difference))}`,
      width
    ),
    buildLine("-", width),
    alignReceiptLine("Tổng đơn", `${Math.max(0, Math.round(toNumber(summary.orderCount || shift.paidOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn tiền mặt", `${Math.max(0, Math.round(toNumber(summary.cashOrderCount || shift.cashOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn QR", `${Math.max(0, Math.round(toNumber(summary.qrOrderCount || shift.qrOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn hủy", `${Math.max(0, Math.round(toNumber(summary.cancelledOrderCount || shift.cancelledOrderCount)))} đơn`, width)
  ];

  const note = toText(closingNote || shift.closingNote);
  if (note) {
    lines.push(buildLine("-", width));
    lines.push(`Ghi chú: ${note}`);
  }

  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Nhân viên ký");
  lines.push("");
  lines.push("");
  lines.push("@@CENTER:____________________");
  return lines.join("\n");
}

async function getClient() {
  return (
    getSupabaseAdminAuthClient() ||
    getSupabaseKitchenAuthClient() ||
    (await initSupabaseAdminAuthClient()) ||
    (await initSupabaseKitchenAuthClient()) ||
    getSupabaseRuntimeClient() ||
    (await initSupabaseRuntimeClient())
  );
}

export function getPrintDeviceId() {
  try {
    const storageKey = "ghr:print-device-id:v1";
    const saved = window.localStorage.getItem(storageKey);
    if (saved) return saved;

    const nextId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(storageKey, nextId);
    return nextId;
  } catch {
    return `pos-${Date.now()}`;
  }
}

function getAutoPrintCutoffIso() {
  return new Date(Date.now() - AUTO_PRINT_WINDOW_MINUTES * 60 * 1000).toISOString();
}

function isPrintJobFresh(job = {}) {
  const value = toText(job.created_at || job.requested_at);
  if (!value) return true;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return true;

  return timestamp >= Date.now() - AUTO_PRINT_WINDOW_MINUTES * 60 * 1000;
}

export function buildCustomerBillPrintPayload(order = {}, printerOptions = {}) {
  return buildPrintJobPayload(order, printerOptions);
}

async function findExistingCustomerBillPrintJob(client, row = {}) {
  const comparableKeys = [
    { column: "order_id", value: row.order_id },
    { column: "order_code", value: row.order_code }
  ].filter((item, index, list) => (
    item.value && list.findIndex((candidate) => candidate.value === item.value) === index
  ));

  for (const key of comparableKeys) {
    let query = client
      .from("print_jobs")
      .select(PRINT_JOB_STATUS_COLUMNS)
      .eq("job_type", row.job_type || CUSTOMER_BILL_JOB_TYPE)
      .eq("printer_key", row.printer_key || DEFAULT_PRINTER_KEY)
      .eq(key.column, key.value)
      .in("status", [
        PRINT_JOB_STATUS.pending,
        PRINT_JOB_STATUS.printing
      ])
      .order("created_at", { ascending: false })
      .limit(1);

    if (row.branch_uuid) query = query.eq("branch_uuid", row.branch_uuid);

    const { data, error } = await query;
    if (error) {
      console.warn("[printJobService] check existing print job failed", error);
      continue;
    }

    if (Array.isArray(data) && data[0]) return data[0];
  }

  return null;
}

export async function createCustomerBillPrintJob(order = {}, options = {}) {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase để gửi lệnh in."
    };
  }

  const now = new Date().toISOString();
  const row = {
    branch_uuid: getOrderBranchUuid(order, options.branchUuid),
    printer_key: toText(options.printerKey || DEFAULT_PRINTER_KEY),
    job_type: toText(options.jobType || CUSTOMER_BILL_JOB_TYPE),
    status: PRINT_JOB_STATUS.pending,
    order_id: toText(order.id),
    order_code: getOrderCode(order),
    source_type: toText(order.sourceType || order.source || ""),
    payload: buildCustomerBillPrintPayload(order, options.printerOptions || {}),
    requested_by: toText(options.requestedBy),
    requested_at: now,
    created_at: now,
    updated_at: now
  };

  const existingJob = await findExistingCustomerBillPrintJob(client, row);
  if (existingJob) {
    return {
      ok: true,
      job: existingJob,
      message: "Bill đang có lệnh in, không tạo trùng."
    };
  }

  const { data, error } = await client
    .from("print_jobs")
    .insert(row)
    .select(PRINT_JOB_STATUS_COLUMNS)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      message: error.message || "Không tạo được lệnh in bill."
    };
  }

  return {
    ok: true,
    job: data || null,
    message: "Đã gửi lệnh in bill tới máy POS."
  };
}

function buildPosShiftCloseReceiptTextV2({
  shift = {},
  summary = {},
  closingCashCounted = 0,
  closingCashBreakdown = null,
  closingNote = ""
} = {}) {
  const width = 42;
  const expectedCash = toNumber(summary.expectedCash ?? shift.expectedCashSnapshot ?? 0);
  const openingBreakdown = normalizeCashBreakdown(
    shift.openingCashBreakdown ||
    shift.opening_cash_breakdown ||
    summary.openingCashBreakdown
  );
  const closingBreakdown = normalizeCashBreakdown(
    closingCashBreakdown ||
    shift.closingCashBreakdown ||
    shift.closing_cash_breakdown ||
    summary.closingCashBreakdown
  );
  const countedCash = toNumber(closingCashCounted ?? shift.closingCashCounted ?? 0);
  const difference = countedCash - expectedCash;
  const shortShiftId = toText(shift.id || shift.shiftId).slice(0, 8).toUpperCase();
  const lines = [
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:PHIẾU KẾT CA",
    `@@BIG:${shortShiftId || "POS"}`,
    buildLine("-", width),
    `Chi nhánh: ${toText(shift.branchName) || "POS"}`,
    `Thu ngân: ${toText(shift.cashierName) || "Thu ngân"}`,
    `Mở ca: ${formatDateTime(shift.openedAt)}`,
    `Kết ca: ${formatDateTime(shift.closedAt || new Date().toISOString())}`,
    buildLine("-", width),
    alignReceiptLine("Tiền đầu ca", toMoney(shift.openingCash), width),
    alignReceiptLine("Tiền mặt đã thu", toMoney(summary.cashTotal || shift.cashSalesSnapshot), width),
    alignReceiptLine("Chuyển khoản", toMoney(summary.qrTotal || shift.qrSalesSnapshot), width),
    alignReceiptLine("Dự kiến trong két", toMoney(expectedCash), width),
    alignReceiptLine("Thực đếm", toMoney(countedCash), width),
    alignReceiptLine(
      difference === 0 ? "Chênh lệch" : difference > 0 ? "Thừa tiền" : "Thiếu tiền",
      `${difference < 0 ? "-" : ""}${toMoney(Math.abs(difference))}`,
      width
    ),
    buildLine("-", width),
    alignReceiptLine("Tổng đơn", `${Math.max(0, Math.round(toNumber(summary.orderCount || shift.paidOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn tiền mặt", `${Math.max(0, Math.round(toNumber(summary.cashOrderCount || shift.cashOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn chuyển khoản", `${Math.max(0, Math.round(toNumber(summary.qrOrderCount || shift.qrOrderCount)))} đơn`, width),
    alignReceiptLine("Đơn hủy", `${Math.max(0, Math.round(toNumber(summary.cancelledOrderCount || shift.cancelledOrderCount)))} đơn`, width)
  ];

  pushCashBreakdownLines(lines, "Cơ cấu tiền đầu ca", openingBreakdown, width);
  pushCashBreakdownLines(lines, "Cơ cấu tiền cuối ca", closingBreakdown, width);

  const note = toText(closingNote || shift.closingNote);
  if (note) {
    lines.push(buildLine("-", width));
    lines.push(`Ghi chú: ${note}`);
  }

  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Nhân viên ký");
  lines.push("");
  lines.push("");
  lines.push("@@CENTER:____________________");
  return lines.join("\n");
}

export async function createPosShiftClosePrintJob({
  shift = {},
  summary = {},
  closingCashCounted = 0,
  closingCashBreakdown = null,
  closingNote = ""
} = {}, options = {}) {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase để gửi lệnh in."
    };
  }

  const now = new Date().toISOString();
  const shiftId = toText(shift.id || shift.shiftId);
  const shiftCode = toText(shiftId).slice(0, 8).toUpperCase();
  const row = {
    branch_uuid: toText(shift.branchUuid || shift.branch_uuid || options.branchUuid),
    printer_key: toText(options.printerKey || DEFAULT_PRINTER_KEY),
    job_type: CUSTOMER_BILL_JOB_TYPE,
    status: PRINT_JOB_STATUS.pending,
    order_id: null,
    order_code: `SHIFT-${shiftCode || Date.now()}`,
    source_type: POS_SHIFT_CLOSE_SOURCE_TYPE,
    payload: {
      printerName: toText(options.printerName),
      receiptWidthMm: Number(options.receiptWidthMm || 80),
      type: POS_SHIFT_CLOSE_SOURCE_TYPE,
      text: buildPosShiftCloseReceiptTextV2({
        shift,
        summary,
        closingCashCounted,
        closingCashBreakdown,
        closingNote
      }),
      order: {
        id: shiftId,
        orderCode: `SHIFT-${shiftCode}`,
        sourceType: POS_SHIFT_CLOSE_SOURCE_TYPE,
        branchName: toText(shift.branchName || shift.branch_name),
        customerName: "Kết ca POS",
        createdAt: now,
        items: [],
        totalAmount: 0
      }
    },
    requested_by: toText(options.requestedBy || shift.cashierName || shift.cashier_name),
    requested_at: now,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await client
    .from("print_jobs")
    .insert(row)
    .select(PRINT_JOB_STATUS_COLUMNS)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      message: error.message || "Không tạo được lệnh in phiếu kết ca."
    };
  }

  return {
    ok: true,
    job: data || null,
    message: "Đã gửi lệnh in phiếu kết ca tới máy POS."
  };
}

export async function createPosQrPrintJob({
  branch = null,
  amount = 0,
  qrUrl = "",
  transferContent = "",
  orderCode = "",
  customerName = ""
} = {}, options = {}) {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase để gửi lệnh in QR."
    };
  }

  const safeQrUrl = toText(qrUrl);
  if (!safeQrUrl) {
    return {
      ok: false,
      message: "Chưa tạo được mã QR để in."
    };
  }

  const now = new Date().toISOString();
  const branchUuid = toText(branch?.id || branch?.branch_uuid || options.branchUuid);
  const branchName = toText(branch?.name || branch?.branchName || options.branchName);
  const safeOrderCode = toText(orderCode || transferContent || `QR-${Date.now()}`);
  const row = {
    branch_uuid: branchUuid,
    printer_key: toText(options.printerKey || DEFAULT_PRINTER_KEY),
    job_type: CUSTOMER_BILL_JOB_TYPE,
    status: PRINT_JOB_STATUS.pending,
    order_id: null,
    order_code: safeOrderCode,
    source_type: POS_PAYMENT_QR_SOURCE_TYPE,
    payload: {
      printerName: toText(options.printerName),
      receiptWidthMm: Number(options.receiptWidthMm || 80),
      type: POS_PAYMENT_QR_SOURCE_TYPE,
      text: buildPosQrReceiptText({
        branchName,
        amount,
        transferContent,
        orderCode: safeOrderCode,
        customerName
      }),
      loyaltyUrl: safeQrUrl,
      order: {
        id: "",
        orderCode: safeOrderCode,
        sourceType: POS_PAYMENT_QR_SOURCE_TYPE,
        branchName,
        customerName: toText(customerName || "QR thanh toán"),
        createdAt: now,
        items: [],
        totalAmount: Math.max(0, Math.round(toNumber(amount)))
      }
    },
    requested_by: toText(options.requestedBy),
    requested_at: now,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await client
    .from("print_jobs")
    .insert(row)
    .select(PRINT_JOB_STATUS_COLUMNS)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      message: error.message || "Không tạo được lệnh in QR."
    };
  }

  return {
    ok: true,
    job: data || null,
    message: "Đã gửi lệnh in QR tới máy POS."
  };
}

export async function readRecentPrintJobs(options = {}) {
  const client = await getClient();
  if (!client) return [];

  let query = client
    .from("print_jobs")
    .select(PRINT_JOB_STATUS_COLUMNS)
    .eq("job_type", toText(options.jobType || CUSTOMER_BILL_JOB_TYPE))
    .eq("printer_key", toText(options.printerKey || DEFAULT_PRINTER_KEY))
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(Number(options.limit || 80), 200)));

  const branchUuid = toText(options.branchUuid);
  if (branchUuid) query = query.eq("branch_uuid", branchUuid);

  const { data, error } = await query;
  if (error) {
    console.warn("[printJobService] read recent print jobs failed", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function readPendingPrintJobs(options = {}) {
  const client = await getClient();
  if (!client) return [];

  const branchUuid = toText(options.branchUuid);
  await markExpiredPendingPrintJobs({
    branchUuid,
    printerKey: options.printerKey,
    jobType: options.jobType
  });

  let query = client
    .from("print_jobs")
    .select(PRINT_JOB_COLUMNS)
    .eq("status", PRINT_JOB_STATUS.pending)
    .eq("job_type", toText(options.jobType || CUSTOMER_BILL_JOB_TYPE))
    .eq("printer_key", toText(options.printerKey || DEFAULT_PRINTER_KEY))
    .gte("created_at", getAutoPrintCutoffIso())
    .order("created_at", { ascending: true })
    .limit(20);

  if (branchUuid) query = query.eq("branch_uuid", branchUuid);

  const { data, error } = await query;
  if (error) {
    console.warn("[printJobService] read pending print jobs failed", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function claimPrintJob(job = {}, options = {}) {
  const client = await getClient();
  if (!client || !job?.id) return null;

  if (!isPrintJobFresh(job)) {
    await markPrintJobAutoExpired(job);
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("print_jobs")
    .update({
      status: PRINT_JOB_STATUS.printing,
      claimed_by_device: toText(options.deviceId || getPrintDeviceId()),
      claimed_at: now,
      updated_at: now
    })
    .eq("id", job.id)
    .eq("status", PRINT_JOB_STATUS.pending)
    .gte("created_at", getAutoPrintCutoffIso())
    .select(PRINT_JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    console.warn("[printJobService] claim print job failed", error);
    return null;
  }

  return data || null;
}

export async function markPrintJobPrinted(job = {}) {
  const client = await getClient();
  if (!client || !job?.id) return;

  const now = new Date().toISOString();
  const { error } = await client
    .from("print_jobs")
    .update({
      status: PRINT_JOB_STATUS.printed,
      printed_at: now,
      failed_at: null,
      error_message: null,
      updated_at: now
    })
    .eq("id", job.id);

  if (error) console.warn("[printJobService] mark printed failed", error);
}

export async function markPrintJobFailed(job = {}, message = "") {
  const client = await getClient();
  if (!client || !job?.id) return;

  const now = new Date().toISOString();
  const retryCount = Number(job.retry_count || 0) + 1;
  const { error } = await client
    .from("print_jobs")
    .update({
      status: PRINT_JOB_STATUS.failed,
      failed_at: now,
      error_message: toText(message || "Không in được bill."),
      retry_count: retryCount,
      updated_at: now
    })
    .eq("id", job.id);

  if (error) console.warn("[printJobService] mark failed failed", error);
}

export async function markPrintJobAutoExpired(job = {}) {
  const client = await getClient();
  if (!client || !job?.id) return;

  const now = new Date().toISOString();
  const { error } = await client
    .from("print_jobs")
    .update({
      status: PRINT_JOB_STATUS.failed,
      failed_at: now,
      error_message: AUTO_PRINT_EXPIRED_MESSAGE,
      updated_at: now
    })
    .eq("id", job.id)
    .eq("status", PRINT_JOB_STATUS.pending);

  if (error) console.warn("[printJobService] mark auto-expired failed", error);
}

export async function markExpiredPendingPrintJobs(options = {}) {
  const client = await getClient();
  if (!client) return;

  const now = new Date().toISOString();
  let query = client
    .from("print_jobs")
    .update({
      status: PRINT_JOB_STATUS.failed,
      failed_at: now,
      error_message: AUTO_PRINT_EXPIRED_MESSAGE,
      updated_at: now
    })
    .eq("status", PRINT_JOB_STATUS.pending)
    .eq("job_type", toText(options.jobType || CUSTOMER_BILL_JOB_TYPE))
    .eq("printer_key", toText(options.printerKey || DEFAULT_PRINTER_KEY))
    .lt("created_at", getAutoPrintCutoffIso());

  const branchUuid = toText(options.branchUuid);
  if (branchUuid) query = query.eq("branch_uuid", branchUuid);

  const { error } = await query;
  if (error) console.warn("[printJobService] mark expired pending jobs failed", error);
}

export async function subscribePrintJobs(options = {}) {
  const client = await getClient();
  if (!client || typeof options.onPendingJob !== "function") return () => {};

  const channel = client
    .channel(`print-jobs-${toText(options.deviceId || getPrintDeviceId())}-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "print_jobs" },
      (payload) => {
        const job = payload?.new || {};
        const branchUuid = toText(options.branchUuid);
        const printerKey = toText(options.printerKey || DEFAULT_PRINTER_KEY);
        const jobType = toText(options.jobType || CUSTOMER_BILL_JOB_TYPE);
        if (toText(job.status) !== PRINT_JOB_STATUS.pending) return;
        if (toText(job.job_type || CUSTOMER_BILL_JOB_TYPE) !== jobType) return;
        if (printerKey && toText(job.printer_key || DEFAULT_PRINTER_KEY) !== printerKey) return;
        if (branchUuid && toText(job.branch_uuid) !== branchUuid) return;
        if (!isPrintJobFresh(job)) {
          markPrintJobAutoExpired(job);
          return;
        }
        options.onPendingJob(job);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export async function subscribePrintJobChanges(options = {}) {
  const client = await getClient();
  if (!client || typeof options.onJobChange !== "function") return () => {};

  const channel = client
    .channel(`print-job-status-${toText(options.deviceId || getPrintDeviceId())}-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "print_jobs" },
      (payload) => {
        const job = payload?.new || {};
        const branchUuid = toText(options.branchUuid);
        const printerKey = toText(options.printerKey || DEFAULT_PRINTER_KEY);
        const jobType = toText(options.jobType || CUSTOMER_BILL_JOB_TYPE);
        if (toText(job.job_type || CUSTOMER_BILL_JOB_TYPE) !== jobType) return;
        if (printerKey && toText(job.printer_key || DEFAULT_PRINTER_KEY) !== printerKey) return;
        if (branchUuid && toText(job.branch_uuid) !== branchUuid) return;
        options.onJobChange(job, payload);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export {
  CUSTOMER_BILL_JOB_TYPE,
  DEFAULT_KITCHEN_PRINTER_KEY,
  DEFAULT_PRINTER_KEY,
  KITCHEN_TICKET_JOB_TYPE,
  PRINT_JOB_STATUS
};
