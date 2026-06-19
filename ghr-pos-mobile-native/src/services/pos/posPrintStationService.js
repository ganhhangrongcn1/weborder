import { AppState } from "react-native";

import { supabase } from "../supabase/client";
import { playLocalNewOrderAlert, printLocalReceipt } from "./posPrinterService";

const JOB_TYPE = "customer_bill";
const PRINTER_KEY = "cashier-80mm";
const POLL_INTERVAL_MS = 30000;
const AUTO_PRINT_WINDOW_MS = 5 * 60 * 1000;
const MAX_JOBS_PER_POLL = 3;
const EXPIRED_MESSAGE = "Lệnh in quá 5 phút. Bấm In lại nếu cần.";
const NO_FOOTER_SOURCE_TYPES = new Set(["pos_payment_qr", "pos_shift_close"]);
const DEFAULT_FOOTER_TEXT = [
  "------------------------------------------",
  "@@CENTER:Quét QR tích điểm ngay",
  "@@QR",
  "@@CENTER:Đơn từ Grab, ShopeeFood, Xanh Ngon",
  "@@CENTER:đều được tích điểm tại Gánh Hàng Rong",
  "@@CENTER:Quét để xem đơn và dùng điểm",
  "@@CENTER:Hotline: 0933 799 061",
  "@@CENTER:Cảm ơn quý khách!"
].join("\n");
const DEFAULT_FOOTER_QR_URL = "https://ganhhangrong.vn/loyalty?source=receipt";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getCutoffIso() {
  return new Date(Date.now() - AUTO_PRINT_WINDOW_MS).toISOString();
}

function isFreshJob(job = {}) {
  const timestamp = new Date(job.created_at || job.requested_at || "").getTime();
  return Number.isFinite(timestamp) && timestamp >= Date.now() - AUTO_PRINT_WINDOW_MS;
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
    .eq("job_type", JOB_TYPE)
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .lt("created_at", getCutoffIso());

  if (error) throw error;
}

async function readPendingJobs(branchUuid) {
  await expireOldPendingJobs(branchUuid);
  const { data, error } = await supabase
    .from("print_jobs")
    .select("id,branch_uuid,printer_key,job_type,status,order_code,source_type,payload,retry_count,created_at,requested_at")
    .eq("branch_uuid", branchUuid)
    .eq("job_type", JOB_TYPE)
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .gte("created_at", getCutoffIso())
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
    .eq("job_type", JOB_TYPE)
    .eq("printer_key", PRINTER_KEY)
    .eq("status", "pending")
    .gte("created_at", getCutoffIso())
    .select("id,order_code,source_type,payload,retry_count")
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
  const sourceType = toText(job.source_type || payload.type || payload.sourceType);
  const skipFooter = NO_FOOTER_SOURCE_TYPES.has(sourceType);

  return {
    text: toText(payload.text),
    qrUrl: toText(payload.qrUrl || payload.loyaltyUrl),
    sourceType,
    footerText: skipFooter ? "" : toText(payload.footerText || DEFAULT_FOOTER_TEXT),
    footerQrUrl: skipFooter ? "" : toText(payload.footerQrUrl || DEFAULT_FOOTER_QR_URL)
  };
}

async function processPrintJobOnce(job, branchUuid, deviceId, onStatus) {
  const claimed = await claimJob(job, branchUuid, deviceId);
  if (!claimed) return false;

  try {
    const printPayload = buildPrintPayload(claimed);
    if (!printPayload.text) throw new Error("Nội dung bill đang trống.");
    if (typeof onStatus === "function") {
      onStatus({ running: true, tone: "printing", message: `Đang in ${claimed.order_code || "bill"}...` });
    }
    await playLocalNewOrderAlert();
    await printLocalReceipt(printPayload);
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

export async function startPosPrintStation({ branchUuid = "", deviceId = "", onStatus } = {}) {
  const safeBranchUuid = toText(branchUuid);
  const safeDeviceId = toText(deviceId) || `pos-native-${Date.now()}`;
  if (!supabase || !safeBranchUuid) return () => {};

  let active = true;
  let polling = false;
  let pollTimer = null;
  const processingIds = new Set();

  const notify = (status) => {
    if (active && typeof onStatus === "function") onStatus(status);
  };

  const processJob = async (job) => {
    if (!active || !job?.id || processingIds.has(job.id)) return;
    processingIds.add(job.id);
    try {
      await processPrintJobOnce(job, safeBranchUuid, safeDeviceId, notify);
    } catch (error) {
      notify({ running: true, tone: "error", message: error?.message || "Không in được bill tự động." });
    } finally {
      processingIds.delete(job.id);
    }
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
  await poll();
  pollTimer = globalThis.setInterval(poll, POLL_INTERVAL_MS);

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
          toText(job?.job_type) === JOB_TYPE &&
          toText(job?.printer_key) === PRINTER_KEY &&
          isFreshJob(job)
        ) {
          processJob(job);
        }
      }
    )
    .subscribe();

  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") poll();
  });

  return () => {
    active = false;
    if (pollTimer) globalThis.clearInterval(pollTimer);
    appStateSubscription.remove();
    supabase.removeChannel(channel);
  };
}
