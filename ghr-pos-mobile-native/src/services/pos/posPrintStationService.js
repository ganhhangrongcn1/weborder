import { AppState } from "react-native";

import { supabase } from "../supabase/client";
import {
  buildReceiptFooterQrUrl,
  buildPosCustomerBillText,
  playLocalNewOrderAlert,
  playLocalQrPaymentAlert,
  printLocalReceipt
} from "./posPrinterService";

const CUSTOMER_BILL_JOB_TYPE = "customer_bill";
const ITEM_LABEL_JOB_TYPE = "item_label";
const JOB_TYPES = [CUSTOMER_BILL_JOB_TYPE, ITEM_LABEL_JOB_TYPE];
const PRINTER_KEY = "cashier-80mm";
const POLL_INTERVAL_MS = 30000;
const EXPIRED_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const AUTO_PRINT_WINDOW_MS = 5 * 60 * 1000;
const MAX_JOBS_PER_POLL = 3;
const ALERT_GROUP_WINDOW_MS = 6500;
const NEW_ORDER_ALERT_GRACE_MS = 900;
const QR_CUSTOMER_BILL_PRINT_DELAY_MS = 1500;
const PRINT_RECEIPT_TIMEOUT_MS = 45 * 1000;
const EXPIRED_MESSAGE = "Lệnh in quá 5 phút. Bấm In lại nếu cần.";
const NO_FOOTER_SOURCE_TYPES = new Set([
  "pos_payment_qr",
  "pickup_order_payment_qr",
  "delivery_order_payment_qr",
  "qr_order_preparation",
  "qr_order_bundle",
  "pos_shift_close",
  ITEM_LABEL_JOB_TYPE
]);
const POS_ORDER_SOURCE_TYPES = new Set(["pos", "pos_mobile", "posmobile", "counter", "tai_quay"]);
const REMOTE_ORDER_SOURCE_TYPES = new Set(["web", "website", "qr_order", "customer_qr", "qr_tai_quay"]);
const PARTNER_ORDER_SOURCE_TYPES = new Set([
  "partner",
  "partner_order",
  "foodapp",
  "food_app",
  "grab",
  "grabfood",
  "shopee",
  "shopeefood",
  "xanh",
  "xanhngon",
  "nexpos"
]);
const DEFAULT_FOOTER_TEXT = [
  "@@RULE",
  "@@BOLDCENTER:ĐỪNG BỎ LỠ ĐIỂM CỦA ĐƠN NÀY",
  "@@QR",
  "@@CENTER:Quét QR để tích 10 - 15% giá trị đơn",
  "@@CENTER:ganhhangrong.vn",
  "@@CENTER:Hotline: 0933799061",
  "@@CENTER:Cảm ơn quý khách!"
].join("\n");
const recentAlertByOrderKey = new Map();
const expiredCleanupStateByBranch = new Map();

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSourceToken(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function wait(ms = 0) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, Math.max(0, Number(ms || 0)));
  });
}

function pruneRecentAlerts(now = Date.now()) {
  for (const [key, entry] of recentAlertByOrderKey.entries()) {
    if (!entry?.at || now - entry.at > ALERT_GROUP_WINDOW_MS * 2) {
      recentAlertByOrderKey.delete(key);
    }
  }
}

function buildAlertKey(job = {}, payload = {}) {
  const order = getObject(payload.order);
  return normalizeSourceToken(
    job.order_code ||
      order.orderCode ||
      order.order_code ||
      order.displayOrderCode ||
      order.display_order_code ||
      order.id ||
      job.id
  );
}

function isQrPaymentPrintPayload(payload = {}, sourceType = "") {
  const order = getObject(payload.order);
  const method = normalizeSourceToken(
    payload.paymentMethod ||
      payload.payment_method ||
      order.paymentMethod ||
      order.payment_method
  );
  return sourceType === "qr_order" ||
    method.includes("qr") ||
    method.includes("bank") ||
    Boolean(toText(order.paymentReference || order.payment_reference || payload.paymentReference || payload.payment_reference));
}

function isPosOrderPrintJob(job = {}) {
  const payload = getObject(job.payload);
  const order = getObject(payload.order);
  const orderCode = toText(job.order_code || order.orderCode || order.order_code);
  if (orderCode.toUpperCase().startsWith("POS-")) return true;

  const sourceTokens = [
    job.source_type,
    payload.sourceType,
    payload.source,
    payload.channel,
    payload.orderSource,
    payload.platform,
    order.sourceType,
    order.source,
    order.channel,
    order.orderSource,
    order.platform
  ].map(normalizeSourceToken).filter(Boolean);

  if (sourceTokens.some((token) => REMOTE_ORDER_SOURCE_TYPES.has(token) || token.includes("qr_order"))) {
    return false;
  }

  return sourceTokens.some((token) => (
    POS_ORDER_SOURCE_TYPES.has(token) ||
    token.includes("pos") ||
    token.includes("tai_quay")
  ));
}

