import { getCustomerKey } from "./storageService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { upsertCustomerStubProfile } from "./customerProfileService.js";
import {
  getCanonicalOrderBranchName,
  resolveOrderBranch
} from "./branchIdentityService.js";
import { buildPartnerLoyaltyAmountSnapshot } from "./partnerOrderAmountService.js";
import { buildOrderLoyaltyIdempotencyKey } from "./loyaltyRuntimeService.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";

const SOURCE_BADGES = {
  website: {
    label: "Website",
    className: "border-sky-100 bg-sky-50 text-sky-700"
  },
  pickup: {
    label: "Tự Lấy",
    className: "border-amber-100 bg-amber-50 text-amber-700"
  },
  qr_counter: {
    label: "QR Tại Quầy",
    className: "border-violet-100 bg-violet-50 text-violet-700"
  },
  pos: {
    label: "POS",
    className: "border-slate-100 bg-slate-50 text-slate-700"
  },
  grabfood: {
    label: "Grab",
    className: "border-green-100 bg-green-50 text-green-700"
  },
  shopeefood: {
    label: "Shopee",
    className: "border-red-100 bg-red-50 text-red-600"
  },
  xanhngon: {
    label: "Xanh Ngon",
    className: "border-emerald-100 bg-emerald-50 text-emerald-600"
  },
  weborder: {
    label: "Website",
    className: "border-sky-100 bg-sky-50 text-sky-700"
  }
};

const CUSTOMER_STUB_HYDRATION_TTL_MS = 5 * 60 * 1000;
const customerStubHydrationCache = new Map();
const customerStubHydrationInFlight = new Map();

export { getCanonicalOrderBranchName, resolveOrderBranch };

export function normalizePartnerSource(source = "") {
  const value = String(source || "").trim().toLowerCase();
  if (["grab", "grab_food", "grabfood"].includes(value)) return "grabfood";
  if (["shopee", "shopee_food", "shopeefood"].includes(value)) return "shopeefood";
  if (["xanh", "xanh_ngon", "xanhngon"].includes(value)) return "xanhngon";
  return value || "partner";
}

function isPosSource(source = "") {
  return ["pos", "pos_mobile", "posmobile", "pos_app", "posapp", "tai_quay", "taiquay"].includes(String(source || "").trim().toLowerCase());
}

export function getPartnerSourceBadge(source = "") {
  const key = resolveOrderSourceKey(source);
  return SOURCE_BADGES[key] || {
    label: "FoodApp",
    className: "border-slate-100 bg-slate-50 text-slate-600"
  };
}

export function resolveOrderSourceKey(orderOrSource = "") {
  if (orderOrSource && typeof orderOrSource === "object") {
    const metadata = orderOrSource.metadata && typeof orderOrSource.metadata === "object" ? orderOrSource.metadata : {};
    const sources = [
      orderOrSource.partnerSource,
      orderOrSource.source,
      orderOrSource.orderSource,
      orderOrSource.channel,
      orderOrSource.platform,
      orderOrSource.sourceType,
      metadata.partnerSource,
      metadata.source,
      metadata.orderSource,
      metadata.channel,
      metadata.platform,
      metadata.sourceType
    ].map(normalizePartnerSource);
    const partnerSource = sources.find((source) => ["grabfood", "shopeefood", "xanhngon"].includes(source));
    if (partnerSource) return partnerSource;
    if (sources.some(isPosSource)) return "pos";
    if (sources.some((source) => ["qr", "qr_counter", "qrcounter", "counter"].includes(source))) return "qr_counter";
    if (String(orderOrSource.fulfillmentType || "").toLowerCase() === "pickup") return "pickup";
    return "website";
  }

  const source = normalizePartnerSource(orderOrSource);
  if (["grabfood", "shopeefood", "xanhngon"].includes(source)) return source;
  if (isPosSource(source)) return "pos";
  if (["qr", "qr_counter", "counter"].includes(source)) return "qr_counter";
  if (["pickup", "takeaway", "self_pickup"].includes(source)) return "pickup";
  if (["web", "website", "weborder", "online"].includes(source)) return "website";
  return source || "website";
}

