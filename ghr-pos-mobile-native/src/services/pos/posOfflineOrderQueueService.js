import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../supabase/client";

const OFFLINE_ORDER_QUEUE_KEY = "ghr_pos_mobile_offline_order_queue_v1";
let queueMutation = Promise.resolve();

function updateQueue(transform) {
  const operation = queueMutation.then(async () => {
    // Do not overwrite persisted orders if reading storage fails.
    const raw = await AsyncStorage.getItem(OFFLINE_ORDER_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue)) throw new Error("Không đọc được danh sách đơn lưu tạm.");
    const next = transform(queue);
    await writePosOfflineOrderQueue(next);
  });
  queueMutation = operation.catch(() => {});
  return operation;
}

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getQueueKey(payload = {}) {
  const orderIdentity = getObject(payload.orderIdentity);
  const paymentMeta = getObject(payload.paymentMeta);
  return toText(
    orderIdentity.orderCode ||
    paymentMeta.requestKey ||
    paymentMeta.paymentSessionId ||
    payload.paymentReference ||
    `offline-${Date.now()}`
  );
}

export function isLikelyPosNetworkError(error = null) {
  const message = toText(error?.message || error?.details || error?.hint || error);
  const code = toText(error?.code).toLowerCase();
  const normalized = message.toLowerCase();
  return (
    code === "network_error" ||
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("timeout") ||
    normalized.includes("offline") ||
    normalized.includes("internet") ||
    normalized.includes("fetch")
  );
}

export async function readPosOfflineOrderQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_ORDER_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePosOfflineOrderQueue(entries = []) {
  await AsyncStorage.setItem(OFFLINE_ORDER_QUEUE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
}

export async function getPosOfflineOrderCount() {
  const queue = await readPosOfflineOrderQueue();
  return queue.length;
}

export async function queuePosOfflineOrder(payload = {}, reason = "") {
  const orderPayload = getObject(payload);
  const queueKey = getQueueKey(orderPayload);
  const nextEntry = {
    id: queueKey,
    queuedAt: new Date().toISOString(),
    lastError: toText(reason),
    retryCount: 0,
    orderPayload
  };
  await updateQueue((queue) => [
    ...queue.filter((entry) => entry?.id !== queueKey),
    nextEntry
  ]);
  return nextEntry;
}

export async function removePosOfflineOrder(queueId = "") {
  const safeQueueId = toText(queueId);
  if (!safeQueueId) return;
  await updateQueue((queue) => queue.filter((entry) => entry?.id !== safeQueueId));
}

export async function markPosOfflineOrderRetry(queueId = "", error = null) {
  const safeQueueId = toText(queueId);
  if (!safeQueueId) return;
  await updateQueue((queue) => queue.map((entry) => {
    if (entry?.id !== safeQueueId) return entry;
    return {
      ...entry,
      retryCount: Number(entry.retryCount || 0) + 1,
      lastError: toText(error?.message || error),
      lastTriedAt: new Date().toISOString()
    };
  }));
}

export async function checkPosSupabaseConnection() {
  if (!supabase) {
    return {
      online: false,
      message: "Chưa có cấu hình Supabase."
    };
  }

  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { error } = await supabase
      .from("products")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    if (!error) {
      return {
        online: true,
        message: "Kết nối Supabase ổn."
      };
    }

    if (controller.signal.aborted || isLikelyPosNetworkError(error)) {
      return {
        online: false,
        message: "Đang offline. Đơn mới sẽ lưu tạm trên máy."
      };
    }

    return {
      online: true,
      warning: true,
      message: `Có kết nối nhưng Supabase trả lỗi: ${error.message || "kiểm tra quyền truy cập."}`
    };
  } catch (error) {
    return {
      online: false,
      message: isLikelyPosNetworkError(error)
        ? "Đang offline. Đơn mới sẽ lưu tạm trên máy."
        : error?.message || "Không kiểm tra được kết nối Supabase."
    };
  } finally {
    clearTimeout(timeout);
  }
}
