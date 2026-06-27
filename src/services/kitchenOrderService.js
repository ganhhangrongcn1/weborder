import {
  getSupabaseKitchenAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseKitchenAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { getCustomerKey } from "./storageService.js";
import { normalizePartnerSource, resolveOrderSourceKey } from "./partnerOrderService.js";
import { completeWebsiteOrderWithLoyaltyAsync } from "./loyaltyService.js";
import { recordKitchenRequest } from "./kitchenRequestAuditService.js";
import { buildPartnerLoyaltyAmountSnapshot } from "./partnerOrderAmountService.js";
import { buildOrderItemStableId } from "./orderItemIdentityService.js";

const KITCHEN_SOURCE = {
  website: "website",
  pos: "pos",
  partner: "partner"
};

const PLATFORM_LABELS = {
  website: "Website",
  weborder: "Website",
  online: "Website",
  pos: "Tại quầy",
  pos_mobile: "Tại quầy",
  posmobile: "Tại quầy",
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
  "pickup_time_text",
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
  "option_groups",
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
  "subtotal",
  "discount_amount",
  "shipping_fee",
  "total_amount",
  "points_base_amount",
  "order_status",
  "kitchen_status",
  "point_status",
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
  "line_index",
  "web_product_id",
  "partner_item_id",
  "web_product_name",
  "partner_item_name",
  "quantity",
  "unit_price",
  "line_total",
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

function hasBranchScope({ branchUuid = "", branchId = "", branchName = "", branchAlias = "" } = {}) {
  return Boolean(toText(branchUuid) || toText(branchId) || toText(branchName) || toText(branchAlias));
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getStableItemSortValue(row = {}, fallbackIndex = 0) {
  const metadata = getObject(row.metadata);
  const index = toNumber(metadata.ghrOrderIndex, Number.NaN);
  if (Number.isFinite(index)) return index;

  const lineIndex = toNumber(row.line_index, Number.NaN);
  if (Number.isFinite(lineIndex)) return lineIndex;

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

function isPosOrderSource(value = "") {
  const key = toText(value).toLowerCase().replace(/[\s-]+/g, "_");
  return ["pos", "pos_mobile", "posmobile", "counter", "tai_quay"].includes(key);
}

function resolveWebsiteKitchenSource(row = {}, metadata = {}) {
  const nestedMetadata = getObject(metadata.metadata);
  const rawSource = toText(
    row.source ||
      metadata.source ||
      metadata.orderSource ||
      metadata.channel ||
      metadata.platform ||
      metadata.sourceType ||
      nestedMetadata.source ||
      nestedMetadata.orderSource ||
      nestedMetadata.channel ||
      nestedMetadata.platform ||
      nestedMetadata.sourceType
  );

  if (isPosOrderSource(rawSource)) return "pos_mobile";

  return resolveOrderSourceKey({
    ...metadata,
    source: rawSource || row.source || metadata.source,
    channel: row.channel || metadata.channel,
    orderSource: metadata.orderSource || rawSource || row.source,
    platform: metadata.platform || rawSource,
    fulfillmentType: row.fulfillment_type || metadata.fulfillmentType
  });
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

function resolvePartnerKitchenStatus(row = {}, nexposState = "") {
  const workStatus = normalizeKitchenStatus(row.kitchen_work_status);
  const legacyKitchenStatus = normalizeKitchenStatus(row.kitchen_status);

  if (["done", "cancelled", "preorder"].includes(workStatus)) {
    return workStatus;
  }

  if (nexposState === "cancelled") {
    return workStatus || "pending";
  }

  if (["cooking", "confirmed"].includes(workStatus)) {
    return workStatus;
  }

  if (workStatus === "ready") {
    return "cooking";
  }

  if (["done", "cancelled", "preorder"].includes(legacyKitchenStatus)) {
    return legacyKitchenStatus;
  }

  if (["cooking", "confirmed", "ready"].includes(legacyKitchenStatus)) {
    return "cooking";
  }

  if (["done", "preorder"].includes(nexposState)) {
    return nexposState;
  }

  if (nexposState === "active") {
    return "cooking";
  }

  return "pending";
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

function shouldHideWebsiteOrderUntilPaid(order = {}) {
  if (order.sourceType !== KITCHEN_SOURCE.website) return false;

  const status = normalizeOrderStatus(order.status);
  const kitchenStatus = normalizeKitchenStatus(order.kitchenStatus);
  const paymentMethod = normalizeOrderStatus(order.paymentMethod);
  const paymentStatus = normalizeOrderStatus(order.paymentStatus);

  if (status === "pending_payment" || kitchenStatus === "waiting_payment") {
    return true;
  }

  if (paymentMethod === "bank_qr" && paymentStatus && paymentStatus !== "paid") {
    return true;
  }

  return false;
}

function isLegacyWebsiteKitchenDone(order = {}) {
  const status = normalizeOrderStatus(order.status);
  const kitchenStatus = normalizeKitchenStatus(order.kitchenStatus);
  return order.sourceType === KITCHEN_SOURCE.website &&
    kitchenStatus === "done" &&
    !["ready_for_pickup", "ready_for_delivery", "delivering", "done", "completed"].includes(status);
}

function hasValidOrderPhoneForLoyalty(order = {}) {
  const metadata = getObject(order.raw?.metadata);
  return Boolean(getCustomerKey(
    order.customerPhone ||
      order.raw?.customer_phone ||
      metadata.customerPhone ||
      metadata.phone
  ));
}

function getWebsiteKitchenActionSuccessMessage(action = null) {
  if (action?.type === "pickup_completed") return "Đơn đã hoàn thành.";
  if (action?.type === "ready_for_pickup") return "Đơn đã chuyển sang chờ khách lấy.";
  if (action?.type === "ready_for_delivery") return "Đơn đã chuyển sang chờ shipper.";
  if (action?.type === "handoff_shipper") return "Đơn đã chuyển sang đang giao.";
  return "Đã cập nhật trạng thái đơn.";
}

async function settleWebsiteOrderWithoutLoyalty(client, id, action, updatedAt) {
  const { error } = await client
    .from("orders")
    .update({
      status: action?.nextStatus,
      kitchen_status: action?.nextKitchenStatus,
      kitchen_done_at: ["ready", "done"].includes(action?.nextKitchenStatus) ? updatedAt : null,
      updated_at: updatedAt
    })
    .eq("id", id);
  recordKitchenRequest("settle website order without loyalty", "orders", "write");

  if (error) {
    return {
      ok: false,
      message: error.message || "Không cập nhật được đơn website."
    };
  }

  return {
    ok: true,
    message: getWebsiteKitchenActionSuccessMessage(action)
  };
}

export function getNextKitchenOrderAction(order = {}) {
  const status = normalizeOrderStatus(order.status);
  const kitchenStatus = normalizeKitchenStatus(order.kitchenStatus);
  const fulfillmentType = normalizeOrderStatus(order.fulfillmentType);
  const nexposState = normalizeNexposOrderState(order.nexposState, order.nexposStatus, order.raw?.nexpos_status, order.raw?.status);
  const isPartnerCancelledByNexpos = order.sourceType === KITCHEN_SOURCE.partner && nexposState === "cancelled";

  if (isPartnerCancelledByNexpos && kitchenStatus !== "cancelled") {
    return {
      type: "partner_cancelled",
      label: "Xác nhận đơn hủy",
      nextStatus: status || "cancelled",
      nextKitchenStatus: "cancelled",
      requiresReady: false
    };
  }

  const isClosed = ["cancelled", "preorder"].includes(kitchenStatus) ||
    (nexposState === "cancelled" && order.sourceType !== KITCHEN_SOURCE.partner) ||
    ["cancelled", "canceled", "cancel"].includes(status) ||
    isOrderSettlementDone(status) ||
    isLegacyWebsiteKitchenDone(order);

  if (isClosed) return null;

  if (order.sourceType === KITCHEN_SOURCE.partner) {
    if (kitchenStatus === "done") return null;
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

  const rawData = getObject(order.rawData || order.raw_data || order.raw);
  const candidates = [
    order.branchUuid,
    order.pickupBranchUuid,
    order.deliveryBranchUuid,
    order.branchId,
    order.pickupBranchId,
    order.deliveryBranchId,
    rawData.branch_uuid,
    rawData.branch_id,
    rawData.branch_code,
    rawData.nexpos_site_id,
    rawData.nexpos_hub_id,
    order.branchName,
    order.pickupBranchName,
    order.deliveryBranchName,
    rawData.branch_name,
    rawData.nexpos_site_name,
    rawData.nexpos_hub_name,
    rawData.store_name,
    rawData.site_name,
    rawData.hub_name
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

function getSelectedWebsiteToppings(row = {}, metadata = {}, nestedMetadata = {}) {
  const candidates = [row.toppings, metadata.toppings, nestedMetadata.toppings];
  return candidates.find((value) => Array.isArray(value) && value.length) || [];
}

function isSelectedOnlyOptionGroup(group = {}) {
  return !(
    Object.prototype.hasOwnProperty.call(group, "required") ||
    Object.prototype.hasOwnProperty.call(group, "maxSelect") ||
    Object.prototype.hasOwnProperty.call(group, "max_select") ||
    Object.prototype.hasOwnProperty.call(group, "sourcePresetId") ||
    Object.prototype.hasOwnProperty.call(group, "source_preset_id")
  );
}

function normalizeSelectedWebsiteOptionGroups(toppings = [], groupSources = []) {
  const groupedToppings = (Array.isArray(toppings) ? toppings : []).reduce((map, topping) => {
    if (!topping || typeof topping !== "object" || Array.isArray(topping)) return map;
    const groupId = toText(topping.groupId || topping.group_id);
    const groupName = toText(topping.groupName || topping.group_name || topping.group);
    const optionName = toText(topping.name || topping.label || topping.value);
    const key = groupId || groupName;
    if (!key || !optionName) return map;

    const current = map.get(key) || {
      id: groupId,
      name: groupName,
      type: toText(topping.type),
      options: []
    };
    current.options.push({
      id: toText(topping.id || topping.optionId || topping.option_id),
      name: optionName,
      price: toNumber(topping.price, 0),
      quantity: Math.max(1, toNumber(topping.quantity, 1))
    });
    map.set(key, current);
    return map;
  }, new Map());

  if (groupedToppings.size) return [...groupedToppings.values()];

  return groupSources.flatMap((source) => (Array.isArray(source) ? source : []))
    .map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return null;
      const selectedOptions = Array.isArray(group.selectedOptions)
        ? group.selectedOptions
        : Array.isArray(group.selected)
          ? group.selected
          : isSelectedOnlyOptionGroup(group) && Array.isArray(group.options)
            ? group.options
            : [];
      if (!selectedOptions.length) return null;
      return {
        id: toText(group.id || group.groupId || group.group_id),
        name: toText(group.name || group.groupName || group.group_name),
        type: toText(group.type),
        options: selectedOptions
          .map((option) => ({
            id: toText(option?.id || option?.optionId || option?.option_id),
            name: toText(option?.name || option?.label || option?.value),
            price: toNumber(option?.price, 0),
            quantity: Math.max(1, toNumber(option?.quantity, 1))
          }))
          .filter((option) => option.name)
      };
    })
    .filter((group) => group?.options?.length);
}

function flattenSelectedOptionGroups(groups = []) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => (
    (Array.isArray(group?.options) ? group.options : []).map((option) => {
      const groupName = toText(group?.name || group?.groupName || group?.group_name);
      const optionName = toText(option?.name || option?.label || option?.value);
      return groupName && optionName ? `${groupName}: ${optionName}` : optionName;
    }).filter(Boolean)
  ));
}

function buildWebsiteOptionLabels(row = {}, metadata = {}) {
  const nestedMetadata = getObject(metadata.metadata);
  const toppings = getSelectedWebsiteToppings(row, metadata, nestedMetadata);
  const selectedOptionGroups = normalizeSelectedWebsiteOptionGroups(toppings, [
    row.option_groups,
    metadata.optionGroups,
    nestedMetadata.optionGroups
  ]);
  const selectedOptions = [
    ...flattenSelectedOptionLabels(toppings),
    ...flattenSelectedOptionGroups(selectedOptionGroups),
    ...flattenSelectedOptionLabels(metadata.selectedOptions),
    ...flattenSelectedOptionLabels(nestedMetadata.selectedOptions)
  ];
  const seen = new Set();
  const options = [];

  selectedOptions.forEach((label) => pushUniqueOption(options, seen, label));

  const selectedGroups = new Set(options.map(getOptionGroupKey).filter(Boolean));
  const spiceLabel = toText(row.spice || metadata.spice || nestedMetadata.spice);
  const spiceGroup = getOptionGroupKey(spiceLabel);
  if (spiceLabel && (!spiceGroup || !selectedGroups.has(spiceGroup))) {
    pushUniqueOption(options, seen, spiceLabel);
  }

  return options;
}

export function mapWebsiteKitchenItem(row = {}) {
  const metadata = getObject(row.metadata);
  const nestedMetadata = getObject(metadata.metadata);
  const quantity = toNumber(row.quantity ?? metadata.quantity, 1) || 1;
  const status = normalizeKitchenStatus(row.kitchen_item_status, metadata.kitchenStatus);
  const options = buildWebsiteOptionLabels(row, metadata);
  const toppings = getSelectedWebsiteToppings(row, metadata, nestedMetadata);
  const optionGroups = normalizeSelectedWebsiteOptionGroups(toppings, [
    row.option_groups,
    metadata.optionGroups,
    nestedMetadata.optionGroups
  ]);

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
    note: toText(row.note || metadata.note || nestedMetadata.note),
    toppings,
    optionGroups,
    options: [...new Set(options)],
    kitchenItemStatus: status,
    status,
    displayStatus: getDisplayStatus(status),
    metadata,
    raw: row
  };
}

function getWebsiteMetadataItems(row = {}) {
  const metadata = getObject(row.metadata);
  const nestedMetadata = getObject(metadata.metadata);
  const items = Array.isArray(metadata.items)
    ? metadata.items
    : Array.isArray(nestedMetadata.items)
      ? nestedMetadata.items
      : [];
  return items.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function buildWebsiteOrderItemRepairRow(orderRow = {}, item = {}, index = 0) {
  const orderId = toText(orderRow.id || orderRow.order_code);
  const quantity = Math.max(1, toNumber(item.quantity, 1));
  const unitPrice = toNumber(item.unitTotal ?? item.unitPrice ?? item.price, 0);
  const lineTotal = toNumber(item.lineTotal, quantity * unitPrice);
  const productId = toText(item.productId || item.product_id || item.id || `item-${index}`);
  const toppings = Array.isArray(item.toppings) ? item.toppings : [];
  const optionGroups = normalizeSelectedWebsiteOptionGroups(toppings, [item.optionGroups]);
  const options = buildWebsiteOptionLabels(
    { toppings, option_groups: optionGroups, spice: item.spice },
    { ...item, optionGroups, options: [] }
  );
  const metadata = {
    ...item,
    productId,
    product_id: productId,
    options,
    toppings,
    optionGroups,
    ghrOrderIndex: Number(item.ghrOrderIndex ?? index)
  };

  return {
    id: buildOrderItemStableId(orderId, metadata, index),
    order_id: orderId,
    product_id: productId,
    product_name: toText(item.name || item.productName || item.product_name),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    spice: toText(item.spice),
    note: toText(item.note),
    toppings,
    option_groups: optionGroups,
    kitchen_item_status: normalizeKitchenStatus(item.kitchenItemStatus || item.kitchen_item_status || item.status),
    metadata
  };
}

function mapWebsiteMetadataItemsToKitchenItems(row = {}) {
  return getWebsiteMetadataItems(row).map((item, index) => mapWebsiteKitchenItem({
    ...buildWebsiteOrderItemRepairRow(row, item, index),
    __metadataFallback: true
  }));
}

export function resolveWebsiteKitchenItems(row = {}, itemsByOrderId = new Map()) {
  const orderId = toText(row.id || row.order_code);
  const storedItems = itemsByOrderId.get(orderId) || [];
  return storedItems.length ? storedItems : mapWebsiteMetadataItemsToKitchenItems(row);
}

function mapPartnerKitchenItem(row = {}) {
  const quantity = toNumber(row.quantity, 1) || 1;
  const options = flattenOptionLabels(row.options);
  const status = normalizeKitchenStatus(row.kitchen_item_status);
  const unitTotal = toNumber(row.unit_price, 0);
  const lineTotal = toNumber(row.line_total, unitTotal * quantity);

  return {
    id: toText(row.id || row.item_key),
    sourceItemId: toText(row.id || ""),
    orderId: toText(row.partner_order_id || ""),
    productId: toText(row.web_product_id || row.partner_item_id || row.item_key),
    name: toText(row.web_product_name || row.partner_item_name) || "Không tên món",
    quantity,
    price: unitTotal,
    unitTotal,
    lineTotal,
    note: toText(row.note),
    toppings: [],
    optionGroups: [],
    options,
    kitchenItemStatus: status,
    status,
    displayStatus: getDisplayStatus(status),
    metadata: {},
    raw: row
  };
}

function getPartnerRawDishEntries(row = {}) {
  const rawData = getObject(row.raw_data);
  return getArray(rawData.dishes)
    .map((dish, index) => ({ dish: getObject(dish), index }))
    .filter(({ dish }) => dish.is_gift !== true);
}

function getPartnerRawDishBaseKey(row = {}) {
  const rawData = getObject(row.raw_data);
  return toText(
    row.order_code ||
      rawData.order_id ||
      row.display_order_code ||
      row.nexpos_order_id ||
      rawData.nexpos_order_id ||
      rawData.id ||
      row.id
  );
}

function buildPartnerRawDishItemKey(row = {}, dish = {}, index = 0) {
  const explicitKey = toText(dish.item_key || dish.key || dish.line_key);
  if (explicitKey) return explicitKey;

  const baseKey = getPartnerRawDishBaseKey(row);
  return baseKey ? `${baseKey}-${index}` : `raw-dish-${index}`;
}

function getPartnerRawDishItemKeyCandidates(row = {}, dish = {}, index = 0) {
  const rawData = getObject(row.raw_data);
  const explicitKeys = [
    dish.item_key,
    dish.key,
    dish.line_key
  ].map(toText).filter(Boolean);
  const bases = [
    getPartnerRawDishBaseKey(row),
    row.order_code,
    rawData.order_id,
    row.display_order_code,
    row.nexpos_order_id,
    rawData.nexpos_order_id,
    rawData.id,
    row.id
  ].map(toText).filter(Boolean);

  return [...new Set([
    ...explicitKeys,
    ...bases.map((base) => `${base}-${index}`)
  ])];
}

function getPartnerKitchenItemFingerprint({
  name = "",
  quantity = 1,
  note = "",
  options = []
} = {}) {
  const optionText = flattenOptionLabels(options).map(normalizeSearchText).sort().join("|");
  return [
    normalizeSearchText(name),
    String(Math.max(1, toNumber(quantity, 1))),
    normalizeSearchText(note),
    optionText
  ].join("::");
}

function getPartnerRawDishFingerprint(dish = {}) {
  return getPartnerKitchenItemFingerprint({
    name: dish.name,
    quantity: dish.quantity,
    note: dish.note || dish.description,
    options: dish.options
  });
}

function getPartnerStoredItemFingerprint(item = {}) {
  return getPartnerKitchenItemFingerprint({
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    options: item.options
  });
}

function getPartnerStoredItemKey(item = {}) {
  return toText(item.raw?.item_key || item.itemKey || item.cartId || item.productId || item.id);
}

function findPartnerStoredItemIndexForRawDish(row = {}, dish = {}, index = 0, candidates = []) {
  const keyCandidates = new Set(getPartnerRawDishItemKeyCandidates(row, dish, index));
  let matchIndex = candidates.findIndex((candidate) => keyCandidates.has(getPartnerStoredItemKey(candidate.item)));
  if (matchIndex >= 0) return matchIndex;

  const fingerprint = getPartnerRawDishFingerprint(dish);
  matchIndex = candidates.findIndex((candidate) => getPartnerStoredItemFingerprint(candidate.item) === fingerprint);
  return matchIndex;
}

function getMissingPartnerRawDishEntries(row = {}, storedItems = []) {
  const availableItems = getArray(storedItems).map((item) => ({ item }));
  return getPartnerRawDishEntries(row).filter(({ dish, index }) => {
    const matchedIndex = findPartnerStoredItemIndexForRawDish(row, dish, index, availableItems);
    if (matchedIndex < 0) return true;
    availableItems.splice(matchedIndex, 1);
    return false;
  });
}

function mapPartnerRawDishToKitchenItem(dish = {}, order = {}, index = 0) {
  const rawData = getObject(order.raw_data);
  const orderId = toText(order.id || order.order_code || rawData.order_id || rawData.id);
  const itemKey = buildPartnerRawDishItemKey(order, dish, index);
  const itemId = toText(dish.item_id || dish.model_id || dish.code || itemKey || index);
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
    kitchenItemStatus: status,
    status,
    displayStatus: getDisplayStatus(status),
    raw: {
      ...dish,
      item_key: itemKey,
      line_index: index,
      __rawPartnerDishFallback: true
    }
  };
}

function mapPartnerRawDishesToKitchenItems(row = {}) {
  return getPartnerRawDishEntries(row)
    .map(({ dish, index }) => mapPartnerRawDishToKitchenItem(dish, row, index));
}

function resolvePartnerKitchenItems(row = {}, itemsByOrderId = new Map()) {
  const id = toText(row.id || row.order_code);
  return itemsByOrderId.get(id) || [];
}

function buildPartnerOrderItemRepairRow(orderRow = {}, dish = {}, index = 0) {
  const rawData = getObject(orderRow.raw_data);
  const quantity = Math.max(1, toNumber(dish.quantity, 1));
  const lineTotal = toNumber(
    dish.discount_price ??
      dish.line_total ??
      dish.total_price ??
      dish.total ??
      dish.price,
    0
  );
  const unitPrice = toNumber(
    dish.unit_price ??
      dish.price ??
      (lineTotal > 0 ? lineTotal / quantity : 0),
    0
  );

  return {
    partner_order_id: toText(orderRow.id),
    item_key: buildPartnerRawDishItemKey(orderRow, dish, index),
    line_index: index,
    order_code: toText(orderRow.order_code || rawData.order_id),
    partner_source: normalizePartnerSource(orderRow.partner_source || rawData.source || ""),
    branch_id: toText(orderRow.branch_id || rawData.site_id),
    nexpos_hub_id: toText(rawData.hub_id || orderRow.nexpos_hub_id),
    nexpos_site_id: toText(rawData.site_id || orderRow.nexpos_site_id || orderRow.branch_id),
    branch_code: toText(orderRow.branch_code || rawData.branch_code),
    branch_uuid: toText(orderRow.branch_uuid || rawData.branch_uuid) || null,
    partner_item_id: toText(dish.item_id || dish.model_id),
    partner_item_sku: toText(dish.code),
    partner_item_name: toText(dish.name) || "Không tên món",
    web_product_id: null,
    web_product_name: "",
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal || unitPrice * quantity,
    options: getArray(dish.options),
    note: toText(dish.note || dish.description),
    item_status: "pending",
    kitchen_item_status: "pending"
  };
}

function buildMinimalPartnerOrderItemRepairRow(row = {}) {
  return {
    partner_order_id: row.partner_order_id,
    order_code: row.order_code,
    partner_source: row.partner_source,
    branch_id: row.branch_id,
    item_key: row.item_key,
    line_index: row.line_index,
    partner_item_id: row.partner_item_id,
    web_product_id: row.web_product_id,
    partner_item_name: row.partner_item_name,
    web_product_name: row.web_product_name,
    quantity: row.quantity,
    unit_price: row.unit_price,
    line_total: row.line_total,
    options: row.options,
    note: row.note,
    kitchen_item_status: row.kitchen_item_status
  };
}

function mapWebsiteKitchenOrder(row = {}, itemsByOrderId = new Map()) {
  const metadata = getObject(row.metadata);
  const nestedMetadata = getObject(metadata.metadata);
  const source = resolveWebsiteKitchenSource(row, metadata);
  const sourceType = isPosOrderSource(source) ? KITCHEN_SOURCE.pos : KITCHEN_SOURCE.website;
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
    stableKey: buildKitchenStableKey(sourceType, id, orderCode),
    orderCode,
    displayOrderCode: toText(
      row.display_order_code ||
      metadata.displayOrderCode ||
      metadata.display_order_code ||
      nestedMetadata.displayOrderCode ||
      nestedMetadata.display_order_code ||
      orderCode
    ),
    sourceType,
    source,
    orderSource: source,
    channel: source,
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
    customerName: toText(row.customer_name || metadata.customerName || nestedMetadata.customerName),
    customerPhone: toText(row.customer_phone || metadata.customerPhone || metadata.phone || nestedMetadata.customerPhone || nestedMetadata.phone),
    pagerNumber: toText(
      row.pager_number ||
      metadata.pagerNumber ||
      metadata.pager_number ||
      nestedMetadata.pagerNumber ||
      nestedMetadata.pager_number
    ),
    pagerStatus: toText(metadata.pagerStatus || metadata.pager_status || nestedMetadata.pagerStatus || nestedMetadata.pager_status),
    status,
    nexposStatus,
    nexposState,
    kitchenStatus,
    displayStatus: getWebsiteBranchDisplayStatus(status, kitchenStatus, toText(row.fulfillment_type || metadata.fulfillmentType)),
    fulfillmentType: toText(row.fulfillment_type || metadata.fulfillmentType),
    paymentMethod: toText(row.payment_method || metadata.paymentMethod),
    paymentStatus: toText(row.payment_status || metadata.paymentStatus || nestedMetadata.paymentStatus),
    paidAt: toText(row.paid_at || metadata.paidAt || nestedMetadata.paidAt),
    pickupTimeText: toText(row.pickup_time_text || metadata.pickupTimeText || metadata.pickup_time_text || nestedMetadata.pickupTimeText || nestedMetadata.pickup_time_text),
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
    items: resolveWebsiteKitchenItems(row, itemsByOrderId),
    raw: row
  };
}

function mapPartnerKitchenOrder(row = {}, itemsByOrderId = new Map()) {
  const rawData = getObject(row.raw_data);
  const source = normalizePartnerSource(row.partner_source || rawData.source || "");
  const id = toText(row.id || row.order_code);
  const orderCode = toText(row.order_code || id);
  const displayOrderCode = toText(row.display_order_code || orderCode);
  const items = resolvePartnerKitchenItems(row, itemsByOrderId);
  const nexposStatus = toText(row.nexpos_status || rawData.status);
  const nexposState = normalizeNexposOrderState(
    nexposStatus,
    rawData.order_status,
    row.order_status
  );
  const kitchenStatus = resolvePartnerKitchenStatus(row, nexposState);
  const loyaltyAmount = buildPartnerLoyaltyAmountSnapshot(row);

  return {
    id,
    stableKey: buildKitchenStableKey(
      KITCHEN_SOURCE.partner,
      source && row.nexpos_order_id ? `${source}:${row.nexpos_order_id}` : "",
      source && rawData.nexpos_order_id ? `${source}:${rawData.nexpos_order_id}` : "",
      rawData.order_id,
      displayOrderCode,
      orderCode,
      id
    ),
    orderCode,
    displayOrderCode,
    sourceType: KITCHEN_SOURCE.partner,
    source,
    partnerSource: source,
    orderSource: source,
    channel: source,
    platform: getPlatformLabel(source),
    nexposOrderId: toText(row.nexpos_order_id || rawData.nexpos_order_id || rawData.id),
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
    customerPhoneKey: toText(row.customer_phone_key),
    driverName: toText(rawData.driver_name),
    driverPhone: toText(rawData.driver_phone),
    deliveryTime: toText(rawData.delivery_time),
    status: toText(row.order_status || row.nexpos_status || "pending"),
    orderStatus: toText(row.order_status || ""),
    nexposStatus,
    nexposState,
    kitchenStatus,
    kitchenWorkStatus: toText(row.kitchen_work_status),
    kitchenDoneAt: toText(row.kitchen_done_at),
    pointStatus: loyaltyAmount.pointStatus,
    displayStatus: getDisplayStatus(kitchenStatus),
    fulfillmentType: "delivery",
    paymentMethod: "foodapp",
    subtotal: toNumber(row.subtotal, 0),
    shippingFee: toNumber(row.shipping_fee, 0),
    discountAmount: toNumber(row.discount_amount, 0),
    pointsBaseAmount: loyaltyAmount.pointsBaseAmount,
    loyaltyEligibleAmount: loyaltyAmount.loyaltyEligibleAmount,
    netReceivedAmount: loyaltyAmount.netReceivedAmount,
    loyaltyHoldReason: loyaltyAmount.loyaltyHoldReason,
    totalAmount: toNumber(row.total_amount, 0),
    total: toNumber(row.total_amount, 0),
    createdAt: toText(row.order_time || row.created_at),
    orderTime: toText(row.order_time || row.created_at),
    updatedAt: toText(row.updated_at),
    items,
    rawData,
    raw: row
  };
}

async function getClient() {
  return getSupabaseKitchenAuthClient() ||
    (await initSupabaseKitchenAuthClient()) ||
    getSupabaseRuntimeClient() ||
    (await initSupabaseRuntimeClient());
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

async function repairMissingWebsiteOrderItems(client, orderRows = [], itemsByOrderId = new Map()) {
  const missingOrders = orderRows.filter((row) => {
    const orderId = toText(row.id || row.order_code);
    return orderId && !(itemsByOrderId.get(orderId) || []).length && getWebsiteMetadataItems(row).length;
  });
  if (!missingOrders.length) return itemsByOrderId;

  const repairRows = missingOrders.flatMap((row) => (
    getWebsiteMetadataItems(row).map((item, index) => buildWebsiteOrderItemRepairRow(row, item, index))
  ));
  const { error } = await client
    .from("order_items")
    .upsert(repairRows, { onConflict: "id", ignoreDuplicates: true });
  recordKitchenRequest("repair website items", "order_items", "write");

  if (error) {
    console.warn("[kitchenOrderService] Cannot repair missing website items; using order metadata fallback.", error);
    return itemsByOrderId;
  }

  const repairedItems = await readOrderItems(
    client,
    missingOrders.map((row) => row.id || row.order_code).filter(Boolean)
  );
  return new Map([...itemsByOrderId, ...repairedItems]);
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

async function repairMissingPartnerOrderItems(client, orderRows = [], itemsByOrderId = new Map()) {
  const repairRows = getArray(orderRows).flatMap((row) => {
    const orderId = toText(row.id || row.order_code);
    const storedItems = itemsByOrderId.get(orderId) || [];

    return getMissingPartnerRawDishEntries(row, storedItems)
      .map(({ dish, index }) => buildPartnerOrderItemRepairRow(row, dish, index))
      .filter((item) => item.partner_order_id && item.item_key && item.partner_item_name);
  });

  if (!repairRows.length) return itemsByOrderId;

  const { error } = await client
    .from("partner_order_items")
    .upsert(repairRows, { onConflict: "partner_order_id,item_key", ignoreDuplicates: true });
  recordKitchenRequest("repair partner items", "partner_order_items", "write");

  if (error) {
    const { error: fallbackError } = await client
      .from("partner_order_items")
      .upsert(repairRows.map(buildMinimalPartnerOrderItemRepairRow), {
        onConflict: "partner_order_id,item_key",
        ignoreDuplicates: true
      });
    recordKitchenRequest("repair partner items minimal", "partner_order_items", "write");

    if (fallbackError) {
      console.warn("[kitchenOrderService] Cannot repair missing partner items; using raw_data fallback.", {
        error,
        fallbackError
      });
      return itemsByOrderId;
    }
  }

  const repairedItems = await readPartnerOrderItems(
    client,
    getArray(orderRows).map((row) => row.id).filter(Boolean)
  );
  return new Map([...itemsByOrderId, ...repairedItems]);
}

function warnPartnerOrdersMissingStoredItems(orderRows = [], itemsByOrderId = new Map()) {
  const missingRows = getArray(orderRows).filter((row) => {
    const orderId = toText(row.id || row.order_code);
    return orderId && getPartnerRawDishEntries(row).length && !(itemsByOrderId.get(orderId) || []).length;
  });
  if (!missingRows.length) return;

  console.warn("[kitchenOrderService] Partner orders still missing partner_order_items after repair; raw_data will not be rendered.", {
    count: missingRows.length,
    orderCodes: missingRows.slice(0, 10).map((row) => toText(row.display_order_code || row.order_code || row.id))
  });
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
  if (options.strictBranchUuidQuery) {
    query = applyWebsiteBranchFilter(query, options.branchUuid);
  }
  if (shouldLimitDone) {
    query = applyWebsiteDoneFilter(query).limit(doneLimit);
  }

  const { data, error } = await query;
  recordKitchenRequest("read website orders", "orders");
  if (error) throw error;

  const orderRows = getArray(data);
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);
  let itemsByOrderId = await readOrderItems(client, orderIds);
  itemsByOrderId = await repairMissingWebsiteOrderItems(client, orderRows, itemsByOrderId);

  return orderRows
    .map((row) => mapWebsiteKitchenOrder(row, itemsByOrderId))
    .filter((order) => matchesBranch(order, options))
    .filter((order) => !shouldHideWebsiteOrderUntilPaid(order));
}

export async function getPartnerKitchenOrders(options = {}) {
  const client = await getClient();
  if (!client) return [];

  const dateFrom = toText(options.dateFrom);
  const dateTo = toText(options.dateTo);
  const shouldLimitDone = canUseDoneQueryLimit(options) && !hasBranchScope(options);
  const doneLimit = toPositiveInteger(options.doneLimit);
  let query = client.from("partner_orders").select(PARTNER_ORDER_COLUMNS).order("order_time", { ascending: false });

  if (dateFrom) query = query.gte("order_time", dateFrom);
  if (dateTo) query = query.lt("order_time", dateTo);
  if (shouldLimitDone) {
    query = applyPartnerDoneFilter(query).limit(doneLimit);
  }

  const { data, error } = await query;
  recordKitchenRequest("read partner orders", "partner_orders");
  if (error) throw error;

  const orderRows = await stampPartnerKitchenDoneAt(client, getArray(data));
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);
  let itemsByOrderId = await readPartnerOrderItems(client, orderIds);
  itemsByOrderId = await repairMissingPartnerOrderItems(client, orderRows, itemsByOrderId);
  warnPartnerOrdersMissingStoredItems(orderRows, itemsByOrderId);

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
    const nextKitchenStatus = action.nextKitchenStatus || "done";
    const { error } = await client
      .from("partner_orders")
      .update({
        kitchen_work_status: nextKitchenStatus,
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
      message: action.type === "partner_cancelled"
        ? "Đã xác nhận đơn hủy từ NexPOS."
        : "Đã xác nhận xong đơn đối tác."
    };
  }

  if (action.settleOrder) {
    if (!hasValidOrderPhoneForLoyalty(order)) {
      return settleWebsiteOrderWithoutLoyalty(client, id, action, updatedAt);
    }

    try {
      const loyaltyResult = await completeWebsiteOrderWithLoyaltyAsync({
        orderId: id,
        client
      });
      return {
        ok: true,
        loyaltyUpdated: true,
        loyaltyResult,
        message: "Đơn đã hoàn thành và điểm khách hàng đã được cập nhật."
      };
    } catch (error) {
      const fallbackResult = await settleWebsiteOrderWithoutLoyalty(client, id, action, updatedAt);
      if (!fallbackResult.ok) {
        return {
          ok: false,
          loyaltyUpdated: false,
          message: error?.message || fallbackResult.message || "Không thể hoàn tất đơn và cộng điểm."
        };
      }

      return {
        ok: true,
        loyaltyUpdated: false,
        warning: `Đơn đã hoàn thành nhưng loyalty chưa cập nhật: ${error?.message || "vui lòng kiểm tra lại RPC loyalty."}`,
        message: fallbackResult.message
      };
    }
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

  return {
    ok: true,
    message: action.type === "ready_for_pickup"
      ? "Đơn đã chuyển sang chờ khách lấy."
      : action.type === "ready_for_delivery"
        ? "Đơn đã chuyển sang chờ shipper."
        : action.type === "handoff_shipper"
          ? "Đơn đã chuyển sang đang giao."
          : "Đã cập nhật trạng thái đơn."
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
  if (rawItem.__metadataFallback) {
    const repairRow = { ...rawItem };
    delete repairRow.__metadataFallback;
    const { error: repairError } = await client
      .from("order_items")
      .upsert(repairRow, { onConflict: "id", ignoreDuplicates: true });
    recordKitchenRequest("repair website item", "order_items", "write");
    if (repairError) {
      return {
        ok: false,
        message: repairError.message || "Không thể khôi phục dữ liệu món website."
      };
    }
  }

  if (rawItem.id) {
    query = query.eq("id", rawItem.id);
  } else if (rawItem.product_id) {
    query = query.eq("product_id", rawItem.product_id);
  } else {
    query = query.eq("product_name", item.name || "");
  }

  const { data: updatedRows, error } = await query.select("id");
  recordKitchenRequest("update website item", "order_items", "write");

  if (error) {
    return {
      ok: false,
      message: error.message || "Không cập nhật được món website."
    };
  }

  if (!updatedRows?.length) {
    return {
      ok: false,
      message: "Không tìm thấy món website để cập nhật."
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      (payload) => onChange({ table: "order_items", payload })
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

export { KITCHEN_SOURCE, buildWebsiteOptionLabels, getDisplayStatus, normalizeKitchenStatus };
