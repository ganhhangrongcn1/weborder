import { claimPrintJob, getPrintDeviceId, markPrintJobFailed, markPrintJobPrinted, readPendingPrintJobs, subscribePrintJobs } from "./printJobService.js";
import { hasAndroidPrinterBridge, printCustomerBill } from "./printerService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

function toText(value = "") {
  return String(value || "").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePosOrderRow(row = {}) {
  const metadata = getObject(row.metadata);
  return {
    id: toText(row.id),
    orderCode: toText(row.order_code || row.id),
    displayOrderCode: toText(
      row.display_order_code ||
      metadata.displayOrderCode ||
      metadata.display_order_code ||
      row.order_code ||
      row.id
    ),
    status: toText(row.status || metadata.status || "pending_zalo"),
    kitchenStatus: toText(row.kitchen_status || metadata.kitchenStatus || ""),
    paymentMethod: toText(row.payment_method || metadata.paymentMethod || ""),
    paymentStatus: toText(row.payment_status || metadata.paymentStatus || ""),
    paymentReference: toText(row.payment_reference || metadata.paymentReference || ""),
    paidAt: toText(row.paid_at || metadata.paidAt || ""),
    branchUuid: toText(row.branch_uuid || metadata.branchUuid || ""),
    metadata
  };
}

export async function readPosDraftOrder(orderId = "") {
  const safeOrderId = toText(orderId);
  if (!safeOrderId) return null;

  const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) return null;

  const { data, error } = await client
    .from("orders")
    .select("id,order_code,status,kitchen_status,payment_method,branch_uuid,metadata,updated_at")
    .eq("id", safeOrderId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePosOrderRow(data) : null;
}

export async function subscribePosDraftOrderRealtime(orderId = "", onChange) {
  const safeOrderId = toText(orderId);
  if (!safeOrderId || typeof onChange !== "function") return () => {};

  const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) return () => {};

  const channel = client
    .channel(`pos-draft-order-${safeOrderId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `id=eq.${safeOrderId}`
      },
      (payload) => {
        const nextRow = payload?.new || payload?.old || {};
        onChange(normalizePosOrderRow(nextRow), payload);
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

async function processPrintJob(job = {}, options = {}) {
  const claimedJob = await claimPrintJob(job, {
    deviceId: options.deviceId
  });
  if (!claimedJob) return;

  const payload = getObject(claimedJob.payload);
  const order = getObject(payload.order);
  const printResult = await printCustomerBill(order, {
    printerName: toText(payload.printerName || options.printerName),
    receiptWidthMm: Number(payload.receiptWidthMm || options.receiptWidthMm || 80),
    storeName: toText(payload.storeName || options.storeName),
    loyaltyUrl: toText(payload.loyaltyUrl || options.loyaltyUrl)
  });

  if (printResult?.ok) {
    await markPrintJobPrinted(claimedJob);
    if (typeof options.onPrinted === "function") {
      options.onPrinted(claimedJob, printResult);
    }
    return;
  }

  await markPrintJobFailed(claimedJob, printResult?.message || "Không in được bill.");
  if (typeof options.onFailed === "function") {
    options.onFailed(claimedJob, printResult);
  }
}

export async function startPosAutoPrint(options = {}) {
  const branchUuid = toText(options.branchUuid);
  if (!branchUuid) return () => {};
  if (!hasAndroidPrinterBridge()) return () => {};

  const deviceId = toText(options.deviceId || getPrintDeviceId());
  const pendingJobs = await readPendingPrintJobs({
    branchUuid,
    printerKey: options.printerKey,
    jobType: options.jobType
  });

  for (const job of pendingJobs) {
    await processPrintJob(job, {
      ...options,
      deviceId
    });
  }

  const unsubscribe = await subscribePrintJobs({
    branchUuid,
    printerKey: options.printerKey,
    jobType: options.jobType,
    deviceId,
    onPendingJob: async (job) => {
      await processPrintJob(job, {
        ...options,
        deviceId
      });
    }
  });

  return () => {
    if (typeof unsubscribe === "function") unsubscribe();
  };
}
