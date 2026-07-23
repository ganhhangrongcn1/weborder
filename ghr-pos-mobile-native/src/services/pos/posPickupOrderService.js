import { supabase } from "../supabase/client";

const WEBSITE_ORDER_SELECT = [
  "id",
  "order_code",
  "customer_name",
  "customer_phone",
  "subtotal",
  "total_amount",
  "payment_method",
  "status",
  "kitchen_status",
  "fulfillment_type",
  "shipping_fee",
  "original_shipping_fee",
  "branch_uuid",
  "branch_name",
  "pickup_branch_uuid",
  "pickup_branch_name",
  "pickup_time_text",
  "delivery_branch_uuid",
  "delivery_branch_name",
  "delivery_address",
  "pos_shift_id",
  "metadata",
  "created_at"
].join(",");

const WEBSITE_QR_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

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

function getFulfillmentType(row = {}) {
  const metadata = getObject(row.metadata);
  const rawType = normalizeToken(
    row.fulfillment_type ||
      metadata.fulfillmentType ||
      metadata.fulfillment_type
  );

  if (rawType === "pickup") return "pickup";
  if (["delivery", "ship", "shipping"].includes(rawType)) return "delivery";
  if (toText(row.pickup_time_text || metadata.pickupTimeText || metadata.pickup_time_text)) return "pickup";
  return "delivery";
}

function isPickupOrder(row = {}) {
  return getFulfillmentType(row) === "pickup";
}

