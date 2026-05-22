import { initSupabaseRuntimeClient, getSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { normalizePartnerSource, resolveOrderSourceKey } from "./partnerOrderService.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatusFromPartner(order = {}) {
  const orderStatus = String(order.order_status || "").trim().toLowerCase();
  const kitchenStatus = String(order.kitchen_status || "").trim().toLowerCase();

  if (["done", "completed", "finish", "finished", "served"].includes(orderStatus)) return "done";
  if (["cancelled", "canceled", "refunded"].includes(orderStatus)) return "done";
  if (["delivering", "shipping"].includes(orderStatus)) return "delivering";
  if (["preparing", "cooking", "doing", "confirmed", "accepted"].includes(orderStatus)) return "confirmed";

  if (["done", "served"].includes(kitchenStatus)) return "done";
  if (["cooking", "preparing", "doing"].includes(kitchenStatus)) return "confirmed";

  return "pending_zalo";
}

function mapPartnerItemRow(item = {}) {
  const quantity = toNumber(item.quantity, 1);
  const unitPrice = toNumber(item.unit_price, 0);
  const lineTotal = toNumber(item.line_total, unitPrice * quantity);
  const options = Array.isArray(item.options) ? item.options.flat(Infinity).filter(Boolean) : [];
  return {
    id: item.id || item.item_key || "",
    name: item.partner_item_name || item.web_product_name || "Món",
    quantity,
    price: unitPrice,
    unitTotal: unitPrice,
    lineTotal,
    toppings: options
      .map((option) => ({
        name: option?.name || option?.option_item || "",
        price: toNumber(option?.price, 0),
        quantity: toNumber(option?.quantity, 1)
      }))
      .filter((option) => option.name),
    note: item.note || ""
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
  return {
    id: order.id || orderCode,
    sourceType: "partner",
    source,
    orderSource: source,
    channel: source,
    orderCode,
    displayOrderCode,
    customerName: order.customer_name || "",
    customerPhone: order.customer_phone || order.customer_phone_key || "",
    customerPhoneKey: order.customer_phone_key || "",
    status: normalizeStatusFromPartner(order),
    nexposStatus: order.nexpos_status || rawData.status || "",
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
    pointsBaseAmount: toNumber(order.points_base_amount, totalAmount),
    grossReceived: toNumber(rawData.total_for_biz, toNumber(financeData.gross_received, 0)),
    netReceived: toNumber(financeData.net_received, 0),
    realReceived: toNumber(financeData.real_received, 0),
    financeData,
    rawData,
    pointStatus: order.point_status || "pending",
    branchId: order.branch_id || "",
    branchUuid: order.branch_uuid || "",
    branchName: order.branch_name || order.nexpos_site_name || order.nexpos_hub_name || "",
    createdAt: order.order_time || order.created_at || "",
    items: itemsByOrderId.get(order.id) || []
  };
}

function normalizeWebOrder(order = {}) {
  const source = resolveOrderSourceKey(order);
  const orderCode = String(order.orderCode || order.id || "").trim();
  return {
    ...order,
    id: order.id || orderCode,
    sourceType: order.sourceType || "weborder",
    source,
    orderSource: source,
    channel: source,
    orderCode,
    displayOrderCode: order.displayOrderCode || orderCode
  };
}

export function buildAdminOrderFeed(webOrders = [], partnerOrders = []) {
  const normalizedWebOrders = (Array.isArray(webOrders) ? webOrders : []).map(normalizeWebOrder);
  const normalizedPartnerOrders = Array.isArray(partnerOrders) ? partnerOrders : [];
  return [...normalizedWebOrders, ...normalizedPartnerOrders].sort((a, b) => {
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
    .select("id,order_code,display_order_code,partner_source,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,kitchen_status,point_status,subtotal,discount_amount,shipping_fee,total_amount,points_base_amount,branch_id,branch_uuid,branch_name,nexpos_site_name,nexpos_hub_name,raw_data,order_time,created_at")
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
  let itemsByOrderId = new Map();
  if (orderIds.length) {
    const { data: itemRows, error: itemError } = await client
      .from("partner_order_items")
      .select("id,item_key,partner_order_id,partner_item_name,web_product_name,quantity,unit_price,line_total,options,note,item_status")
      .in("partner_order_id", orderIds);
    recordAdminRequest("read partner order items", "partner_order_items");

    if (itemError) {
      console.warn("[adminOrderFeedService] read partner_order_items failed", itemError);
    } else {
      itemsByOrderId = (itemRows || []).reduce((map, row) => {
        const list = map.get(row.partner_order_id) || [];
        list.push(mapPartnerItemRow(row));
        map.set(row.partner_order_id, list);
        return map;
      }, new Map());
    }
  }

  return (orderRows || []).map((order) => mapPartnerOrderRow(order, itemsByOrderId));
}