export function resolveSalesChannelKey(orderOrSource = "") {
  const rawSources = orderOrSource && typeof orderOrSource === "object"
    ? (() => {
        const metadata = orderOrSource.metadata && typeof orderOrSource.metadata === "object"
          ? orderOrSource.metadata
          : {};
        return [
          orderOrSource.partnerSource,
          orderOrSource.source,
          orderOrSource.orderSource,
          orderOrSource.channel,
          orderOrSource.platform,
          orderOrSource.sourceType,
          metadata.partnerSource,
          metadata.source,
          metadata.orderSource,
          metadata.channel,
          metadata.platform,
          metadata.sourceType
        ];
      })()
    : [orderOrSource];
  const sources = rawSources
    .map((source) => String(source || "").trim())
    .filter(Boolean)
    .map(normalizePartnerSource);

  if (sources.some((source) => ["grabfood", "shopeefood", "xanhngon"].includes(source))) {
    return sources.find((source) => ["grabfood", "shopeefood", "xanhngon"].includes(source));
  }
  if (sources.some(isPosSource)) return "pos";
  if (sources.some((source) => ["qr", "qr_counter", "qrcounter", "counter"].includes(source))) {
    return "qr_counter";
  }
  if (sources.some((source) => ["web", "website", "weborder", "online", "ecommerce"].includes(source))) {
    return "website";
  }
  if (
    orderOrSource &&
    typeof orderOrSource === "object" &&
    ["qr", "qr_counter", "qrcounter", "counter"].includes(
      String(orderOrSource.fulfillmentType || "").trim().toLowerCase()
    )
  ) {
    return "qr_counter";
  }
  return sources.length ? "other" : "unknown";
}

export function getOrderSourceBadge(orderOrSource = "") {
  const key = resolveOrderSourceKey(orderOrSource);
  return SOURCE_BADGES[key] || SOURCE_BADGES.website;
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeIdentityText(value = "") {
  return String(value || "").trim();
}

function getOrderRawData(order = {}) {
  return getObject(order.rawData || order.raw_data || order.raw);
}

function normalizeCustomerName(value = "") {
  return String(value || "").trim();
}

function isWeakCustomerName(value = "") {
  const name = normalizeCustomerName(value).toLowerCase();
  if (!name) return true;
  if (["khach", "khach hang", "khach vang lai", "khách", "khách hàng", "khách vãng lai"].includes(name)) {
    return true;
  }
  return false;
}

function pickHydrationCustomerName(orders = []) {
  const names = (Array.isArray(orders) ? orders : [])
    .map((order) => normalizeCustomerName(order?.customerName))
    .filter(Boolean);
  const strongName = names.find((name) => !isWeakCustomerName(name));
  return strongName || names[0] || "";
}

function shouldSkipCustomerStubHydration(phoneKey = "") {
  const key = String(phoneKey || "").trim();
  if (!key) return true;
  const cachedAt = customerStubHydrationCache.get(key) || 0;
  return Date.now() - cachedAt < CUSTOMER_STUB_HYDRATION_TTL_MS;
}

function markCustomerStubHydrated(phoneKey = "") {
  const key = String(phoneKey || "").trim();
  if (!key) return;
  customerStubHydrationCache.set(key, Date.now());
}

async function hydratePartnerCustomerStubProfile(phone = "", orders = []) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey || !Array.isArray(orders) || !orders.length || shouldSkipCustomerStubHydration(phoneKey)) {
    return { ok: false, skipped: true };
  }

  if (customerStubHydrationInFlight.has(phoneKey)) {
    return customerStubHydrationInFlight.get(phoneKey);
  }

  const latestOrder = [...orders].sort((first, second) => {
    const firstTime = new Date(first?.updatedAt || first?.orderTime || first?.createdAt || 0).getTime();
    const secondTime = new Date(second?.updatedAt || second?.orderTime || second?.createdAt || 0).getTime();
    return secondTime - firstTime;
  })[0] || null;

  const name = pickHydrationCustomerName(orders);
  const source = normalizePartnerSource(latestOrder?.partnerSource || latestOrder?.source || "partner");
  const sourceRef = getPartnerOrderIdentityKey(latestOrder || {});

  const task = upsertCustomerStubProfile({
    phone: phoneKey,
    name,
    source,
    sourceRef
  })
    .then((result) => {
      if (result?.ok || /profile van hanh|profile vận hành/i.test(String(result?.message || ""))) {
        markCustomerStubHydrated(phoneKey);
      }
      return result;
    })
    .catch((error) => {
      if (import.meta?.env?.DEV) {
        console.warn("[partnerOrderService] hydratePartnerCustomerStubProfile failed", error);
      }
      return { ok: false, message: error?.message || "Khong the hydrate customer stub profile." };
    })
    .finally(() => {
      customerStubHydrationInFlight.delete(phoneKey);
    });

  customerStubHydrationInFlight.set(phoneKey, task);
  return task;
}

