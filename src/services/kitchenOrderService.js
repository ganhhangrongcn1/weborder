import { initSupabaseRuntimeClient, getSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { normalizePartnerSource, resolveOrderSourceKey } from "./partnerOrderService.js";
import { applyOrderLoyaltyAsync } from "./loyaltyService.js";
import { recordKitchenRequest } from "./kitchenRequestAuditService.js";

const KITCHEN_SOURCE = {
  website: "website",
  partner: "partner"
};

const PLATFORM_LABELS = {
  website: "Website",
  weborder: "Website",
  online: "Website",
  pickup: "Tự lấy",
  qr_counter: "QR tại quầy",
  grabfood: "Grab",
  grab: "Grab",
  shopeefood: "Shopee",
  shopee: "Shopee",
  xanhngon: "Xanh Ngon",
  xanh_ngon: "Xanh Ngon"
};

const WEBSITE_ORDER_COLUMNS = [
  "id",
  "order_code",
  "customer_phone",
  "customer_name",
  "fulfillment_type",
  "payment_method",
  "status",
  "subtotal",
  "shipping_fee",
  "promo_discount",
  "promo_code",
  "points_discount",
  "shipping_support_discount",
  "total_amount",
  "branch_name",
  "metadata",
  "created_at",
  "updated_at",
  "branch_uuid",
  "pickup_branch_uuid",
  "delivery_branch_uuid",
  "branch_id",
  "pickup_branch_id",
  "delivery_branch_id",
  "pickup_branch_name",
  "delivery_branch_name",
  "kitchen_status",
  "kitchen_done_at"
].join(",");

const WEBSITE_ITEM_COLUMNS = [
  "id",
  "order_id",
  "product_id",
  "product_name",
  "quantity",
  "unit_price",
  "line_total",
  "note",
  "toppings",
  "spice",
  "kitchen_item_status",
  "metadata"
].join(",");

const PARTNER_ORDER_COLUMNS = [
  "id",
  "order_code",
  "display_order_code",
  "partner_source",
  "branch_id",
  "branch_name",
  "customer_name",
  "customer_phone",
  "customer_phone_key",
  "total_amount",
  "order_status",
  "kitchen_status",
  "order_time",
  "created_at",
  "updated_at",
  "raw_data",
  "nexpos_order_id",
  "nexpos_hub_name",
  "nexpos_site_name",
  "branch_uuid",
  "nexpos_status",
  "kitchen_work_status",
  "kitchen_done_at"
].join(",");

const PARTNER_ITEM_COLUMNS = [
  "id",
  "partner_order_id",
  "item_key",
  "web_product_id",
  "partner_item_id",
  "web_product_name",
  "partner_item_name",
  "quantity",
  "note",
  "options",
  "kitchen_item_status"
].join(",");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function canUseDoneQueryLimit(options = {}) {
  return (
    toText(options.statusFilter) === "done" &&
    toText(options.sourceFilter || "all") === "all" &&
    toText(options.branchUuid) &&
    toPositiveInteger(options.doneLimit) > 0
  );
}

function applyWebsiteBranchFilter(query, branchUuid = "") {
  const uuid = toText(branchUuid);
  if (!uuid) return query;
  return query.or(`branch_uuid.eq.${uuid},pickup_branch_uuid.eq.${uuid},delivery_branch_uuid.eq.${uuid}`);
}

function applyPartnerBranchFilter(query, branchUuid = "") {
  const uuid = toText(branchUuid);
  if (!uuid) return query;
  return query.eq("branch_uuid", uuid);
}

function applyWebsiteDoneFilter(query) {
  return query.or("status.in.(done,completed,complete),kitchen_status.in.(done,completed,complete)");
}

function applyPartnerDoneFilter(query) {
  return query.or("kitchen_work_status.in.(done,completed,complete),order_status.in.(done,completed,complete),nexpos_status.in.(FINISH,finish,finished,completed,done)");
}

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeSearchText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getStableItemSortValue(row = {}, fallbackIndex = 0) {
  const metadata = getObject(row.metadata);
  const index = toNumber(metadata.ghrOrderIndex, Number.NaN);
  if (Number.isFinite(index)) return index;

  const rawKey = toText(metadata.cartId || row.item_key || row.id || row.product_id);
  if (!rawKey) return fallbackIndex + 100000;

  return rawKey.split("").reduce((total, character) => total + character.charCodeAt(0), 0) + 50000;
}

function sortKitchenItemRows(rows = []) {
  return getArray(rows).map((row, index) => ({ row, index })).sort((first, second) => {
    const firstIndex = getStableItemSortValue(first.row, first.index);
    const secondIndex = getStableItemSortValue(second.row, second.index);
    if (firstIndex !== secondIndex) return firstIndex - secondIndex;
    return toText(first.row.id || first.row.item_key || first.row.product_id).localeCompare(
      toText(second.row.id || second.row.item_key || second.row.product_id),
      "vi"
    );
  }).map((item) => item.row);
}

function getPlatformLabel(source = "") {
  const key = toText(source).toLowerCase();
  return PLATFORM_LABELS[key] || "Khác";
}

function buildKitchenStableKey(sourceType = "", ...values) {
  const key = values.map(toText).find(Boolean);
  return key ? `${toText(sourceType || "order")}:${key}` : "";
}

function normalizeKitchenStatus(...values) {
  const combined = values.map((value) => toText(value).toLowerCase()).filter(Boolean);

  if (combined.some((status) => ["cancelled", "canceled", "cancel", "refunded"].includes(status))) {
    return "cancelled";
  }

  if (combined.some((status) => ["done", "completed", "complete", "finish", "finished", "served"].includes(status))) {
    return "done";
  }

  if (combined.some((status) => ["ready", "ready_to_pickup", "ready_to_ship"].includes(status))) {
    return "ready";
  }

  if (combined.some((status) => ["preparing", "cooking", "doing", "in_progress"].includes(status))) {
    return "cooking";
  }

  if (combined.some((status) => ["preorder", "pre_order", "scheduled", "dat_truoc", "dattruoc"].includes(status))) {
    return "preorder";
  }

  if (combined.some((status) => ["confirmed", "accepted", "processing"].includes(status))) {
    return "confirmed";
  }

  return "pending";
}

function normalizeStatusToken(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeNexposOrderState(...values) {
  const tokens = values.map(normalizeStatusToken).filter(Boolean);

  if (tokens.some((status) => ["cancel", "canceled", "cancelled", "huy", "dahuy"].includes(status))) {
    return "cancelled";
  }

  if (tokens.some((status) => ["finish", "finished", "complete", "completed", "done", "served", "hoantat", "daxong"].includes(status))) {
    return "done";
  }

  if (tokens.some((status) => ["preorder", "preordered", "scheduled", "dattruoc", "dontruoc"].includes(status))) {
    return "preorder";
  }

  if (tokens.some((status) => ["doing", "pick", "picking", "preparing", "cooking", "inprogress", "ready"].includes(status))) {
    return "active";
  }

  return "";
}

function deriveKitchenStatusFromNexpos(kitchenStatus = "pending", nexposState = "") {
  if (["cancelled", "done", "preorder"].includes(nexposState)) return nexposState;
  const normalizedKitchenStatus = normalizeKitchenStatus(kitchenStatus);
  if (nexposState === "active" && normalizedKitchenStatus === "pending") return "cooking";
  return normalizedKitchenStatus;
}

function getDisplayStatus(kitchenStatus = "") {
  const status = normalizeKitchenStatus(kitchenStatus);
  if (status === "cancelled") return "Đã hủy";
  if (status === "preorder") return "Đặt trước";
  if (status === "done") return "Đã xong";
  if (status === "ready") return "Sẵn sàng";
  if (status === "cooking") return "Đang làm";
  if (status === "confirmed") return "Đã nhận";
  return "Đang chờ";
}

function normalizeOrderStatus(value = "") {
  return toText(value).toLowerCase();
}

function isOrderSettlementDone(status = "") {
  return ["done", "completed", "complete", "hoàn tất", "hoan tat"].includes(normalizeOrderStatus(status));
}

function getWebsiteBranchDisplayStatus(orderStatus = "", kitchenStatus = "", fulfillmentType = "") {
  const status = normalizeOrderStatus(orderStatus);
  const kitchen = normalizeKitchenStatus(kitchenStatus);
  const fulfillment = normalizeOrderStatus(fulfillmentType);

  if (["cancelled", "canceled", "cancel"].includes(status) || kitchen === "cancelled") return "Đã hủy";
  if (isOrderSettlementDone(status)) return "Hoàn thành";
  if (status === "delivering") return "Đang giao";
  if (status === "ready_for_pickup" || (fulfillment === "pickup" && kitchen === "ready")) return "Chờ khách lấy";
  if (status === "ready_for_delivery" || (fulfillment === "delivery" && kitchen === "ready")) return "Chờ shipper";
  if (kitchen === "ready") return "Sẵn sàng";
  return getDisplayStatus(kitchen);
}

function isWebsiteOrderReady(order = {}) {
  const status = normalizeOrderStatus(order.status);
  return status === "ready_for_pickup" || status === "ready_for_delivery";
}

function isLegacyWebsiteKitchenDone(order = {}) {
  const status = normalizeOrderStatus(order.status);
  const kitchenStatus = normalizeKitchenStatus(order.kitchenStatus);
  return order.sourceType === KITCHEN_SOURCE.website &&
    kitchenStatus === "done" &&
    !["ready_for_pickup", "ready_for_delivery", "delivering", "done", "completed"].includes(status);
}

function getOrderLoyaltyPayload(order = {}, completedAt = new Date().toISOString()) {
  const raw = getObject(order.raw);
  const metadata = getObject(raw.metadata);
  return {
    phone: order.customerPhone || raw.customer_phone || metadata.customerPhone || metadata.phone || "",
    orderId: order.orderCode || raw.order_code || order.id,
    amount: Number(
      metadata.pointsBaseAmount ??
        raw.points_base_amount ??
        Math.max(
          Number(metadata.subtotal ?? raw.subtotal ?? order.totalAmount ?? 0) -
            Number(metadata.promoDiscount ?? raw.promo_discount ?? 0),
          0
        )
    ),
    createdAt: completedAt,
    promoSource: metadata.promoSource || raw.promo_source || "",
    promoVoucherId: metadata.promoVoucherId || raw.promo_voucher_id || "",
    promoCode: metadata.promoCode || raw.promo_code || "",
    pointsDiscount: Number(metadata.pointsDiscount ?? raw.points_discount ?? 0),
    orderStatus: "done"
  };
}

export function getNextKitchenOrderAction(order = {}) {
  const status = normalizeOrderStatus(order.status);
  const kitchenStatus = normalizeKitchenStatus(order.kitchenStatus);
  const fulfillmentType = normalizeOrderStatus(order.fulfillmentType);
  const isClosed = ["cancelled", "preorder"].includes(kitchenStatus) ||
    ["cancelled", "canceled", "cancel"].includes(status) ||
    isOrderSettlementDone(status) ||
    isLegacyWebsiteKitchenDone(order);

  if (isClosed) return null;

  if (order.sourceType === KITCHEN_SOURCE.partner) {
    if (["done", "ready"].includes(kitchenStatus)) return null;
    return {
      type: "partner_done",
      label: "Xác nhận xong đơn",
      nextStatus: status || "done",
      nextKitchenStatus: "done",
      requiresReady: true
    };
  }

  if (fulfillmentType === "pickup") {
    if (!isWebsiteOrderReady(order)) {
      return {
        type: "ready_for_pickup",
        label: "Đã chuẩn bị xong",
        nextStatus: "ready_for_pickup",
        nextKitchenStatus: "done",
        requiresReady: true
      };
    }

    return {
      type: "pickup_completed",
      label: "Khách đã lấy",
      nextStatus: "done",
      nextKitchenStatus: "done",
      settleOrder: true
    };
  }

  if (status === "delivering") {
    return {
      type: "delivery_completed",
      label: "Hoàn thành",
      nextStatus: "done",
      nextKitchenStatus: "done",
      settleOrder: true
    };
  }

  if (!isWebsiteOrderReady(order)) {
    return {
      type: "ready_for_delivery",
      label: "Đã chuẩn bị xong",
      nextStatus: "ready_for_delivery",
      nextKitchenStatus: "done",
      requiresReady: true
    };
  }

  return {
    type: "handoff_shipper",
    label: "Đã giao shipper",
    nextStatus: "delivering",
    nextKitchenStatus: "done"
  };
}

function getOrderTimeValue(order = {}) {
  const raw = order.createdAt || order.orderTime || order.updatedAt || "";
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesBranch(order = {}, { branchUuid = "", branchId = "", branchName = "", branchAlias = "" } = {}) {
  const uuid = toText(branchUuid).toLowerCase();
  const id = toText(branchId).toLowerCase();
  const name = normalizeSearchText(branchName);
  const alias = normalizeSearchText(branchAlias);
  if (!uuid && !id && !name && !alias) return true;

  const candidates = [
    order.branchUuid,
    order.pickupBranchUuid,
    order.deliveryBranchUuid,
    order.branchId,
    order.pickupBranchId,
    order.deliveryBranchId,
    order.branchName,
    order.pickupBranchName,
    order.deliveryBranchName
  ].map((value) => toText(value)).filter(Boolean);

  const rawCandidates = candidates.map((value) => value.toLowerCase());
  if (rawCandidates.some((candidate) => candidate === uuid || candidate === id)) return true;

  const normalizedCandidates = candidates.map(normalizeSearchText).filter(Boolean);
  return normalizedCandidates.some((candidate) => {
    if (name && (candidate === name || candidate.includes(name) || name.includes(candidate))) return true;
    if (alias && (candidate === alias || candidate.includes(alias) || alias.includes(candidate))) return true;
    return false;
  });
}

function flattenOptionLabels(value) {
  const result = [];

  function walk(item) {
    if (!item) return;
    if (typeof item === "string") {
      const label = toText(item);
      if (label) result.push(label);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (typeof item === "object") {
      const label = toText(
        item.name ||
          item.label ||
          item.option_item ||
          item.optionName ||
          item.value ||
          item.title
      );
      if (label) result.push(label);
      [
        item.items,
        item.options,
        item.toppings,
        item.selectedOptions,
        item.values
      ].forEach(walk);
    }
  }

  walk(value);
  return [...new Set(result)];
}

function formatSelectedOptionLabel(option = {}) {
  if (typeof option === "string") return toText(option);
  if (!option || typeof option !== "object" || Array.isArray(option)) return "";

  const group = toText(
    option.groupName ||
      option.group_name ||
      option.group ||
      option.optionGroupName ||
      option.option_group_name
  );
  const value = toText(
    option.name ||
      option.label ||
      option.option_item ||
      option.optionName ||
      option.value ||
      option.title
  );

  if (group && value) return `${group}: ${value}`;
  return value || group;
}

function getOptionGroupKey(label = "") {
  const text = toText(label);
  const separatorIndex = text.search(/[:\-–—]/);
  if (separatorIndex <= 0) return "";
  return normalizeSearchText(text.slice(0, separatorIndex));
}

function pushUniqueOption(result, seen, label = "") {
  const cleaned = toText(label);
  const key = normalizeSearchText(cleaned);
  if (!cleaned || !key || seen.has(key)) return;
  result.push(cleaned);
  seen.add(key);
}

function flattenSelectedOptionLabels(value) {
  const result = [];
  const seen = new Set();

  function walk(item) {
    if (!item) return;
    if (typeof item === "string") {
      pushUniqueOption(result, seen, item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (typeof item === "object") {
      pushUniqueOption(result, seen, formatSelectedOptionLabel(item));
      [item.items, item.toppings, item.selectedOptions, item.values].forEach(walk);
    }
  }

  walk(value);
  return result;
}

function buildWebsiteOptionLabels(row = {}, metadata = {}) {
  const selectedOptions = [
    ...flattenSelectedOptionLabels(row.toppings),
    ...flattenSelectedOptionLabels(metadata.toppings)
  ];
  const seen = new Set();
  const options = [];

  selectedOptions.forEach((label) => pushUniqueOption(options, seen, label));

  const selectedGroups = new Set(options.map(getOptionGroupKey).filter(Boolean));
  const spiceLabel = toText(row.spice || metadata.spice);
  const spiceGroup = getOptionGroupKey(spiceLabel);
  if (spiceLabel && (!spiceGroup || !selectedGroups.has(spiceGroup))) {
    pushUniqueOption(options, seen, spiceLabel);
  }

  return options;
}

function mapWebsiteKitchenItem(row = {}) {
  const metadata = getObject(row.metadata);
  const quantity = toNumber(row.quantity ?? metadata.quantity, 1) || 1;
  const status = normalizeKitchenStatus(row.kitchen_item_status, metadata.kitchenStatus);
  const options = buildWebsiteOptionLabels(row, metadata);

  return {
    id: toText(row.id || row.product_id || metadata.id || metadata.cartId),
    sourceItemId: toText(row.id || ""),
    orderId: toText(row.order_id || ""),
    productId: toText(row.product_id || metadata.productId || metadata.product_id),
    name: toText(row.product_name || metadata.name) || "Không tên món",
    quantity,
    price: toNumber(row.unit_price ?? metadata.unitTotal ?? metadata.price, 0),
    unitTotal: toNumber(row.unit_price ?? metadata.unitTotal ?? metadata.price, 0),
    total: toNumber(row.line_total ?? metadata.lineTotal, 0),
    lineTotal: toNumber(row.line_total ?? metadata.lineTotal, 0),
    note: toText(row.note || metadata.note),
    options: [...new Set(options)],
    status,
    displayStatus: getDisplayStatus(status),
    raw: row
  };
}

function mapPartnerKitchenItem(row = {}) {
  const quantity = toNumber(row.quantity, 1) || 1;
  const options = flattenOptionLabels(row.options);
  const status = normalizeKitchenStatus(row.kitchen_item_status);

  return {
    id: toText(row.id || row.item_key),
    sourceItemId: toText(row.id || ""),
    orderId: toText(row.partner_order_id || ""),
    productId: toText(row.web_product_id || row.partner_item_id || row.item_key),
    name: toText(row.web_product_name || row.partner_item_name) || "Không tên món",
    quantity,
    note: toText(row.note),
    options,
    status,
    displayStatus: getDisplayStatus(status),
    raw: row
  };
}

function mapPartnerRawDishToKitchenItem(dish = {}, order = {}, index = 0) {
  const rawData = getObject(order.raw_data);
  const orderId = toText(order.id || order.order_code || rawData.order_id || rawData.id);
  const itemId = toText(dish.item_id || dish.model_id || dish.code || index);
  const quantity = toNumber(dish.quantity, 1) || 1;
  const status = normalizeKitchenStatus(order.kitchen_work_status, order.kitchen_status);

  return {
    id: `raw-dish-${orderId || "order"}-${itemId || index}`,
    sourceItemId: "",
    orderId,
    productId: itemId,
    name: toText(dish.name) || "Không tên món",
    quantity,
    note: toText(dish.note || dish.description),
    options: flattenOptionLabels(dish.options),
    status,
    displayStatus: getDisplayStatus(status),
    raw: dish
  };
}

function mapPartnerRawDishesToKitchenItems(row = {}) {
  const rawData = getObject(row.raw_data);
  return getArray(rawData.dishes)
    .filter((dish) => getObject(dish).is_gift !== true)
    .map((dish, index) => mapPartnerRawDishToKitchenItem(getObject(dish), row, index));
}

function mapWebsiteKitchenOrder(row = {}, itemsByOrderId = new Map()) {
  const metadata = getObject(row.metadata);
  const source = resolveOrderSourceKey({
    ...metadata,
    source: row.source || metadata.source,
    channel: row.channel || metadata.channel,
    orderSource: metadata.orderSource || row.source
  });
  const id = toText(row.id || row.order_code);
  const orderCode = toText(row.order_code || metadata.orderCode || id);
  const nexposStatus = toText(row.nexpos_status || metadata.nexposStatus || metadata.nexpos_status);
  const nexposState = normalizeNexposOrderState(
    nexposStatus,
    row.order_status,
    row.status,
    metadata.status
  );
  const status = toText(row.status || metadata.status || "pending");
  const kitchenStatus = deriveKitchenStatusFromNexpos(
    normalizeKitchenStatus(row.kitchen_status, metadata.kitchenStatus),
    nexposState
  );

  return {
    id,
    stableKey: buildKitchenStableKey(KITCHEN_SOURCE.website, id, orderCode),
    orderCode,
    displayOrderCode: toText(metadata.displayOrderCode || orderCode),
    sourceType: KITCHEN_SOURCE.website,
    source,
    platform: getPlatformLabel(source),
    branchId: toText(row.branch_id || metadata.branchId),
    branchUuid: toText(row.branch_uuid || metadata.branchUuid),
    branchName: toText(row.branch_name || metadata.branchName),
    pickupBranchId: toText(row.pickup_branch_id || metadata.pickupBranchId),
    pickupBranchUuid: toText(row.pickup_branch_uuid || metadata.pickupBranchUuid),
    pickupBranchName: toText(row.pickup_branch_name || metadata.pickupBranchName),
    deliveryBranchId: toText(row.delivery_branch_id || metadata.deliveryBranchId),
    deliveryBranchUuid: toText(row.delivery_branch_uuid || metadata.deliveryBranchUuid),
    deliveryBranchName: toText(row.delivery_branch_name || metadata.deliveryBranchName),
    customerName: toText(row.customer_name || metadata.customerName),
    customerPhone: toText(row.customer_phone || metadata.customerPhone || metadata.phone),
    status,
    nexposStatus,
    nexposState,
    kitchenStatus,
    displayStatus: getWebsiteBranchDisplayStatus(status, kitchenStatus, toText(row.fulfillment_type || metadata.fulfillmentType)),
    fulfillmentType: toText(row.fulfillment_type || metadata.fulfillmentType),
    paymentMethod: toText(row.payment_method || metadata.paymentMethod),
    subtotal: toNumber(row.subtotal ?? metadata.subtotal, 0),
    shippingFee: toNumber(row.shipping_fee ?? metadata.shippingFee, 0),
    promoCode: toText(row.promo_code || metadata.promoCode || metadata.couponCode),
    discount:
      toNumber(row.promo_discount ?? metadata.promoDiscount, 0) +
      toNumber(row.points_discount ?? metadata.pointsDiscount, 0) +
      toNumber(row.shipping_support_discount ?? metadata.shippingSupportDiscount, 0),
    totalAmount: toNumber(row.total_amount ?? metadata.totalAmount ?? metadata.total, 0),
    createdAt: toText(row.created_at || metadata.createdAt),
    updatedAt: toText(row.updated_at || metadata.updatedAt),
    items: itemsByOrderId.get(id) || [],
    raw: row
  };
}

function mapPartnerKitchenOrder(row = {}, itemsByOrderId = new Map()) {
  const rawData = getObject(row.raw_data);
  const source = normalizePartnerSource(row.partner_source || rawData.source || "");
  const id = toText(row.id || row.order_code);
  const orderCode = toText(row.order_code || id);
  const displayOrderCode = toText(row.display_order_code || orderCode);
  const items = itemsByOrderId.get(id) || mapPartnerRawDishesToKitchenItems(row);
  const nexposStatus = toText(row.nexpos_status || rawData.status);
  const nexposState = normalizeNexposOrderState(
    nexposStatus,
    rawData.order_status,
    row.order_status
  );
  const kitchenStatus = deriveKitchenStatusFromNexpos(
    normalizeKitchenStatus(row.kitchen_work_status, row.kitchen_status),
    nexposState
  );

  return {
    id,
    stableKey: buildKitchenStableKey(
      KITCHEN_SOURCE.partner,
      row.nexpos_order_id,
      rawData.nexpos_order_id,
      rawData.order_id,
      displayOrderCode,
      orderCode,
      id
    ),
    orderCode,
    displayOrderCode,
    sourceType: KITCHEN_SOURCE.partner,
    source,
    platform: getPlatformLabel(source),
    branchId: toText(row.branch_id),
    branchUuid: toText(row.branch_uuid),
    branchName: toText(row.branch_name || row.nexpos_site_name || row.nexpos_hub_name),
    pickupBranchId: "",
    pickupBranchUuid: "",
    pickupBranchName: "",
    deliveryBranchId: toText(row.branch_id),
    deliveryBranchUuid: toText(row.branch_uuid),
    deliveryBranchName: toText(row.branch_name || row.nexpos_site_name || row.nexpos_hub_name),
    customerName: toText(row.customer_name),
    customerPhone: toText(row.customer_phone || row.customer_phone_key),
    status: toText(row.order_status || row.nexpos_status || "pending"),
    nexposStatus,
    nexposState,
    kitchenStatus,
    displayStatus: getDisplayStatus(kitchenStatus),
    fulfillmentType: "delivery",
    paymentMethod: "foodapp",
    totalAmount: toNumber(row.total_amount, 0),
    createdAt: toText(row.order_time || row.created_at),
    updatedAt: toText(row.updated_at),
    items,
    raw: row
  };
}

async function getClient() {
  return getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
}

async function readOrderItems(client, orderIds = []) {
  if (!orderIds.length) return new Map();

  const { data, error } = await client
    .from("order_items")
    .select(WEBSITE_ITEM_COLUMNS)
    .in("order_id", orderIds);
  recordKitchenRequest("read website items", "order_items");

  if (error) throw error;

  return sortKitchenItemRows(data).reduce((map, row) => {
    const list = map.get(row.order_id) || [];
    list.push(mapWebsiteKitchenItem(row));
    map.set(row.order_id, list);
    return map;
  }, new Map());
}

async function readPartnerOrderItems(client, orderIds = []) {
  if (!orderIds.length) return new Map();

  const { data, error } = await client
    .from("partner_order_items")
    .select(PARTNER_ITEM_COLUMNS)
    .in("partner_order_id", orderIds);
  recordKitchenRequest("read partner items", "partner_order_items");

  if (error) throw error;

  return sortKitchenItemRows(data).reduce((map, row) => {
    const list = map.get(row.partner_order_id) || [];
    list.push(mapPartnerKitchenItem(row));
    map.set(row.partner_order_id, list);
    return map;
  }, new Map());
}

function shouldStampPartnerKitchenDoneAt(row = {}) {
  if (toText(row.kitchen_done_at)) return false;

  const rawData = getObject(row.raw_data);
  const nexposState = normalizeNexposOrderState(
    row.nexpos_status,
    rawData.status,
    rawData.order_status,
    row.order_status
  );

  return nexposState === "done";
}

async function stampPartnerKitchenDoneAt(client, rows = []) {
  const rowsToStamp = getArray(rows).filter(shouldStampPartnerKitchenDoneAt);
  if (!rowsToStamp.length) return rows;

  const stampedAt = new Date().toISOString();
  const stampedIds = [];

  await Promise.all(rowsToStamp.map(async (row) => {
    const id = toText(row.id);
    if (!id) return;

    const { error } = await client
      .from("partner_orders")
      .update({
        kitchen_work_status: "done",
        kitchen_done_at: stampedAt,
        updated_at: stampedAt
      })
      .eq("id", id)
      .is("kitchen_done_at", null);
    recordKitchenRequest("stamp partner done time", "partner_orders", "write");

    if (!error) stampedIds.push(id);
  }));

  if (!stampedIds.length) return rows;

  const stampedIdSet = new Set(stampedIds);
  return getArray(rows).map((row) => {
    if (!stampedIdSet.has(toText(row.id))) return row;

    return {
      ...row,
      kitchen_work_status: "done",
      kitchen_done_at: stampedAt,
      updated_at: stampedAt
    };
  });
}

export async function getWebsiteKitchenOrders(options = {}) {
  const client = await getClient();
  if (!client) return [];

  const dateFrom = toText(options.dateFrom);
  const dateTo = toText(options.dateTo);
  const shouldLimitDone = canUseDoneQueryLimit(options);
  const doneLimit = toPositiveInteger(options.doneLimit);
  let query = client.from("orders").select(WEBSITE_ORDER_COLUMNS).order("created_at", { ascending: false });

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lt("created_at", dateTo);
  query = applyWebsiteBranchFilter(query, options.branchUuid);
  if (shouldLimitDone) {
    query = applyWebsiteDoneFilter(query).limit(doneLimit);
  }

  const { data, error } = await query;
  recordKitchenRequest("read website orders", "orders");
  if (error) throw error;

  const orderRows = getArray(data);
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);
  const itemsByOrderId = await readOrderItems(client, orderIds);

  return orderRows
    .map((row) => mapWebsiteKitchenOrder(row, itemsByOrderId))
    .filter((order) => matchesBranch(order, options));
}

export async function getPartnerKitchenOrders(options = {}) {
  const client = await getClient();
  if (!client) return [];

  const dateFrom = toText(options.dateFrom);
  const dateTo = toText(options.dateTo);
  const shouldLimitDone = canUseDoneQueryLimit(options);
  const doneLimit = toPositiveInteger(options.doneLimit);
  let query = client.from("partner_orders").select(PARTNER_ORDER_COLUMNS).order("order_time", { ascending: false });

  if (dateFrom) query = query.gte("order_time", dateFrom);
  if (dateTo) query = query.lt("order_time", dateTo);
  query = applyPartnerBranchFilter(query, options.branchUuid);
  if (shouldLimitDone) {
    query = applyPartnerDoneFilter(query).limit(doneLimit);
  }

  const { data, error } = await query;
  recordKitchenRequest("read partner orders", "partner_orders");
  if (error) throw error;

  const orderRows = await stampPartnerKitchenDoneAt(client, getArray(data));
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);
  const itemsByOrderId = await readPartnerOrderItems(client, orderIds);

  return orderRows
    .map((row) => mapPartnerKitchenOrder(row, itemsByOrderId))
    .filter((order) => matchesBranch(order, options));
}

export async function getKitchenOrders(options = {}) {
  const sources = getArray(options.sources).length
    ? options.sources
    : [KITCHEN_SOURCE.website, KITCHEN_SOURCE.partner];

  const tasks = [];
  if (sources.includes(KITCHEN_SOURCE.website)) {
    tasks.push(getWebsiteKitchenOrders(options));
  }
  if (sources.includes(KITCHEN_SOURCE.partner)) {
    tasks.push(getPartnerKitchenOrders(options));
  }

  const settled = await Promise.allSettled(tasks);
  const errors = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  const orders = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .sort((first, second) => getOrderTimeValue(second) - getOrderTimeValue(first));

  return {
    orders,
    errors
  };
}

export async function markKitchenOrderDone(order = {}) {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase."
    };
  }

  const id = toText(order.id);
  if (!id) {
    return {
      ok: false,
      message: "Thiếu mã đơn để cập nhật."
    };
  }

  const updatedAt = new Date().toISOString();
  const action = getNextKitchenOrderAction(order);
  if (!action) {
    return {
      ok: false,
      message: "Đơn này không còn thao tác tiếp theo."
    };
  }

  if (order.sourceType === KITCHEN_SOURCE.partner) {
    const { error } = await client
      .from("partner_orders")
      .update({
        kitchen_work_status: "done",
        kitchen_done_at: updatedAt,
        updated_at: updatedAt
      })
      .eq("id", id);
    recordKitchenRequest("mark partner done", "partner_orders", "write");

    if (error) {
      return {
        ok: false,
        message: error.message || "Không cập nhật được đơn đối tác."
      };
    }

    return {
      ok: true,
      message: "Đã xác nhận xong đơn đối tác."
    };
  }

  const { error } = await client
    .from("orders")
    .update({
      status: action.nextStatus,
      kitchen_status: action.nextKitchenStatus,
      kitchen_done_at: ["ready", "done"].includes(action.nextKitchenStatus) ? updatedAt : null,
      updated_at: updatedAt
    })
    .eq("id", id);
  recordKitchenRequest("mark website done", "orders", "write");

  if (error) {
    return {
      ok: false,
      message: error.message || "Không cập nhật được đơn website."
    };
  }

  if (action.settleOrder) {
    await applyOrderLoyaltyAsync(getOrderLoyaltyPayload(order, updatedAt));
  }

  return {
    ok: true,
    message: action.type === "ready_for_pickup"
      ? "Đơn đã chuyển sang chờ khách lấy."
      : action.type === "ready_for_delivery"
        ? "Đơn đã chuyển sang chờ shipper."
        : action.type === "handoff_shipper"
          ? "Đơn đã chuyển sang đang giao."
          : "Đơn đã hoàn thành và điểm khách hàng đã được cập nhật."
  };
}

export async function updateKitchenOrderItemStatus(order = {}, item = {}, nextStatus = "done") {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      message: "Chưa kết nối được Supabase."
    };
  }

  const normalizedStatus = normalizeKitchenStatus(nextStatus) === "done" ? "done" : "pending";
  const orderId = toText(order.id || item.orderId);
  const itemId = toText(item.sourceItemId || item.id);
  const doneAt = normalizedStatus === "done" ? new Date().toISOString() : null;

  if (!orderId || !itemId) {
    return {
      ok: false,
      message: "Thiếu mã món để cập nhật."
    };
  }

  if (order.sourceType === KITCHEN_SOURCE.partner) {
    const { error } = await client
      .from("partner_order_items")
      .update({
        kitchen_item_status: normalizedStatus,
        kitchen_done_at: doneAt
      })
      .eq("id", itemId)
      .eq("partner_order_id", orderId);
    recordKitchenRequest("update partner item", "partner_order_items", "write");

    if (error) {
      return {
        ok: false,
        message: error.message || "Không cập nhật được món đối tác."
      };
    }

    return {
      ok: true,
      message: "Đã cập nhật món đối tác."
    };
  }

  let query = client
    .from("order_items")
    .update({
      kitchen_item_status: normalizedStatus,
      kitchen_done_at: doneAt
    })
    .eq("order_id", orderId);

  const rawItem = getObject(item.raw);
  if (rawItem.id) {
    query = query.eq("id", rawItem.id);
  } else if (rawItem.product_id) {
    query = query.eq("product_id", rawItem.product_id);
  } else {
    query = query.eq("product_name", item.name || "");
  }

  const { error } = await query;
  recordKitchenRequest("update website item", "order_items", "write");

  if (error) {
    return {
      ok: false,
      message: error.message || "Không cập nhật được món website."
    };
  }

  return {
    ok: true,
    message: "Đã cập nhật món website."
  };
}

export async function subscribeKitchenOrderChanges(onChange) {
  const client = await getClient();
  if (!client || typeof onChange !== "function") return () => {};

  const channel = client
    .channel(`kitchen-order-feed-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => onChange({ table: "orders", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "partner_orders" },
      (payload) => onChange({ table: "partner_orders", payload })
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export { KITCHEN_SOURCE, buildWebsiteOptionLabels, getDisplayStatus, normalizeKitchenStatus };
