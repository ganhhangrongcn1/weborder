import { supabase } from "../supabase/client";

const PICKUP_ORDER_SELECT = [
  "id",
  "order_code",
  "customer_name",
  "customer_phone",
  "total_amount",
  "payment_method",
  "status",
  "kitchen_status",
  "fulfillment_type",
  "branch_uuid",
  "branch_name",
  "pickup_branch_uuid",
  "pickup_branch_name",
  "pickup_time_text",
  "pos_shift_id",
  "metadata",
  "created_at"
].join(",");

function toText(value = "") {
  return String(value ?? "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getStartOfTodayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

function getStartOfTomorrowIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return start.toISOString();
}

function normalizeToken(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isPosSource(row = {}) {
  const metadata = getObject(row.metadata);
  const tokens = [
    row.source,
    row.channel,
    row.order_source,
    row.platform,
    metadata.source,
    metadata.channel,
    metadata.orderSource,
    metadata.sourceType,
    metadata.platform
  ].map(normalizeToken);
  return tokens.some((token) => ["pos", "pos_mobile", "posmobile", "counter", "tai_quay"].includes(token));
}

function isPickupOrder(row = {}) {
  const metadata = getObject(row.metadata);
  return normalizeToken(row.fulfillment_type || metadata.fulfillmentType || metadata.fulfillment_type) === "pickup";
}

function matchesBranch(row = {}, branchUuid = "") {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return false;
  const metadata = getObject(row.metadata);
  return [
    row.branch_uuid,
    row.pickup_branch_uuid,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.pickupBranchUuid,
    metadata.pickup_branch_uuid
  ].map(toText).includes(safeBranchUuid);
}

function isCancelled(row = {}) {
  const metadata = getObject(row.metadata);
  const status = normalizeToken(row.status || metadata.status || metadata.orderStatus);
  const kitchenStatus = normalizeToken(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status);
  return ["cancelled", "canceled", "cancel"].includes(status) || ["cancelled", "canceled", "cancel"].includes(kitchenStatus);
}

function isKitchenCompleted(row = {}) {
  const metadata = getObject(row.metadata);
  const status = normalizeToken(row.status || metadata.status || metadata.orderStatus);
  const kitchenStatus = normalizeToken(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status);
  return ["done", "completed", "complete"].includes(status) || ["done", "completed", "complete"].includes(kitchenStatus);
}

function getPaymentStatus(row = {}) {
  const metadata = getObject(row.metadata);
  return normalizeToken(row.payment_status || metadata.paymentStatus || metadata.payment_status || "unpaid") || "unpaid";
}

function isPaid(row = {}) {
  return getPaymentStatus(row) === "paid" || Boolean(toText(row.paid_at || getObject(row.metadata).paidAt || getObject(row.metadata).paid_at));
}

function normalizePickupOrder(row = {}) {
  const metadata = getObject(row.metadata);
  const paid = isPaid(row);
  return {
    id: toText(row.id || row.order_code),
    orderCode: toText(row.order_code || row.id),
    displayOrderCode: toText(metadata.displayOrderCode || row.order_code || row.id),
    customerName: toText(row.customer_name || metadata.customerName || metadata.customer_name) || "Khách tự lấy",
    customerPhone: toText(row.customer_phone || metadata.customerPhone || metadata.customer_phone),
    totalAmount: Math.max(0, toNumber(row.total_amount || metadata.totalAmount || metadata.total)),
    paymentMethod: toText(row.payment_method || metadata.paymentMethod || metadata.payment_method || "cash"),
    paymentStatus: paid ? "paid" : "unpaid",
    paymentAmount: Math.max(0, toNumber(row.payment_amount || metadata.paymentAmount || metadata.payment_amount || row.total_amount)),
    paymentReference: toText(row.payment_reference || metadata.paymentReference || metadata.payment_reference),
    paidAt: toText(row.paid_at || metadata.paidAt || metadata.paid_at),
    status: toText(row.status || metadata.status),
    kitchenStatus: toText(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status),
    pickupTimeText: toText(row.pickup_time_text || metadata.pickupTimeText || metadata.pickup_time_text),
    pickupBranchName: toText(row.pickup_branch_name || metadata.pickupBranchName || metadata.pickup_branch_name || row.branch_name),
    posShiftId: toText(row.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id),
    createdAt: toText(row.created_at),
    metadata
  };
}

function shouldShowInPickupQueue(row = {}) {
  if (isCancelled(row)) return false;
  if (!isPaid(row)) return true;
  return !isKitchenCompleted(row);
}

export async function getPosPickupOrders({ branchUuid = "", limit = 60 } = {}) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid) return [];

  const safeLimit = Math.max(10, Math.min(120, Math.floor(Number(limit || 60))));
  const startOfToday = getStartOfTodayIso();
  const startOfTomorrow = getStartOfTomorrowIso();
  const { data, error } = await supabase
    .from("orders")
    .select(PICKUP_ORDER_SELECT)
    .or(`branch_uuid.eq.${safeBranchUuid},pickup_branch_uuid.eq.${safeBranchUuid}`)
    .gte("created_at", startOfToday)
    .lt("created_at", startOfTomorrow)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || "Không tải được đơn hẹn lấy.");
  }

  return data
    .filter((row) => matchesBranch(row, safeBranchUuid))
    .filter(isPickupOrder)
    .filter((row) => !isPosSource(row))
    .filter(shouldShowInPickupQueue)
    .map(normalizePickupOrder);
}