export function getPartnerOrderIdentityKey(order = {}) {
  const rawData = getOrderRawData(order);
  const partnerSource = normalizePartnerSource(
    order.partnerSource ||
      order.partner_source ||
      order.source ||
      order.orderSource ||
      order.channel ||
      order.platform ||
      rawData.partner_source ||
      rawData.source ||
      ""
  );
  const nexposOrderId = normalizeIdentityText(
    order.nexposOrderId ||
      order.nexpos_order_id ||
      rawData.nexpos_order_id ||
      rawData.order_id ||
      rawData.id ||
      ""
  );
  if (nexposOrderId) return `partner:${partnerSource}:nexpos:${nexposOrderId}`;

  const rowId = normalizeIdentityText(order.id || order.partnerOrderId || order.partner_order_id || "");
  if (rowId) return `partner:${partnerSource}:id:${rowId}`;

  return "";
}

export function getCustomerLookupOrderKey(order = {}) {
  const sourceType = String(order?.sourceType || order?.source_type || "").trim().toLowerCase();
  if (sourceType === "partner") {
    return getPartnerOrderIdentityKey(order) || `partner:unknown:${Math.random()}`;
  }

  const rawData = getOrderRawData(order);
  const orderId = normalizeIdentityText(
    order.id ||
      order.orderId ||
      order.order_id ||
      order.orderCode ||
      order.order_code ||
      rawData.id ||
      rawData.order_id ||
      rawData.order_code ||
      ""
  );
  return orderId ? `weborder:${orderId}` : `weborder:unknown:${Math.random()}`;
}