function isPartnerOrderPrintJob(job = {}) {
  const payload = getObject(job.payload);
  const order = getObject(payload.order);
  const receiptText = normalizeSourceToken(payload.text);
  const sourceTokens = [
    job.source_type,
    payload.sourceType,
    payload.source,
    payload.channel,
    payload.orderSource,
    payload.platform,
    order.sourceType,
    order.source,
    order.channel,
    order.orderSource,
    order.platform,
    order.partnerSource
  ].map(normalizeSourceToken).filter(Boolean);

  return sourceTokens.some((token) => (
    PARTNER_ORDER_SOURCE_TYPES.has(token) ||
    token.includes("grab") ||
    token.includes("shopee") ||
    token.includes("xanhngon") ||
    token.includes("nexpos") ||
    token.includes("foodapp") ||
    token.includes("food_app")
  )) || ["nguon_grab", "nguon_shopee", "nguon_xanh", "nguon_foodapp", "nguon_doi_tac"]
    .some((marker) => receiptText.includes(marker));
}

function buildPartnerReceiptText(receiptText = "", order = {}) {
  const lines = toText(receiptText).split("\n");
  const orderCodeIndex = lines.findIndex((line) => line.startsWith("@@BIG:"));
  const firstItemIndex = lines.findIndex((line) => line.startsWith("@@BOLDROW:"));
  if (orderCodeIndex < 0) return toText(receiptText);

  const headerLines = lines.slice(0, orderCodeIndex + 1);
  const itemLines = firstItemIndex >= 0
    ? lines.slice(firstItemIndex)
    : lines.slice(orderCodeIndex + 1).filter((line) => (
        line !== "@@RULE" &&
        !line.startsWith("Chi nhánh:") &&
        !line.startsWith("Nguồn:") &&
        !line.startsWith("Giờ:") &&
        !line.startsWith("Khách:") &&
        line !== "@@SPACE"
      ));
  const oldPromptIndex = itemLines.findIndex((line) => (
    line.includes("ĐỪNG BỎ LỠ ĐIỂM") || line.includes("@@QR")
  ));
  const cleanItemLines = (oldPromptIndex >= 0 ? itemLines.slice(0, oldPromptIndex) : itemLines)
    .filter((line, index, list) => !(
      index === list.length - 1 && line === "@@RULE"
    ));

  const expectedEarnPoints = Math.max(0, Math.floor(toNumber(
    order.expectedEarnPoints ?? order.expected_earn_points
  )));
  const promptLines = [
    "@@RULE",
    "@@BOLDCENTER:ĐỪNG BỎ LỠ ĐIỂM CỦA ĐƠN NÀY",
    "@@QR",
    expectedEarnPoints > 0
      ? `@@BOLDCENTER:Quét để nhận ${expectedEarnPoints.toLocaleString("vi-VN")} của đơn này`
      : "@@BOLDCENTER:Quét để nhận tích lũy của đơn này",
    "@@CENTER:ganhhangrong.vn",
    "@@CENTER:Hotline: 0933799061",
    "@@RULE",
    ...(toText(order.customerName || order.customer_name)
      ? [`Khách: ${toText(order.customerName || order.customer_name)}`]
      : []),
    ...(toText(order.customerPhone || order.customer_phone)
      ? [`SĐT: ${toText(order.customerPhone || order.customer_phone)}`]
      : []),
    ...(toText(order.customerAddress || order.customer_address)
      ? [`Địa chỉ: ${toText(order.customerAddress || order.customer_address)}`]
      : [])
  ];

  return [
    ...headerLines,
    ...promptLines,
    ...cleanItemLines,
    "@@RULE",
    "@@CENTER:Cảm ơn quý khách!"
  ].join("\n");
}

