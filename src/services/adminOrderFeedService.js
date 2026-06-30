import {
  ensureSupabaseRealtimeReady,
  initSupabaseRuntimeClient,
  getSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import {
  getPartnerOrderIdentityKey,
  normalizePartnerSource,
  resolveSalesChannelKey
} from "./partnerOrderService.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { buildOrderCountingPhoneVariants } from "./customerOrderCountingService.js";
import { buildPartnerLoyaltyAmountSnapshot } from "./partnerOrderAmountService.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function toStatusToken(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeStatusFromPartner(order = {}) {
  const rawData = order.raw_data && typeof order.raw_data === "object" ? order.raw_data : {};
  const statuses = [
    order.order_status,
    order.kitchen_status,
    order.kitchen_work_status,
    order.nexpos_status,
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

function mapPartnerItemRow(item = {}) {
  const quantity = toNumber(item.quantity, 1);
  const unitPrice = toNumber(item.unit_price, 0);
  const lineTotal = toNumber(item.line_total, unitPrice * quantity);
  const options = flattenPartnerItemOptions(item.options);
  const sourceItemId = String(item.id || "");
  const productId = String(item.web_product_id || item.partner_item_id || item.item_key || sourceItemId);
  const kitchenItemStatus = String(item.kitchen_item_status || item.item_status || "pending");
  return {
    id: productId || sourceItemId,
    sourceItemId,
    orderId: String(item.partner_order_id || ""),
    productId,
    product_id: productId,
    name: item.partner_item_name || item.web_product_name || "Món",
    quantity,
    price: unitPrice,
    unitTotal: unitPrice,
    lineTotal,
    toppings: options.map((name) => ({ name, price: 0, quantity: 1 })),
    optionGroups: [],
    options,
    note: item.note || "",
    kitchenItemStatus,
    status: kitchenItemStatus,
    metadata: {}
  };
}

function mapPartnerOrderRow(order = {}, itemsByOrderId = new Map()) {
  const source = normalizePartnerSource(order.partner_source || "");
  const orderCode = String(order.order_code || "").trim();
  const displayOrderCode = String(order.display_order_code || orderCode).trim() || orderCode;
  const rawData = order.raw_data && typeof order.raw_data === "object" ? order.raw_data : {};
  const financeData = rawData.finance_data && typeof rawData.finance_data === "object" ? rawData.finance_data : {};
  const subtotal = toNumber(order.subtotal, toNumber(financeData.original_price, toNumber(order.total_amount, 0)));
  const shippingFee = toNumber(order.shipping_fee, toNumber(financeData.shipping_fee, toNumber(rawData.shipment_fee, 0)));
  const totalPromotion = toNumber(order.discount_amount, toNumber(financeData.total_promotion_price, 0));
  const coFundPromotion = toNumber(financeData.co_fund_promotion_price, 0);
  const otherPromotion = toNumber(financeData.other_promotion_price, 0);
  const totalAmount = toNumber(order.total_amount, toNumber(rawData.total, 0));
  const loyaltyAmount = buildPartnerLoyaltyAmountSnapshot(order);
  return {
    id: order.id || orderCode,
    sourceType: "partner",
    source,
    partnerSource: source,
    orderSource: source,
    channel: source,
    platform: source,
    orderCode,
    displayOrderCode,
    customerName: order.customer_name || "",
    customerPhone: order.customer_phone || order.customer_phone_key || "",
    customerPhoneKey: order.customer_phone_key || "",
    status: normalizeStatusFromPartner(order),
    orderStatus: order.order_status || "",
    nexposStatus: order.nexpos_status || rawData.status || "",
    kitchenStatus: order.kitchen_work_status || order.kitchen_status || "",
    kitchenWorkStatus: order.kitchen_work_status || "",
    kitchenDoneAt: order.kitchen_done_at || "",
    fulfillmentType: "delivery",
    paymentMethod: "foodapp",
    subtotal,
    shippingFee,
    discountAmount: totalPromotion,
    promoDiscount: totalPromotion,
    coFundPromotion,
    otherPromotion,
    totalPromotion,
    totalAmount,
    total: totalAmount,
    pointsBaseAmount: loyaltyAmount.pointsBaseAmount,
    loyaltyEligibleAmount: loyaltyAmount.loyaltyEligibleAmount,
    netReceivedAmount: loyaltyAmount.netReceivedAmount,
    loyaltyHoldReason: loyaltyAmount.loyaltyHoldReason,
    grossReceived: toNumber(rawData.total_for_biz, toNumber(financeData.gross_received, 0)),
    netReceived: toNumber(financeData.net_received, 0),
    realReceived: toNumber(financeData.real_received, 0),
    financeData,
    rawData,
    nexposOrderId: order.nexpos_order_id || rawData.nexpos_order_id || rawData.id || "",
    pointStatus: loyaltyAmount.pointStatus,
    branchId: order.branch_id || "",
    branchUuid: order.branch_uuid || "",
    branchName: order.branch_name || order.nexpos_site_name || order.nexpos_hub_name || "",
    createdAt: order.order_time || order.created_at || "",
    updatedAt: order.updated_at || order.order_time || order.created_at || "",
    items: itemsByOrderId.get(order.id) || []
  };
}

function dedupeRowsById(rows = []) {
  return [...(Array.isArray(rows) ? rows : []).reduce((map, row) => {
    const key = String(row?.id || row?.order_code || "").trim();
    if (key && !map.has(key)) map.set(key, row);
    return map;
  }, new Map()).values()];
}

async function readPartnerOrderItemsByOrderIds(client, orderIds = []) {
  const safeOrderIds = (Array.isArray(orderIds) ? orderIds : []).filter(Boolean);
  let itemsByOrderId = new Map();
  if (!safeOrderIds.length) return itemsByOrderId;

  const { data: itemRows, error: itemError } = await client
    .from("partner_order_items")
    .select("id,item_key,partner_order_id,partner_item_id,web_product_id,partner_item_name,web_product_name,quantity,unit_price,line_total,options,note,item_status,kitchen_item_status")
    .in("partner_order_id", safeOrderIds);
  recordAdminRequest("read partner order items", "partner_order_items");

  if (itemError) {
    console.warn("[adminOrderFeedService] read partner_order_items failed", itemError);
    return itemsByOrderId;
  }

  itemsByOrderId = (itemRows || []).reduce((map, row) => {
    const list = map.get(row.partner_order_id) || [];
    list.push(mapPartnerItemRow(row));
    map.set(row.partner_order_id, list);
    return map;
  }, new Map());

  return itemsByOrderId;
}

function normalizeWebOrder(order = {}) {
  const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const source = resolveSalesChannelKey(order);
  const orderCode = String(order.orderCode || order.id || "").trim();
  const displayOrderCode = String(
    order.displayOrderCode ||
    metadata.displayOrderCode ||
    metadata.display_order_code ||
    orderCode
  ).trim() || orderCode;
  return {
    ...order,
    id: order.id || orderCode,
    sourceType: order.sourceType || "weborder",
    source,
    orderSource: source,
    channel: source,
    orderCode,
    displayOrderCode
  };
}

function getAdminOrderFeedKey(order = {}) {
  const sourceType = String(order?.sourceType || "").trim().toLowerCase();
  const source = sourceType === "partner" ? "partner" : "website";
  const rawData = order?.rawData && typeof order.rawData === "object" ? order.rawData : {};
  if (source === "partner") {
    return getPartnerOrderIdentityKey(order) || `${source}:unknown-${Math.random()}`;
  }

  const key = String(
    order?.displayOrderCode ||
      order?.orderCode ||
      order?.id ||
      rawData?.display_order_code ||
      rawData?.order_code ||
      rawData?.id ||
      ""
  ).trim();

  return key ? `${source}:${key}` : `${source}:unknown-${Math.random()}`;
}

function preferRicherOrder(current = {}, incoming = {}) {
  const currentItems = Array.isArray(current?.items) ? current.items.length : 0;
  const incomingItems = Array.isArray(incoming?.items) ? incoming.items.length : 0;
  if (incomingItems > currentItems) return incoming;

  const currentUpdated = new Date(current?.updatedAt || current?.createdAt || 0).getTime();
  const incomingUpdated = new Date(incoming?.updatedAt || incoming?.createdAt || 0).getTime();
  if (Number.isFinite(incomingUpdated) && incomingUpdated > currentUpdated) return incoming;

  return current;
}

export function buildAdminOrderFeed(webOrders = [], partnerOrders = []) {
  const normalizedWebOrders = (Array.isArray(webOrders) ? webOrders : []).map(normalizeWebOrder);
  const normalizedPartnerOrders = Array.isArray(partnerOrders) ? partnerOrders : [];
  const dedupedOrders = [...normalizedWebOrders, ...normalizedPartnerOrders].reduce((map, order) => {
    const key = getAdminOrderFeedKey(order);
    const current = map.get(key);
    map.set(key, current ? preferRicherOrder(current, order) : order);
    return map;
  }, new Map());

  return [...dedupedOrders.values()].sort((a, b) => {
    const aTime = new Date(a?.createdAt || 0).getTime();
    const bTime = new Date(b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export async function readPartnerOrdersForAdmin({ dateFrom = "", dateTo = "" } = {}) {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client) return [];

  let query = client
    .from("partner_orders")
    .select("id,order_code,display_order_code,partner_source,nexpos_order_id,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,kitchen_status,kitchen_work_status,kitchen_done_at,point_status,subtotal,discount_amount,shipping_fee,total_amount,points_base_amount,branch_id,branch_uuid,branch_name,nexpos_site_name,nexpos_hub_name,raw_data,order_time,created_at,updated_at")
    .order("order_time", { ascending: false });

  if (dateFrom) query = query.gte("order_time", dateFrom);
  if (dateTo) query = query.lt("order_time", dateTo);

  const { data: orderRows, error: orderError } = await query;
  recordAdminRequest("read partner orders", "partner_orders");
  if (orderError) {
    console.warn("[adminOrderFeedService] read partner_orders failed", orderError);
    return [];
  }

  const orderIds = (orderRows || []).map((row) => row.id).filter(Boolean);
  const itemsByOrderId = await readPartnerOrderItemsByOrderIds(client, orderIds);

  return (orderRows || []).map((order) => mapPartnerOrderRow(order, itemsByOrderId));
}

export async function readCustomerPartnerOrdersForAdmin(phone = "", { limit = 100 } = {}) {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client) return [];

  const phoneVariants = buildOrderCountingPhoneVariants([phone]);
  if (!phoneVariants.length) return [];

  const safeLimit = Math.max(3, Math.min(100, Number(limit || 100)));
  const columns = "id,order_code,display_order_code,partner_source,nexpos_order_id,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,kitchen_status,kitchen_work_status,kitchen_done_at,point_status,subtotal,discount_amount,shipping_fee,total_amount,points_base_amount,branch_id,branch_uuid,branch_name,nexpos_site_name,nexpos_hub_name,raw_data,order_time,created_at,updated_at";
  const rows = [];

  for (const column of ["customer_phone_key", "customer_phone"]) {
    const { data, error } = await client
      .from("partner_orders")
      .select(columns)
      .in(column, phoneVariants)
      .order("order_time", { ascending: false })
      .limit(safeLimit);
    recordAdminRequest("read customer partner orders", "partner_orders");

    if (error) {
      console.warn("[adminOrderFeedService] read customer partner orders failed", error);
      continue;
    }

    rows.push(...(Array.isArray(data) ? data : []));
  }

  const orderRows = dedupeRowsById(rows)
    .sort((a, b) => new Date(b.order_time || b.created_at || 0) - new Date(a.order_time || a.created_at || 0))
    .slice(0, safeLimit);
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);
  const itemsByOrderId = await readPartnerOrderItemsByOrderIds(client, orderIds);

  return orderRows.map((order) => mapPartnerOrderRow(order, itemsByOrderId));
}

export async function subscribeAdminOrderChanges(onChange) {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client || typeof onChange !== "function") return () => {};
  if (!(await ensureSupabaseRealtimeReady(client))) return () => {};

  const channel = client
    .channel(`admin-order-feed-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => onChange({ table: "orders", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      (payload) => onChange({ table: "order_items", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "partner_orders" },
      (payload) => onChange({ table: "partner_orders", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "partner_order_items" },
      (payload) => onChange({ table: "partner_order_items", payload })
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