function toStatusToken(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Ä‘/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePartnerOrderStatus(row = {}) {
  const rawData = getObject(row.raw_data);
  const statuses = [
    row.kitchen_work_status,
    row.order_status,
    row.kitchen_status,
    row.nexpos_status,
    rawData.status,
    rawData.order_status,
    rawData.kitchen_status
  ].map(toStatusToken).filter(Boolean);

  if (statuses.some((status) => ["cancel", "cancelled", "canceled", "refunded", "huy", "dahuy"].includes(status))) return "cancelled";
  if (statuses.some((status) => ["preorder", "preordered", "scheduled", "dattruoc"].includes(status))) return "preorder";
  if (statuses.some((status) => ["done", "completed", "complete", "finish", "finished", "served", "hoantat"].includes(status))) return "done";
  if (statuses.some((status) => ["delivering", "shipping"].includes(status))) return "delivering";
  if (statuses.some((status) => ["preparing", "cooking", "doing", "pick", "picking", "inprogress", "confirmed", "accepted", "processing"].includes(status))) return "confirmed";
  return "pending_zalo";
}

function flattenPartnerItemOptions(value) {
  const result = [];

  function walk(item) {
    if (!item) return;
    if (typeof item === "string") {
      const label = item.trim();
      if (label) result.push(label);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (typeof item === "object") {
      const label = String(
        item.name ||
          item.label ||
          item.option_item ||
          item.optionName ||
          item.value ||
          item.title ||
          ""
      ).trim();
      if (label) result.push(label);
      [item.items, item.options, item.toppings, item.selectedOptions, item.values].forEach(walk);
    }
  }

  walk(value);
  return Array.from(new Set(result));
}

function mapPartnerOrderRow(row = {}) {
  const partnerSource = normalizePartnerSource(row.partner_source);
  const rawData = getObject(row.raw_data);
  const financeData = getObject(rawData.finance_data);
  const orderCode = String(row.order_code || "").trim();
  const displayOrderCode = String(row.display_order_code || orderCode).trim() || orderCode;
  const totalAmount = toNumber(row.total_amount ?? rawData.total);
  const subtotal = toNumber(row.subtotal ?? financeData.original_price ?? totalAmount);
  const shippingFee = toNumber(row.shipping_fee ?? financeData.shipping_fee ?? rawData.shipment_fee);
  const discountAmount = toNumber(row.discount_amount ?? financeData.total_promotion_price);
  const nexposOrderId = String(row.nexpos_order_id || rawData.nexpos_order_id || rawData.id || "").trim();
  const kitchenStatus = row.kitchen_work_status || row.kitchen_status || "";
  const loyaltyAmount = buildPartnerLoyaltyAmountSnapshot(row);
  return {
    id: row.id,
    sourceType: "partner",
    source: partnerSource,
    orderSource: partnerSource,
    channel: partnerSource,
    platform: partnerSource,
    partnerSource,
    nexposOrderId,
    orderCode,
    displayOrderCode,
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || row.customer_phone_key || "",
    customerPhoneKey: row.customer_phone_key || "",
    branchId: row.branch_id || "",
    branchUuid: row.branch_uuid || "",
    branchName: row.branch_name || row.nexpos_site_name || row.nexpos_hub_name || "",
    subtotal,
    shippingFee,
    discountAmount,
    promoDiscount: discountAmount,
    totalAmount,
    total: totalAmount,
    pointsBaseAmount: loyaltyAmount.pointsBaseAmount,
    loyaltyEligibleAmount: loyaltyAmount.loyaltyEligibleAmount,
    netReceivedAmount: loyaltyAmount.netReceivedAmount,
    expectedEarnPoints: toNumber(row.expected_earn_points),
    loyaltyHoldReason: loyaltyAmount.loyaltyHoldReason,
    status: normalizePartnerOrderStatus(row),
    orderStatus: row.order_status || "",
    nexposStatus: row.nexpos_status || row.raw_data?.status || "",
    kitchenStatus,
    kitchenWorkStatus: row.kitchen_work_status || "",
    kitchenDoneAt: row.kitchen_done_at || "",
    pointStatus: loyaltyAmount.pointStatus,
    fulfillmentType: "delivery",
    paymentMethod: "foodapp",
    createdAt: row.order_time || row.created_at || "",
    orderTime: row.order_time || row.created_at || "",
    updatedAt: row.updated_at || row.order_time || row.created_at || "",
    rawData,
    items: Array.isArray(row.items) ? row.items : []
  };
}

function mapPartnerOrderItemRow(row = {}) {
  const quantity = toNumber(row.quantity) || 1;
  const unitTotal = toNumber(row.unit_price);
  const lineTotal = toNumber(row.line_total) || unitTotal * quantity;
  const options = flattenPartnerItemOptions(row.options);
  const sourceItemId = String(row.id || "");
  const productId = String(row.web_product_id || row.partner_item_id || row.item_key || sourceItemId);
  const kitchenItemStatus = String(row.kitchen_item_status || row.item_status || "pending");
  return {
    id: productId || sourceItemId,
    sourceItemId,
    orderId: String(row.partner_order_id || ""),
    productId,
    product_id: productId,
    cartId: row.item_key || row.id || "",
    name: row.partner_item_name || row.web_product_name || "Món",
    quantity,
    price: unitTotal,
    unitTotal,
    lineTotal,
    note: row.note || "",
    toppings: options.map((name) => ({ name, price: 0 })),
    optionGroups: [],
    options,
    kitchenItemStatus,
    status: kitchenItemStatus,
    metadata: {}
  };
}

export async function getPartnerOrdersByPhone(phone, options = {}) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) return [];

  const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) return [];
  const limit = Number(options?.limit || 0);

  let ordersQuery = client
    .from("partner_orders")
    .select(
      "id,order_code,display_order_code,partner_source,nexpos_order_id,branch_id,branch_uuid,branch_name,nexpos_site_name,nexpos_hub_name,customer_name,customer_phone,customer_phone_key,subtotal,discount_amount,shipping_fee,total_amount,points_base_amount,expected_earn_points,order_status,nexpos_status,kitchen_status,kitchen_work_status,kitchen_done_at,point_status,raw_data,order_time,created_at,updated_at"
    )
    .eq("customer_phone_key", phoneKey)
    .order("order_time", { ascending: false });
  if (Number.isFinite(limit) && limit > 0) {
    ordersQuery = ordersQuery.limit(Math.floor(limit));
  }

  const { data, error } = await ordersQuery;

  if (error) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] getPartnerOrdersByPhone failed", error);
    }
    if (options?.throwOnError) throw error;
    return [];
  }

  const partnerOrders = (data || []).map(mapPartnerOrderRow);
  if (options?.hydrateCustomerProfile !== false && partnerOrders.length) {
    void hydratePartnerCustomerStubProfile(phoneKey, partnerOrders);
  }
  if (options?.includeItems === false) return partnerOrders;

  const orderIds = partnerOrders.map((order) => order.id).filter(Boolean);
  if (!orderIds.length) return partnerOrders;

  const { data: itemRows, error: itemError } = await client
    .from("partner_order_items")
    .select("id,item_key,partner_order_id,partner_item_id,web_product_id,partner_item_name,web_product_name,quantity,unit_price,line_total,options,note,item_status,kitchen_item_status")
    .in("partner_order_id", orderIds);

  if (itemError) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] partner_order_items read failed", itemError);
    }
    if (options?.throwOnError) throw itemError;
    return partnerOrders;
  }

  const itemsByOrderId = new Map();
  (itemRows || []).forEach((row) => {
    const key = row.partner_order_id;
    const nextItems = itemsByOrderId.get(key) || [];
    nextItems.push(mapPartnerOrderItemRow(row));
    itemsByOrderId.set(key, nextItems);
  });

  return partnerOrders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) || []
  }));
}

