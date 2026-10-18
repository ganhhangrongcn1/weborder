import { supabase } from "../supabase/client";
import { createPosTakeawayOrderMobile } from "./posOrderService";
import {
  isLikelyPosNetworkError, markPosOfflineOrderRetry,
  readPosOfflineOrderQueue, removePosOfflineOrder
} from "./posOfflineOrderQueueService";

let syncInFlight = null;

async function syncQueue(branchUuid, canContinue) {
  let synced = 0;
  const queue = await readPosOfflineOrderQueue();
  for (const entry of queue) {
    if (!canContinue()) break;
    const payload = entry.orderPayload || {};
    const branch = payload.branch || {};
    if (String(branch.branchUuid || branch.branch_uuid || "") !== branchUuid) continue;
    try {
      const orderId = payload.orderIdentity?.orderCode;
      if (!orderId) {
        await markPosOfflineOrderRetry(entry.id, "Thiếu mã đơn gốc, cần kiểm tra trước khi đồng bộ.");
        continue;
      }
      const { data: existing, error } = await supabase.from("orders")
        .select("id,status,kitchen_status,branch_uuid")
        .eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!canContinue()) break;
      if (existing && existing.branch_uuid !== branchUuid) {
        await markPosOfflineOrderRetry(entry.id, "Chi nhánh đơn không khớp.");
        continue;
      }
      // Never reopen an order already completed/cancelled or processed by the kitchen.
      if (existing && (!["pending_zalo", "pending_payment"].includes(existing.status)
        || existing.kitchen_status === "done")) {
        await removePosOfflineOrder(entry.id);
        continue;
      }
      // An old pending QR must never be recreated after its payment session was closed.
      const paymentSessionId = payload.paymentMeta?.paymentSessionId;
      if (paymentSessionId) {
        const { data: payment, error: paymentError } = await supabase.from("pos_payment_sessions")
          .select("status,amount_paid,expires_at").eq("id", paymentSessionId).maybeSingle();
        if (paymentError) throw paymentError;
        if (!payment) throw new Error("Không tìm thấy phiên QR của đơn lưu tạm.");
        if (["cancelled", "expired"].includes(payment.status) && !Number(payment.amount_paid)) {
          await removePosOfflineOrder(entry.id);
          continue;
        }
        if (payment.status !== "pending_payment" || Number(payment.amount_paid) > 0
          || new Date(payment.expires_at).getTime() <= Date.now()) {
          await markPosOfflineOrderRetry(entry.id, "Cần kiểm tra trạng thái QR trước khi đồng bộ đơn.");
          continue;
        }
      }
      if (!canContinue()) break;
      const result = await createPosTakeawayOrderMobile({ ...payload, skipOfflineQueue: true });
      if (result.ok && !result.offline) {
        await removePosOfflineOrder(entry.id);
        synced += 1;
      } else {
        await markPosOfflineOrderRetry(entry.id, result.message || "Chưa gửi được đơn lưu tạm.");
        if (result.offline || isLikelyPosNetworkError(result.message)) break;
      }
    } catch (error) {
      await markPosOfflineOrderRetry(entry.id, error);
      if (isLikelyPosNetworkError(error)) break;
    }
  }
  return { synced };
}

export function syncPosOfflineOrders(branchUuid, canContinue = () => true) {
  if (!branchUuid) return Promise.resolve({ synced: 0 });
  if (syncInFlight) return syncInFlight;
  syncInFlight = syncQueue(branchUuid, canContinue).finally(() => { syncInFlight = null; });
  return syncInFlight;
}