function matchesBranch(row = {}, branchUuid = "") {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return false;
  const metadata = getObject(row.metadata);
  return [
    row.branch_uuid,
    row.pickup_branch_uuid,
    row.delivery_branch_uuid,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.pickupBranchUuid,
    metadata.pickup_branch_uuid,
    metadata.deliveryBranchUuid,
    metadata.delivery_branch_uuid
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
  const metadata = getObject(row.metadata);
  const paymentStatus = getPaymentStatus(row);
  const paymentProvider = normalizeToken(metadata.paymentProvider || metadata.payment_provider);
  const providerTransactionId = toText(
    metadata.momoTransactionId ||
      metadata.momo_transaction_id ||
      metadata.sepayWebhook?.providerTransactionId ||
      metadata.sepay_webhook?.provider_transaction_id
  );
  const providerConfirmed = ["momo", "sepay"].includes(paymentProvider) && Boolean(
    providerTransactionId ||
      toText(metadata.paidAt || metadata.paid_at) ||
      toNumber(metadata.paymentAmount || metadata.payment_amount) > 0
  );

  return (
    ["paid", "converted", "completed", "success"].includes(paymentStatus) ||
    Boolean(toText(row.paid_at || metadata.paidAt || metadata.paid_at)) ||
    providerConfirmed
  );
}

function isPrepaidWebsitePickup(row = {}) {
  const metadata = getObject(row.metadata);
  const paymentMethod = normalizeToken(row.payment_method || metadata.paymentMethod || metadata.payment_method);
  if (!["bank_qr", "momo"].includes(paymentMethod) || !isPickupOrder(row)) return false;
  const source = normalizeToken(
    row.source || row.channel || metadata.orderSource || metadata.order_source || metadata.source || metadata.channel
  );
  return ["online", "website", "web", "qr_order", "qr_counter"].includes(source);
}

function isWebsitePaymentExpired(row = {}) {
  if (isPaid(row)) return false;
  const metadata = getObject(row.metadata);
  const paymentStatus = normalizeToken(metadata.paymentStatus || metadata.payment_status);
  if (["expired", "cancelled", "canceled", "failed"].includes(paymentStatus)) return true;

  const expiresAt = new Date(metadata.paymentExpiresAt || metadata.payment_expires_at || "").getTime();
  if (Number.isFinite(expiresAt)) return expiresAt <= Date.now();

  if (!isPrepaidWebsitePickup(row)) return false;

  const createdAt = new Date(row.created_at || metadata.createdAt || metadata.created_at || "").getTime();
  return Number.isFinite(createdAt) && createdAt + WEBSITE_QR_PAYMENT_TIMEOUT_MS <= Date.now();
}

function getWebsiteOrderLabel(order = {}) {
  return order.fulfillmentType === "delivery" ? "đơn giao hàng" : "đơn hẹn lấy";
}

function normalizeWebsiteOrder(row = {}) {
  const metadata = getObject(row.metadata);
  const fulfillmentType = getFulfillmentType(row);
  const paid = isPaid(row);
  const shippingFee = Math.max(
    0,
    toNumber(row.shipping_fee || metadata.shippingFee || metadata.shipping_fee || metadata.deliveryFee || metadata.delivery_fee)
  );
  const totalAmount = Math.max(0, toNumber(row.total_amount || metadata.totalAmount || metadata.total));
  const subtotal = Math.max(
    0,
    toNumber(
      row.subtotal ||
        metadata.subtotal ||
        metadata.itemsAmount ||
        metadata.items_amount ||
        Math.max(0, totalAmount - shippingFee)
    )
  );

  return {
    id: toText(row.id || row.order_code),
    orderCode: toText(row.order_code || row.id),
    displayOrderCode: toText(metadata.displayOrderCode || row.order_code || row.id),
    fulfillmentType,
    fulfillmentLabel: fulfillmentType === "delivery" ? "Giao hàng" : "Hẹn lấy",
    customerName: toText(row.customer_name || metadata.customerName || metadata.customer_name) || "Khách đặt web",
    customerPhone: toText(row.customer_phone || metadata.customerPhone || metadata.customer_phone),
    subtotal,
    shippingFee,
    totalAmount,
    collectAmount: totalAmount,
    paymentMethod: toText(row.payment_method || metadata.paymentMethod || metadata.payment_method || "cash"),
    paymentStatus: paid ? "paid" : "unpaid",
    paymentExpired: isWebsitePaymentExpired(row),
    paymentAmount: Math.max(0, toNumber(row.payment_amount || metadata.paymentAmount || metadata.payment_amount || totalAmount)),
    paymentReference: toText(row.payment_reference || metadata.paymentReference || metadata.payment_reference),
    paidAt: toText(row.paid_at || metadata.paidAt || metadata.paid_at),
    status: toText(row.status || metadata.status),
    kitchenStatus: toText(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status),
    pickupTimeText: toText(row.pickup_time_text || metadata.pickupTimeText || metadata.pickup_time_text),
    pickupBranchName: toText(row.pickup_branch_name || metadata.pickupBranchName || metadata.pickup_branch_name || row.branch_name),
    deliveryBranchName: toText(row.delivery_branch_name || metadata.deliveryBranchName || metadata.delivery_branch_name || row.branch_name),
    deliveryAddress: toText(row.delivery_address || metadata.deliveryAddress || metadata.delivery_address),
    posShiftId: toText(row.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id),
    createdAt: toText(row.created_at),
    metadata
  };
}

function shouldShowInWebsiteQueue(row = {}) {
  if (isCancelled(row)) return false;
  if (isWebsitePaymentExpired(row)) return false;
  if (!isPaid(row)) return true;
  return !isKitchenCompleted(row);
}

function shouldShowInWebsiteHistory(row = {}) {
  return isCancelled(row) || isWebsitePaymentExpired(row) || (isPaid(row) && isKitchenCompleted(row));
}

function splitWebsiteOrders(rows = []) {
  const pickupOrders = [];
  const deliveryOrders = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const order = normalizeWebsiteOrder(row);
    if (order.fulfillmentType === "delivery") {
      deliveryOrders.push(order);
      return;
    }
    pickupOrders.push(order);
  });

  return { pickupOrders, deliveryOrders };
}

async function readWebsiteOrders({ branchUuid = "", limit = 60, includePaid = true } = {}) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid) return [];

  const safeLimit = Math.max(10, Math.min(120, Math.floor(Number(limit || 60))));
  const startOfToday = getStartOfTodayIso();
  const startOfTomorrow = getStartOfTomorrowIso();
  const query = supabase
    .from("orders")
    .select(WEBSITE_ORDER_SELECT)
    .or(`branch_uuid.eq.${safeBranchUuid},pickup_branch_uuid.eq.${safeBranchUuid},delivery_branch_uuid.eq.${safeBranchUuid}`)
    .gte("created_at", startOfToday)
    .lt("created_at", startOfTomorrow)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || "Không tải được đơn website.");
  }

  return data
    .filter((row) => matchesBranch(row, safeBranchUuid))
    .filter((row) => !isPosSource(row))
    .filter((row) => ["pickup", "delivery"].includes(getFulfillmentType(row)))
    .filter((row) => (includePaid ? true : !isPaid(row)));
}