export function mergeCustomerLookupOrders(webOrders = [], partnerOrders = []) {
  const normalizedWebOrders = (webOrders || []).map((order) => ({
    ...order,
    sourceType: order.sourceType || "weborder",
    source: order.source || order.orderSource || "weborder",
    partnerSource: order.partnerSource || "weborder"
  }));

  const dedupedOrders = [...normalizedWebOrders, ...(partnerOrders || [])].reduce((map, order) => {
    const key = getCustomerLookupOrderKey(order);
    const current = map.get(key);
    if (!current) {
      map.set(key, order);
      return map;
    }

    const currentItems = Array.isArray(current.items) ? current.items.length : 0;
    const incomingItems = Array.isArray(order.items) ? order.items.length : 0;
    const currentTime = new Date(current.updatedAt || current.orderTime || current.createdAt || 0).getTime();
    const incomingTime = new Date(order.updatedAt || order.orderTime || order.createdAt || 0).getTime();
    if (incomingItems > currentItems || incomingTime > currentTime) {
      map.set(key, order);
    }
    return map;
  }, new Map());

  return [...dedupedOrders.values()].sort((first, second) => {
    const firstTime = new Date(first.orderTime || first.createdAt || 0).getTime();
    const secondTime = new Date(second.orderTime || second.createdAt || 0).getTime();
    return secondTime - firstTime;
  });
}

export async function claimPartnerOrderPoints({ orderId = null, orderCode = "", phone = "" } = {}) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }
  if (!orderId) {
    return { ok: false, message: "Không tìm thấy đơn đối tác để cộng điểm." };
  }

  try {
    const result = await coreSupabaseRepository.processOrderLoyalty({
      sourceType: "PARTNER_ORDER",
      sourceOrderId: orderId,
      action: "CLAIM_PARTNER_EARN",
      idempotencyKey: buildOrderLoyaltyIdempotencyKey({
        sourceType: "PARTNER_ORDER",
        sourceOrderId: orderId,
        action: "CLAIM_PARTNER_EARN"
      })
    });
    const points = Math.max(0, toNumber(result?.points_delta));
    const alreadyClaimed = result?.applied === false;
    return {
      ok: Boolean(result?.ok),
      alreadyClaimed,
      pointStatus: result?.ok ? "claimed" : "",
      message: result?.message || (alreadyClaimed
        ? "Điểm của đơn này đã được ghi nhận trước đó."
        : "Cộng điểm thành công."),
      partnerOrderId: orderId,
      partnerOrderCode: orderCode,
      points,
      totalPoints: Math.max(0, toNumber(result?.balance_after))
    };
  } catch (error) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] claimPartnerOrderPoints failed", error);
    }
    return {
      ok: false,
      message: error?.message || "Chưa thể cộng điểm lúc này. Bạn thử lại sau một chút nhé."
    };
  }
}