async function hydratePartnerPrintJob(job = {}) {
  if (!isPartnerOrderPrintJob(job) || !supabase) return job;
  const payload = getObject(job.payload);
  const order = getObject(payload.order);
  const orderId = toText(job.order_id || order.id);
  const orderCode = toText(job.order_code || order.displayOrderCode || order.orderCode);
  const columns = "id,customer_name,customer_phone,expected_earn_points,raw_data";
  let result = orderId
    ? await supabase.from("partner_orders").select(columns).eq("id", orderId).maybeSingle()
    : { data: null, error: null };
  if (!result.data && orderCode) {
    result = await supabase
      .from("partner_orders")
      .select(columns)
      .eq("display_order_code", orderCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (!result.data && orderCode) {
    result = await supabase
      .from("partner_orders")
      .select(columns)
      .eq("order_code", orderCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  const { data, error } = result;
  if (error || !data) return job;

  const rawData = getObject(data.raw_data);
  return {
    ...job,
    payload: {
      ...payload,
      order: {
        ...order,
        id: toText(order.id || data.id),
        customerName: toText(order.customerName || order.customer_name || data.customer_name),
        customerPhone: toText(order.customerPhone || order.customer_phone || data.customer_phone),
        customerAddress: toText(order.customerAddress || order.customer_address || rawData.customer_address),
        expectedEarnPoints: Math.max(0, Math.floor(toNumber(data.expected_earn_points, 0)))
      }
    }
  };
}

function getCutoffIso() {
  return new Date(Date.now() - AUTO_PRINT_WINDOW_MS).toISOString();
}

function isFreshJob(job = {}) {
  const timestamp = new Date(job.created_at || job.requested_at || "").getTime();
  return Number.isFinite(timestamp) && timestamp >= Date.now() - AUTO_PRINT_WINDOW_MS;
}

function isSupportedPrintJob(job = {}) {
  return JOB_TYPES.includes(toText(job.job_type));
}

function getPrintJobPriority(job = {}) {
  return toText(job.job_type) === CUSTOMER_BILL_JOB_TYPE ? 0 : 1;
}

async function expireOldPendingJobs(branchUuid) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("print_jobs")
    .update({
      status: "failed",
      failed_at: now,
      error_message: EXPIRED_MESSAGE,
      updated_at: now
    })
    .eq("branch_uuid", branchUuid)
    .in("job_type", JOB_TYPES)
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .lt("created_at", getCutoffIso());

  if (error) throw error;
}

async function maybeExpireOldPendingJobs(branchUuid) {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return;

  const currentState = expiredCleanupStateByBranch.get(safeBranchUuid) || {
    lastRunAt: 0,
    inFlight: null
  };
  if (currentState.inFlight) {
    await currentState.inFlight;
    return;
  }
  if (Date.now() - currentState.lastRunAt < EXPIRED_CLEANUP_INTERVAL_MS) return;

  const cleanupTask = expireOldPendingJobs(safeBranchUuid);
  expiredCleanupStateByBranch.set(safeBranchUuid, {
    ...currentState,
    inFlight: cleanupTask
  });

  try {
    await cleanupTask;
    expiredCleanupStateByBranch.set(safeBranchUuid, {
      lastRunAt: Date.now(),
      inFlight: null
    });
  } catch (error) {
    expiredCleanupStateByBranch.set(safeBranchUuid, {
      lastRunAt: currentState.lastRunAt,
      inFlight: null
    });
    throw error;
  }
}

async function readPendingJobs(branchUuid) {
  await maybeExpireOldPendingJobs(branchUuid);
  const { data, error } = await supabase
    .from("print_jobs")
    .select("id,branch_uuid,printer_key,job_type,status,order_id,order_code,source_type,payload,retry_count,created_at,requested_at")
    .eq("branch_uuid", branchUuid)
    .in("job_type", JOB_TYPES)
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .gte("created_at", getCutoffIso())
    .order("job_type", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_POLL);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function claimJob(job, branchUuid, deviceId) {
  if (!job?.id || !isFreshJob(job)) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("print_jobs")
    .update({
      status: "printing",
      claimed_by_device: deviceId,
      claimed_at: now,
      updated_at: now
    })
    .eq("id", job.id)
    .eq("branch_uuid", branchUuid)
    .eq("job_type", toText(job.job_type))
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .gte("created_at", getCutoffIso())
    .select("id,job_type,order_id,order_code,source_type,payload,retry_count")
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function markPrinted(jobId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("print_jobs")
    .update({
      status: "printed",
      printed_at: now,
      failed_at: null,
      error_message: null,
      updated_at: now
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function markFailed(job, message) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("print_jobs")
    .update({
      status: "failed",
      failed_at: now,
      error_message: toText(message || "Không in được bill."),
      retry_count: Number(job?.retry_count || 0) + 1,
      updated_at: now
    })
    .eq("id", job.id);

  if (error) throw error;
}

function buildPrintPayload(job = {}) {
  const payload = getObject(job.payload);
  const sourceType = normalizeSourceToken(job.source_type || payload.type || payload.sourceType);
  const isItemLabel = toText(job.job_type) === ITEM_LABEL_JOB_TYPE || sourceType === ITEM_LABEL_JOB_TYPE;
  const order = getObject(payload.order);
  const payloadText = toText(payload.text);
  const secondaryText = toText(payload.secondaryText);
  const paymentStatus = normalizeSourceToken(order.paymentStatus || order.payment_status);
  const paidAt = toText(order.paidAt || order.paid_at);
  const legacyUnpaidReceipt =
    REMOTE_ORDER_SOURCE_TYPES.has(sourceType) &&
    (payloadText.includes("TỔNG CẦN THU") || payloadText.includes("CHƯA THANH TOÁN"));
  const shouldBuildPreparationTicket =
    !isItemLabel &&
    !paidAt &&
    (["unpaid", "pending", "pendingpayment"].includes(paymentStatus) || legacyUnpaidReceipt);
  const generatedText = shouldBuildPreparationTicket
    ? buildReceiptTextFromOrder(order, sourceType)
    : "";
  const originalText = generatedText || payloadText || buildReceiptTextFromOrder(order, sourceType);
  const isPartnerReceipt = isPartnerOrderPrintJob(job);
  const text = isPartnerReceipt ? buildPartnerReceiptText(originalText, order) : originalText;
  const isPreparationTicket = text.includes("@@CENTER:PHIẾU LÀM MÓN");
  const skipFooter = isItemLabel || NO_FOOTER_SOURCE_TYPES.has(sourceType) || isPreparationTicket || isPartnerReceipt;
  const customerPhone = toText(order.customerPhone || order.customer_phone || payload.customerPhone || payload.customer_phone);

  return {
    text,
    qrUrl: isPartnerReceipt ? buildReceiptFooterQrUrl(customerPhone) : toText(payload.qrUrl),
    sourceType: isPartnerReceipt ? "partner" : sourceType,
    alertKey: buildAlertKey(job, payload),
    isQrPayment: isQrPaymentPrintPayload(payload, sourceType),
    shouldPlayAlert: !isItemLabel,
    shouldDelayPrint: sourceType === "qr_order",
    customerPhone,
    footerText: skipFooter ? "" : toText(payload.footerText || DEFAULT_FOOTER_TEXT),
    footerQrUrl: skipFooter ? "" : toText(payload.footerQrUrl),
    secondaryReceipt: secondaryText
      ? {
          text: secondaryText,
          sourceType: "qr_order",
          customerPhone: toText(order.customerPhone || order.customer_phone || payload.customerPhone || payload.customer_phone),
          footerText: toText(payload.footerText || DEFAULT_FOOTER_TEXT),
          footerQrUrl: toText(payload.footerQrUrl)
        }
      : null
  };
}

function buildReceiptTextFromOrder(order = {}, sourceType = "") {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return "";

  const cart = items.map((item, index) => {
    const itemObject = getObject(item);
    const quantity = Math.max(1, toNumber(itemObject.quantity, 1));
    const options = Array.isArray(itemObject.selectedOptions)
      ? itemObject.selectedOptions
      : (Array.isArray(itemObject.options) ? itemObject.options : []).map((option) => (
          typeof option === "string" ? { name: option } : getObject(option)
        ));

    return {
      cartId: toText(itemObject.id || `${toText(order.id || order.orderCode || "print")}-${index + 1}`),
      id: toText(itemObject.productId || itemObject.product_id || itemObject.id || `${index + 1}`),
      name: toText(itemObject.name || itemObject.productName || itemObject.product_name || "Món"),
      quantity,
      lineTotal: toNumber(itemObject.lineTotal || itemObject.total || itemObject.price * quantity),
      note: toText(itemObject.note),
      selectedOptions: options.map((option) => ({
        name: toText(option.name || option.label || option.value)
      })).filter((option) => option.name)
    };
  });

  const paymentMethod = normalizeSourceToken(order.paymentMethod || order.payment_method);
  const paymentStatus = normalizeSourceToken(order.paymentStatus || order.payment_status);
  const paidAt = toText(order.paidAt || order.paid_at);
  const paymentPaid = ["paid", "converted"].includes(paymentStatus) || Boolean(paidAt);

  return buildPosCustomerBillText({
    order: {
      id: toText(order.id),
      orderCode: toText(order.orderCode || order.order_code || order.id),
      displayOrderCode: toText(order.displayOrderCode || order.display_order_code || order.orderCode || order.id)
    },
    cart,
    totals: {
      subtotal: toNumber(order.subtotal || order.totalAmount),
      voucherDiscount: toNumber(order.discount || order.promoDiscount || order.voucherDiscount),
      pointsDiscount: toNumber(order.pointsDiscount || order.pointsDiscountAmount),
      total: toNumber(order.totalAmount || order.total_amount)
    },
    customerName: toText(order.customerName || order.customer_name),
    customerPhone: toText(order.customerPhone || order.customer_phone),
    pagerNumber: toText(order.pagerNumber || order.pager_number),
    branchName: toText(order.branchName || order.branch_name),
    cashierName: sourceType === "qr_order" ? "QR tại quầy" : toText(order.cashierName || order.cashier_name),
    orderNote: toText(order.note || order.orderNote || order.order_note),
    paymentConfirmed: paymentPaid ? {
      method: paymentMethod === "momo" ? "momo" : paymentMethod.includes("qr") ? "bank_qr" : "cash",
      reference: toText(order.paymentReference || order.payment_reference),
      paidAt,
      paid: true
    } : null
  });
}

async function playPrintJobAlert(printPayload = {}) {
  const now = Date.now();
  pruneRecentAlerts(now);

  const alertKey = toText(printPayload.alertKey || "print_job");
  const previous = recentAlertByOrderKey.get(alertKey);
  const previousIsFresh = previous?.at && now - previous.at <= ALERT_GROUP_WINDOW_MS;
  const nextType = printPayload.isQrPayment ? "qr" : "new_order";

  if (!printPayload.isQrPayment) {
    await wait(NEW_ORDER_ALERT_GRACE_MS);
    const latest = recentAlertByOrderKey.get(alertKey);
    if (latest?.at && Date.now() - latest.at <= ALERT_GROUP_WINDOW_MS) {
      return false;
    }
    recentAlertByOrderKey.set(alertKey, { type: nextType, at: Date.now() });
    return playLocalNewOrderAlert();
  }

  if (previousIsFresh && previous.type === "qr") return false;
  recentAlertByOrderKey.set(alertKey, { type: nextType, at: now });

  if (printPayload.isQrPayment) {
    const played = await playLocalQrPaymentAlert();
    if (played) return true;
  }
  return playLocalNewOrderAlert();
}

async function processPrintJobOnce(job, branchUuid, deviceId, onStatus) {
  const claimed = await claimJob(job, branchUuid, deviceId);
  if (!claimed) return false;

  if (isPosOrderPrintJob(claimed)) {
    await markPrinted(claimed.id);
    if (typeof onStatus === "function") {
      onStatus({ running: true, tone: "ready", message: `Đã bỏ qua bill POS ${claimed.order_code || ""}.` });
    }
    return false;
  }

  try {
    const hydratedJob = await hydratePartnerPrintJob(claimed);
    const printPayload = buildPrintPayload(hydratedJob);
    if (!printPayload.text) throw new Error("Nội dung bill đang trống.");
    if (typeof onStatus === "function") {
      onStatus({ running: true, tone: "printing", message: `Đang in ${claimed.order_code || "bill"}...` });
    }
    const alertTask = printPayload.shouldPlayAlert
      ? playPrintJobAlert(printPayload).catch(() => {})
      : Promise.resolve(false);
    if (printPayload.shouldDelayPrint) {
      await wait(QR_CUSTOMER_BILL_PRINT_DELAY_MS);
    }
    await Promise.race([
      printLocalReceipt(printPayload),
      new Promise((_, reject) => {
        globalThis.setTimeout(
          () => reject(new Error("Máy in phản hồi quá lâu. Hãy kiểm tra kết nối rồi bấm in lại.")),
          PRINT_RECEIPT_TIMEOUT_MS
        );
      })
    ]);
    if (printPayload.secondaryReceipt) {
      await wait(750);
      await Promise.race([
        printLocalReceipt(printPayload.secondaryReceipt),
        new Promise((_, reject) => {
          globalThis.setTimeout(
            () => reject(new Error("Máy in phản hồi quá lâu khi in hóa đơn. Hãy kiểm tra kết nối rồi bấm in lại.")),
            PRINT_RECEIPT_TIMEOUT_MS
          );
        })
      ]);
    }
    void alertTask;
    await markPrinted(claimed.id);
    if (typeof onStatus === "function") {
      onStatus({ running: true, tone: "ready", message: `Đã in ${claimed.order_code || "bill"}.` });
    }
    return true;
  } catch (error) {
    try {
      await markFailed(claimed, error?.message);
    } catch {
      // Giữ lỗi in chính để lần chạy nền kết thúc an toàn.
    }
    if (typeof onStatus === "function") {
      onStatus({ running: true, tone: "error", message: error?.message || "Không in được bill tự động." });
    }
    return false;
  }
}

export async function runPosPrintStationPoll({ branchUuid = "", deviceId = "", onStatus } = {}) {
  const safeBranchUuid = toText(branchUuid);
  const safeDeviceId = toText(deviceId) || `pos-native-${Date.now()}`;
  if (!supabase || !safeBranchUuid) return { processed: 0 };

  const jobs = await readPendingJobs(safeBranchUuid);
  let processed = 0;
  for (const job of jobs) {
    const printed = await processPrintJobOnce(job, safeBranchUuid, safeDeviceId, onStatus);
    if (printed) processed += 1;
  }
  return { processed };
}

export async function startPosPrintStation({
  branchUuid = "",
  deviceId = "",
  onStatus,
  pollFallback = true
} = {}) {
  const safeBranchUuid = toText(branchUuid);
  const safeDeviceId = toText(deviceId) || `pos-native-${Date.now()}`;
  if (!supabase || !safeBranchUuid) return () => {};

  let active = true;
  let polling = false;
  let pollTimer = null;
  let appStateSubscription = null;
  const queuedJobs = [];
  let queueRunning = false;
  const processingIds = new Set();

  const notify = (status) => {
    if (active && typeof onStatus === "function") onStatus(status);
  };

  const drainPrintQueue = async () => {
    if (queueRunning || !active) return;
    queueRunning = true;
    while (active && queuedJobs.length) {
      queuedJobs.sort((left, right) => {
        const priorityDifference = getPrintJobPriority(left.job) - getPrintJobPriority(right.job);
        if (priorityDifference !== 0) return priorityDifference;
        return new Date(left.job.created_at || 0).getTime() - new Date(right.job.created_at || 0).getTime();
      });
      const entry = queuedJobs.shift();
      try {
        entry.resolve(await processPrintJobOnce(entry.job, safeBranchUuid, safeDeviceId, notify));
      } catch (error) {
        notify({ running: true, tone: "error", message: error?.message || "Không in được lệnh tự động." });
        entry.resolve(false);
      } finally {
        processingIds.delete(entry.job.id);
      }
    }
    queueRunning = false;
  };

  const processJob = (job) => {
    if (!active || !job?.id || processingIds.has(job.id)) return Promise.resolve(false);
    processingIds.add(job.id);
    return new Promise((resolve) => {
      queuedJobs.push({ job, resolve });
      drainPrintQueue();
    });
  };

  const poll = async () => {
    if (!active || polling) return;
    polling = true;
    try {
      const jobs = await readPendingJobs(safeBranchUuid);
      for (const job of jobs) {
        if (!active) break;
        await processJob(job);
      }
      if (!jobs.length) {
        notify({ running: true, tone: "ready", message: "Trạm in đang chờ lệnh." });
      }
    } catch (error) {
      notify({ running: true, tone: "error", message: error?.message || "Không đọc được lệnh in." });
    } finally {
      polling = false;
    }
  };

  notify({ running: true, tone: "starting", message: "Đang khởi động trạm in..." });
  if (pollFallback) {
    await poll();
    pollTimer = globalThis.setInterval(poll, POLL_INTERVAL_MS);
  }

  const channel = supabase
    .channel(`pos-native-print-${safeBranchUuid}-${safeDeviceId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "print_jobs",
        filter: `branch_uuid=eq.${safeBranchUuid}`
      },
      ({ new: job }) => {
        if (
          toText(job?.status) === "pending" &&
          isSupportedPrintJob(job) &&
          toText(job?.printer_key) === PRINTER_KEY &&
          isFreshJob(job)
        ) {
          processJob(job);
        }
      }
    )
    .subscribe();

  if (pollFallback) {
    appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") poll();
    });
  }

  return () => {
    active = false;
    queuedJobs.splice(0).forEach((entry) => {
      processingIds.delete(entry.job?.id);
      entry.resolve(false);
    });
    if (pollTimer) globalThis.clearInterval(pollTimer);
    appStateSubscription?.remove();
    supabase.removeChannel(channel);
  };
}
