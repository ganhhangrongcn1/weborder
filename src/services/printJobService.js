import { buildPrintJobPayload } from "./printerService.js";
import {
  getSupabaseKitchenAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseKitchenAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";

const PRINT_JOB_STATUS = {
  pending: "pending",
  printing: "printing",
  printed: "printed",
  failed: "failed"
};

const DEFAULT_PRINTER_KEY = "cashier-80mm";
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

async function getClient() {
  return (
    getSupabaseKitchenAuthClient() ||
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
      .eq("job_type", row.job_type || "customer_bill")
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
    job_type: "customer_bill",
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

export async function readRecentPrintJobs(options = {}) {
  const client = await getClient();
  if (!client) return [];

  let query = client
    .from("print_jobs")
    .select(PRINT_JOB_STATUS_COLUMNS)
    .eq("job_type", "customer_bill")
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
  await markExpiredPendingPrintJobs({ branchUuid, printerKey: options.printerKey });

  let query = client
    .from("print_jobs")
    .select(PRINT_JOB_COLUMNS)
    .eq("status", PRINT_JOB_STATUS.pending)
    .eq("job_type", "customer_bill")
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
    .eq("job_type", "customer_bill")
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
        if (toText(job.status) !== PRINT_JOB_STATUS.pending) return;
        if (toText(job.job_type || "customer_bill") !== "customer_bill") return;
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
        if (toText(job.job_type || "customer_bill") !== "customer_bill") return;
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

export { DEFAULT_PRINTER_KEY, PRINT_JOB_STATUS };