function shouldShowInPickupHistory(row = {}) {
  return isPaid(row) || isCancelled(row);
}

export async function getPosPickupHistoryOrders({ branchUuid = "", limit = 20 } = {}) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid) return [];

  const safeLimit = Math.max(8, Math.min(60, Math.floor(Number(limit || 20))));
  const fetchLimit = Math.max(24, safeLimit * 3);
  const startOfToday = getStartOfTodayIso();
  const { data, error } = await supabase
    .from("orders")
    .select(PICKUP_ORDER_SELECT)
    .or(`branch_uuid.eq.${safeBranchUuid},pickup_branch_uuid.eq.${safeBranchUuid}`)
    .gte("created_at", startOfToday)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || "Không tải được lịch sử đơn hẹn lấy.");
  }

  return data
    .filter((row) => matchesBranch(row, safeBranchUuid))
    .filter(isPickupOrder)
    .filter((row) => !isPosSource(row))
    .filter(shouldShowInPickupHistory)
    .slice(0, safeLimit)
    .map((row) => {
      const order = normalizePickupOrder(row);
      return {
        id: order.id,
        displayOrderCode: order.displayOrderCode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        pagerNumber: "",
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        kitchenStatus: order.kitchenStatus,
        posShiftId: order.posShiftId,
        createdAt: order.createdAt,
        metadata: {
          ...order.metadata,
          orderChannelLabel: "Website tự lấy",
          orderSourceType: "website_pickup",
          pickupOrderCreatedAt: order.createdAt,
          paidAt: order.paidAt
        },
        canCancel: false
      };
    });
}

export async function markPickupOrderPaidCash({
  order,
  shift,
  cashierName = "",
  cashReceived = 0,
  cashChange = 0,
  paymentReference = ""
} = {}) {
  const orderId = toText(order?.id);
  const shiftId = toText(shift?.id);
  if (!supabase) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!orderId) return { ok: false, message: "Thiếu mã đơn hẹn lấy." };
  if (!shiftId) return { ok: false, message: "Cần mở ca POS trước khi thu tiền." };

  const paidAt = new Date().toISOString();
  const amount = Math.max(0, toNumber(order.totalAmount || order.paymentAmount));
  const receivedAmount = Math.max(amount, toNumber(cashReceived || amount));
  const changeAmount = Math.max(0, toNumber(cashChange || 0));
  const metadata = getObject(order.metadata);
  const patch = {
    payment_method: "cash",
    pos_shift_id: shiftId,
    metadata: {
      ...metadata,
      paymentMethod: "cash",
      paymentStatus: "paid",
      paymentAmount: amount,
      paymentReference: toText(paymentReference),
      paidAt,
      posShiftId: shiftId,
      pos_shift_id: shiftId,
      cashReceived: receivedAmount,
      cashChange: changeAmount,
      cashierName: toText(cashierName) || metadata.cashierName || "",
      pickupPaymentCollectedAt: paidAt,
      pickupPaymentCollectedBy: toText(cashierName) || "POS mobile"
    }
  };

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select(PICKUP_ORDER_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message || "Không cập nhật được thanh toán đơn hẹn lấy."
    };
  }

  return {
    ok: true,
    order: normalizePickupOrder(data),
    message: `Đã thu tiền mặt đơn ${order.displayOrderCode || order.orderCode || orderId}.`
  };
}

export async function markPickupOrderPaidQr({
  order,
  shift,
  cashierName = "",
  paymentReference = "",
  paidAt = "",
  paymentAmount = 0
} = {}) {
  const orderId = toText(order?.id);
  const shiftId = toText(shift?.id);
  if (!supabase) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!orderId) return { ok: false, message: "Thiếu mã đơn hẹn lấy." };
  if (!shiftId) return { ok: false, message: "Cần mở ca POS trước khi thu tiền." };

  const normalizedPaidAt = toText(paidAt) || new Date().toISOString();
  const amount = Math.max(0, toNumber(paymentAmount || order.totalAmount || order.paymentAmount));
  const metadata = getObject(order.metadata);
  const patch = {
    payment_method: "bank_qr",
    pos_shift_id: shiftId,
    metadata: {
      ...metadata,
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: amount,
      paymentReference: toText(paymentReference),
      paidAt: normalizedPaidAt,
      posShiftId: shiftId,
      pos_shift_id: shiftId,
      cashierName: toText(cashierName) || metadata.cashierName || "",
      pickupPaymentCollectedAt: normalizedPaidAt,
      pickupPaymentCollectedBy: toText(cashierName) || "POS mobile"
    }
  };

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select(PICKUP_ORDER_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message || "Không cập nhật được thanh toán QR cho đơn hẹn lấy."
    };
  }

  return {
    ok: true,
    order: normalizePickupOrder(data),
    message: `Đã nhận thanh toán QR đơn ${order.displayOrderCode || order.orderCode || orderId}.`
  };
}

export function countUnpaidPickupOrders(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter((order) => order.paymentStatus !== "paid").length;
}