export async function getPosWebsiteOrders({ branchUuid = "", limit = 80 } = {}) {
  const rows = await readWebsiteOrders({ branchUuid, limit, includePaid: true });
  return splitWebsiteOrders(rows.filter(shouldShowInWebsiteQueue));
}

export function subscribePosWebsiteOrderChanges(branchUuid = "", onChange) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid || typeof onChange !== "function") return () => {};

  const channel = supabase
    .channel(`pos-website-orders-${safeBranchUuid}-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        const row = payload?.new || payload?.old || {};
        if (!matchesBranch(row, safeBranchUuid) || isPosSource(row)) return;
        onChange(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getPosPickupOrders({ branchUuid = "", limit = 60 } = {}) {
  const { pickupOrders } = await getPosWebsiteOrders({ branchUuid, limit });
  return pickupOrders;
}

export async function getPosDeliveryOrders({ branchUuid = "", limit = 60 } = {}) {
  const { deliveryOrders } = await getPosWebsiteOrders({ branchUuid, limit });
  return deliveryOrders;
}

export async function getPosWebsiteHistoryOrders({ branchUuid = "", limit = 20 } = {}) {
  const safeBranchUuid = toText(branchUuid);
  if (!supabase || !safeBranchUuid) return [];

  const safeLimit = Math.max(8, Math.min(60, Math.floor(Number(limit || 20))));
  const fetchLimit = Math.max(24, safeLimit * 3);
  const rows = await readWebsiteOrders({ branchUuid: safeBranchUuid, limit: fetchLimit, includePaid: true });

  return rows
    .filter(shouldShowInWebsiteHistory)
    .slice(0, safeLimit)
    .map((row) => {
      const order = normalizeWebsiteOrder(row);
      return {
        id: order.id,
        displayOrderCode: order.displayOrderCode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        pagerNumber: "",
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.paymentExpired ? "expired" : order.status,
        kitchenStatus: order.kitchenStatus,
        posShiftId: order.posShiftId,
        createdAt: order.createdAt,
        metadata: {
          ...order.metadata,
          orderChannelLabel: order.fulfillmentType === "delivery" ? "Website giao hàng" : "Website tự lấy",
          orderSourceType: order.fulfillmentType === "delivery" ? "website_delivery" : "website_pickup",
          pickupOrderCreatedAt: order.createdAt,
          paidAt: order.paidAt,
          fulfillmentType: order.fulfillmentType,
          shippingFee: order.shippingFee,
          subtotal: order.subtotal,
          deliveryAddress: order.deliveryAddress,
          pickupTimeText: order.pickupTimeText
        },
        canCancel: false
      };
    });
}

export async function getPosPickupHistoryOrders({ branchUuid = "", limit = 20 } = {}) {
  const historyOrders = await getPosWebsiteHistoryOrders({ branchUuid, limit: Math.max(24, limit * 3) });
  return historyOrders
    .filter((order) => toText(order.metadata?.orderSourceType) === "website_pickup")
    .slice(0, Math.max(1, Math.floor(Number(limit || 20))));
}

function buildWebsitePaymentPatch({
  order,
  shiftId = "",
  cashierName = "",
  paymentMethod = "cash",
  paymentReference = "",
  paidAt = "",
  paymentAmount = 0,
  cashReceived = 0,
  cashChange = 0,
  cashRoundingDiscount = 0,
  cashRoundingUnit = 0
} = {}) {
  const metadata = getObject(order?.metadata);
  const fulfillmentType = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  const normalizedPaidAt = toText(paidAt) || new Date().toISOString();
  const normalizedCashierName = toText(cashierName) || metadata.cashierName || "POS mobile";
  const amount = Math.max(0, toNumber(paymentAmount || order?.collectAmount || order?.totalAmount || order?.paymentAmount));
  const nextMetadata = {
    ...metadata,
    paymentMethod,
    paymentStatus: "paid",
    paymentAmount: amount,
    paymentReference: toText(paymentReference),
    paidAt: normalizedPaidAt,
    posShiftId: shiftId,
    pos_shift_id: shiftId,
    cashierName: normalizedCashierName,
    websitePaymentCollectedAt: normalizedPaidAt,
    websitePaymentCollectedBy: normalizedCashierName
  };

  if (paymentMethod === "cash") {
    nextMetadata.cashReceived = Math.max(amount, toNumber(cashReceived || amount));
    nextMetadata.cashChange = Math.max(0, toNumber(cashChange || 0));
    nextMetadata.originalPaymentAmount = Math.max(amount, toNumber(order?.collectAmount || order?.totalAmount || order?.paymentAmount || amount));
    nextMetadata.cashRoundingDiscount = Math.max(0, toNumber(cashRoundingDiscount || 0));
    nextMetadata.cashRoundingUnit = Math.max(0, toNumber(cashRoundingUnit || 0));
  }

  if (fulfillmentType === "delivery") {
    nextMetadata.deliveryPaymentCollectedAt = normalizedPaidAt;
    nextMetadata.deliveryPaymentCollectedBy = normalizedCashierName;
  } else {
    nextMetadata.pickupPaymentCollectedAt = normalizedPaidAt;
    nextMetadata.pickupPaymentCollectedBy = normalizedCashierName;
  }

  return {
    payment_method: paymentMethod,
    pos_shift_id: shiftId,
    metadata: nextMetadata
  };
}

export async function markWebsiteOrderPaidCash({
  order,
  shift,
  cashierName = "",
  paymentAmount = 0,
  cashRoundingDiscount = 0,
  cashRoundingUnit = 0,
  cashReceived = 0,
  cashChange = 0,
  paymentReference = ""
} = {}) {
  const orderId = toText(order?.id);
  const shiftId = toText(shift?.id);
  if (!supabase) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!orderId) return { ok: false, message: "Thiếu mã đơn website." };
  if (!shiftId) return { ok: false, message: "Cần mở ca POS trước khi thu tiền." };

  const patch = buildWebsitePaymentPatch({
    order,
    shiftId,
    cashierName,
    paymentMethod: "cash",
    paymentAmount,
    paymentReference,
    cashReceived,
    cashChange,
    cashRoundingDiscount,
    cashRoundingUnit
  });

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select(WEBSITE_ORDER_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message || "Không cập nhật được thanh toán đơn website."
    };
  }

  const nextOrder = normalizeWebsiteOrder(data);
  return {
    ok: true,
    order: nextOrder,
    message: `Đã thu tiền mặt ${getWebsiteOrderLabel(nextOrder)} ${nextOrder.displayOrderCode || nextOrder.orderCode || orderId}.`
  };
}

export async function markWebsiteOrderPaidQr({
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
  if (!orderId) return { ok: false, message: "Thiếu mã đơn website." };
  if (!shiftId) return { ok: false, message: "Cần mở ca POS trước khi thu tiền." };

  const patch = buildWebsitePaymentPatch({
    order,
    shiftId,
    cashierName,
    paymentMethod: "bank_qr",
    paymentReference,
    paidAt,
    paymentAmount
  });

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select(WEBSITE_ORDER_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message || "Không cập nhật được thanh toán QR cho đơn website."
    };
  }

  const nextOrder = normalizeWebsiteOrder(data);
  return {
    ok: true,
    order: nextOrder,
    message: `Đã nhận thanh toán QR ${getWebsiteOrderLabel(nextOrder)} ${nextOrder.displayOrderCode || nextOrder.orderCode || orderId}.`
  };
}

export async function markPickupOrderPaidCash(options = {}) {
  return markWebsiteOrderPaidCash(options);
}

export async function markPickupOrderPaidQr(options = {}) {
  return markWebsiteOrderPaidQr(options);
}

export function countUnpaidWebsiteOrders(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter((order) => order.paymentStatus !== "paid").length;
}

export function countUnpaidPickupOrders(orders = []) {
  return countUnpaidWebsiteOrders(orders.filter((order) => order?.fulfillmentType !== "delivery"));
}
