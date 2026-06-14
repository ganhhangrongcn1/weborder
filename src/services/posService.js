import { orderStorage } from "./orderService.js";
import { getCustomerKey } from "./storageService.js";
import { applyOrderLoyaltyAsync } from "./loyaltyService.js";
import { getRuntimeSupabaseClient } from "./repositories/repositoryRuntime.js";

const ALL_CATEGORY = "Tất cả";
const WALK_IN_PHONE = "";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pad(value = 0, size = 2) {
  return String(value).padStart(size, "0");
}

function normalizeSearchText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getProductPrice(product = {}) {
  return toNumber(product.price ?? product.unitPrice ?? product.unit_price, 0);
}

function normalizeOptionGroups(product = {}) {
  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  return groups
    .map((group, groupIndex) => ({
      id: toText(group.id || `group-${groupIndex + 1}`),
      name: toText(group.name || group.title || `Tùy chọn ${groupIndex + 1}`),
      required: Boolean(group.required),
      maxSelect: Math.max(1, Math.floor(toNumber(group.maxSelect || group.max_select || 1))),
      options: (Array.isArray(group.options) ? group.options : [])
        .filter((option) => option?.active !== false)
        .map((option, optionIndex) => ({
          id: toText(option.id || `option-${optionIndex + 1}`),
          name: toText(option.name || option.label || `Tùy chọn ${optionIndex + 1}`),
          price: toNumber(option.price || option.extraPrice || option.extra_price, 0)
        }))
        .filter((option) => option.name)
    }))
    .filter((group) => group.name && group.options.length);
}

function normalizeProduct(product = {}, index = 0) {
  const id = toText(product.id || product.productId || product.product_id || `pos-product-${index + 1}`);
  const name = toText(product.name || product.productName || product.product_name || "Món chưa đặt tên");
  const category = toText(product.category || product.categoryId || product.category_id || product.badge || "Khác");

  return {
    ...product,
    id,
    name,
    category,
    price: getProductPrice(product),
    image: toText(product.image || product.thumbnail || product.imageUrl || product.image_url),
    short: toText(product.short || product.description || product.subtitle),
    badge: toText(product.badge),
    optionGroups: normalizeOptionGroups(product),
    visible: product.visible !== false,
    active: product.active !== false
  };
}

export function buildPosCatalog({ products = [], categories = [] } = {}) {
  const normalizedProducts = (Array.isArray(products) ? products : [])
    .map(normalizeProduct)
    .filter((product) => product.active && product.visible);

  const categorySet = new Set(
    (Array.isArray(categories) ? categories : [])
      .map(toText)
      .filter(Boolean)
      .filter((category) => category !== ALL_CATEGORY)
  );

  normalizedProducts.forEach((product) => {
    if (product.category) categorySet.add(product.category);
  });

  return {
    products: normalizedProducts,
    categories: [...Array.from(categorySet), ALL_CATEGORY]
  };
}

export function filterPosProducts(products = [], { category = ALL_CATEGORY, search = "" } = {}) {
  const activeCategory = toText(category) || ALL_CATEGORY;
  const searchKey = normalizeSearchText(search);

  return (Array.isArray(products) ? products : []).filter((product) => {
    const matchesCategory =
      activeCategory === ALL_CATEGORY ||
      product.category === activeCategory;
    if (!matchesCategory) return false;
    if (!searchKey) return true;

    return normalizeSearchText([
      product.name,
      product.short,
      product.description,
      product.category
    ].join(" ")).includes(searchKey);
  });
}

function buildOptionSummary(spice = "", toppings = [], selectedOptions = []) {
  return [
    spice ? `Độ cay: ${spice}` : "",
    ...(Array.isArray(toppings) ? toppings : []).map((topping) => `Topping: ${topping.name}${Number(topping.quantity || 1) > 1 ? ` x${topping.quantity}` : ""}`),
    ...(Array.isArray(selectedOptions) ? selectedOptions : []).map((option) => `${option.groupName}: ${option.name}`)
  ].filter(Boolean);
}

export function createPosCartItem(product = {}, config = {}) {
  const quantity = Math.max(1, Math.floor(toNumber(config.quantity, 1)));
  const unitPrice = config.unitPrice != null ? toNumber(config.unitPrice, 0) : getProductPrice(product);
  const toppings = Array.isArray(config.toppings) ? config.toppings : [];
  const selectedOptions = Array.isArray(config.selectedOptions) ? config.selectedOptions : [];
  const toppingTotal = toppings.reduce((sum, topping) => sum + toNumber(topping.price, 0) * Math.max(1, Math.floor(toNumber(topping.quantity, 1))), 0);
  const optionTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const unitTotal = unitPrice + toppingTotal + optionTotal;
  const note = toText(config.note);
  const spice = toText(config.spice);
  const options = Array.isArray(config.options) && config.options.length
    ? config.options.filter(Boolean).map(toText).filter(Boolean)
    : buildOptionSummary(spice, toppings, selectedOptions);

  return {
    cartId: `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    id: product.id,
    name: product.name,
    image: product.image || "",
    category: product.category || "",
    quantity,
    price: unitPrice,
    unitTotal,
    lineTotal: unitTotal * quantity,
    spice,
    toppings,
    selectedOptions,
    options,
    note,
    metadata: config.metadata && typeof config.metadata === "object" ? config.metadata : {}
  };
}

export function updatePosCartItemQuantity(item = {}, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
  const unitPrice = toNumber(item.unitTotal ?? item.price, 0);

  return {
    ...item,
    quantity: safeQuantity,
    unitTotal: unitPrice,
    lineTotal: unitPrice * safeQuantity
  };
}

export function calculatePosCartTotals(cart = []) {
  const items = Array.isArray(cart) ? cart : [];
  const quantity = items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.lineTotal, 0), 0);

  return {
    quantity,
    subtotal,
    total: subtotal
  };
}

function buildPosOrderCode(now = new Date()) {
  const dateKey = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const timeKey = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
  return `POS-${dateKey}-${timeKey}`;
}

function buildShortDisplayOrderCode(orderCode = "") {
  const raw = toText(orderCode);
  const digitOnly = raw.replace(/\D/g, "");
  const shortCode = digitOnly.length >= 4
    ? digitOnly.slice(-4)
    : (raw.length >= 4 ? raw.slice(-4) : raw);
  return shortCode ? `GHR-${shortCode}` : raw;
}

function buildWalkInCustomerKey(orderCode = "") {
  return `walkin:${toText(orderCode) || Date.now()}`;
}

export function createPosOrderIdentity(now = new Date()) {
  const orderCode = buildPosOrderCode(now);
  return {
    orderCode,
    displayOrderCode: buildShortDisplayOrderCode(orderCode)
  };
}

function buildSelectedOptionGroups(selectedOptions = []) {
  const grouped = new Map();

  (Array.isArray(selectedOptions) ? selectedOptions : []).forEach((option) => {
    const groupId = toText(option?.groupId || option?.group_id || "group");
    const groupName = toText(option?.groupName || option?.group_name || option?.group || "Tùy chọn");
    const groupKey = groupId || groupName;
    const current = grouped.get(groupKey) || {
      id: groupId,
      name: groupName,
      options: []
    };
    current.options.push({
      id: toText(option?.id),
      name: toText(option?.name || option?.label || option?.value),
      price: toNumber(option?.price, 0),
      quantity: Math.max(1, Math.floor(toNumber(option?.quantity, 1)))
    });
    grouped.set(groupKey, current);
  });

  return [...grouped.values()].filter((group) => group.options.length);
}

function getBranchUuid(branch = {}) {
  return toText(branch.branchUuid || branch.branch_uuid || branch.uuid || "");
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePosOrderErrorMessage(error) {
  const rawMessage = toText(error?.message || error?.details || error?.hint || "");
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("customer_phone") &&
    (
      normalized.includes("not-null") ||
      normalized.includes("not null") ||
      normalized.includes("violates not-null constraint") ||
      normalized.includes("violates not null constraint")
    )
  ) {
    return "Supabase ch\u01b0a b\u1eadt kh\u00e1ch l\u1ebb kh\u00f4ng s\u1ed1 \u0111i\u1ec7n tho\u1ea1i. H\u00e3y ch\u1ea1y migration `pos-orders-walkin-phone-nullable.sql` tr\u01b0\u1edbc khi t\u1ea1o \u0111\u01a1n kh\u00e1ch v\u00e3ng lai.";
  }

  return rawMessage || "Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c \u0111\u01a1n POS.";
}

function normalizeBranchForOrder(branch = {}) {
  const branchId = toText(branch.id || branch.legacy_id || branch.legacyId || branch.branch_code || branch.branchCode);
  const branchUuid = getBranchUuid(branch);
  const branchName = toText(branch.name);
  const branchAddress = toText(branch.address);

  return {
    branchId,
    branchUuid,
    branchName,
    branchAddress,
    pickupBranchId: branchId,
    pickupBranchUuid: branchUuid,
    pickupBranchName: branchName,
    pickupBranchAddress: branchAddress
  };
}

function normalizeCartForOrder(cart = []) {
  return (Array.isArray(cart) ? cart : []).map((item, index) => {
    const quantity = Math.max(1, Math.floor(toNumber(item.quantity, 1)));
    const unitTotal = toNumber(item.unitTotal ?? item.price, 0);
    const optionGroups = buildSelectedOptionGroups(item.selectedOptions);
    const toppings = Array.isArray(item.toppings) ? item.toppings : [];
    const selectedOptions = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
    const options = Array.isArray(item.options) ? item.options.filter(Boolean) : [];

    return {
      ...item,
      id: toText(item.productId || item.id || `pos-item-${index + 1}`),
      productId: toText(item.productId || item.id || `pos-item-${index + 1}`),
      name: toText(item.name || "Món chưa đặt tên"),
      quantity,
      price: unitTotal,
      unitTotal,
      lineTotal: unitTotal * quantity,
      note: toText(item.note),
      toppings,
      selectedOptions,
      options,
      optionGroups,
      kitchenItemStatus: "pending",
      status: "pending",
      metadata: {
        ...(item.metadata && typeof item.metadata === "object" ? item.metadata : {}),
        source: "pos",
        ghrOrderIndex: index,
        note: toText(item.note),
        spice: toText(item.spice),
        toppings,
        selectedOptions,
        options,
        optionGroups
      }
    };
  });
}

function isPosOrder(order = {}) {
  const metadata = getObject(order.metadata);
  const source = toText(order.orderSource || order.source || order.channel || metadata.source || metadata.orderSource).toLowerCase();
  const platform = toText(order.platform || metadata.platform).toLowerCase();
  const partnerSource = toText(order.partnerSource || metadata.partnerSource).toLowerCase();
  return source === "pos" || platform === "pos" || partnerSource === "pos";
}

function getOrderBranchKeys(order = {}) {
  const metadata = getObject(order.metadata);
  return [
    order.branchUuid,
    order.pickupBranchUuid,
    order.deliveryBranchUuid,
    order.branchId,
    order.pickupBranchId,
    order.deliveryBranchId,
    metadata.branchUuid,
    metadata.pickupBranchUuid,
    metadata.deliveryBranchUuid,
    metadata.branchId,
    metadata.pickupBranchId,
    metadata.deliveryBranchId
  ].map(toText).filter(Boolean);
}

function matchesPosBranch(order = {}, branchValue = "") {
  const safeBranchValue = toText(branchValue);
  if (!safeBranchValue) return true;
  return getOrderBranchKeys(order).includes(safeBranchValue);
}

function getRemoteOrderBranchKeys(row = {}) {
  const metadata = getObject(row.metadata);
  return [
    row.branch_uuid,
    row.pickup_branch_uuid,
    row.delivery_branch_uuid,
    row.branch_id,
    row.pickup_branch_id,
    row.delivery_branch_id,
    metadata.branchUuid,
    metadata.pickupBranchUuid,
    metadata.deliveryBranchUuid,
    metadata.branchId,
    metadata.pickupBranchId,
    metadata.deliveryBranchId
  ].map(toText).filter(Boolean);
}

function matchesRemoteOrderBranch(row = {}, branchValue = "") {
  const safeBranchValue = toText(branchValue);
  if (!safeBranchValue) return true;
  return getRemoteOrderBranchKeys(row).includes(safeBranchValue);
}

function getRemoteOrderPagerNumber(row = {}) {
  const metadata = getObject(row.metadata);
  return normalizePagerNumber(metadata.pagerNumber || metadata.pager_number);
}

function isRemoteOrderPagerClosed(row = {}) {
  const metadata = getObject(row.metadata);
  const orderStatus = toText(row.status || metadata.status || metadata.orderStatus).toLowerCase();
  const kitchenStatus = toText(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status).toLowerCase();
  const pagerStatus = toText(metadata.pagerStatus || metadata.pager_status).toLowerCase();

  if (["released", "returned", "available"].includes(pagerStatus)) return true;
  if (isOrderClosedStatus(orderStatus)) return true;
  return isOrderClosedStatus(kitchenStatus);
}

async function getBusyPosPagerNumbersFromSupabaseAsync({ branchValue = "" } = {}) {
  try {
    const client = getRuntimeSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("orders")
      .select("id,status,kitchen_status,branch_id,branch_uuid,pickup_branch_id,pickup_branch_uuid,delivery_branch_id,delivery_branch_uuid,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !Array.isArray(data)) return [];

    return Array.from(
      new Set(
        data
          .filter((row) => matchesRemoteOrderBranch(row, branchValue))
          .filter((row) => getRemoteOrderPagerNumber(row))
          .filter((row) => !isRemoteOrderPagerClosed(row))
          .map(getRemoteOrderPagerNumber)
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

function isOrderClosedStatus(status = "") {
  const normalized = toText(status).toLowerCase();
  return ["done", "completed", "complete", "cancelled", "canceled", "cancel"].includes(normalized);
}

function normalizePagerNumber(value = "") {
  const text = toText(value);
  const digits = text.replace(/\D/g, "");
  if (digits && digits.length <= 2) return digits.padStart(2, "0");
  return text;
}

function getOrderPagerNumber(order = {}) {
  const metadata = getObject(order.metadata);
  return normalizePagerNumber(
    order.pagerNumber ||
    order.pager_number ||
    metadata.pagerNumber ||
    metadata.pager_number
  );
}

function isOrderPagerClosed(order = {}) {
  const metadata = getObject(order.metadata);
  const orderStatus = toText(
    order.status ||
    order.orderStatus ||
    metadata.status ||
    metadata.orderStatus
  ).toLowerCase();
  const kitchenStatus = toText(
    order.kitchenStatus ||
    order.kitchen_status ||
    metadata.kitchenStatus ||
    metadata.kitchen_status
  ).toLowerCase();
  const pagerStatus = toText(metadata.pagerStatus || metadata.pager_status).toLowerCase();

  if (["released", "returned", "available"].includes(pagerStatus)) return true;
  if (isOrderClosedStatus(orderStatus)) return true;
  return isOrderClosedStatus(kitchenStatus);
}

export function canCancelPosOrder(order = {}) {
  const status = toText(order.status).toLowerCase();
  if (!status) return false;
  if (isOrderClosedStatus(status)) return false;
  if (["ready_for_pickup", "ready_for_delivery", "delivering"].includes(status)) return false;
  return ["pending_payment", "pending_zalo", "pending", "new", "confirmed"].includes(status);
}

export async function getPosRecentOrdersAsync({ branchValue = "", limit = 30 } = {}) {
  const allByPhone = await orderStorage.getAllByPhoneAsync();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(toNumber(limit, 30))));
  return Object.values(allByPhone || {})
    .flat()
    .filter((order) => isPosOrder(order))
    .filter((order) => matchesPosBranch(order, branchValue))
    .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime())
    .slice(0, safeLimit);
}

export async function getBusyPosPagerNumbersAsync({ branchValue = "" } = {}) {
  const remoteBusyPagers = await getBusyPosPagerNumbersFromSupabaseAsync({ branchValue });
  const allByPhone = await orderStorage.getAllByPhoneAsync();
  const localBusyPagers = Array.from(
    new Set(
      Object.values(allByPhone || {})
        .flat()
        .filter((order) => matchesPosBranch(order, branchValue))
        .filter((order) => getOrderPagerNumber(order))
        .filter((order) => !isOrderPagerClosed(order))
        .map(getOrderPagerNumber)
        .filter(Boolean)
    )
  );

  return Array.from(new Set([...remoteBusyPagers, ...localBusyPagers]));
}

export async function cancelPosOrderAsync(order = {}, { cashierName = "", reason = "" } = {}) {
  const orderId = toText(order.id || order.orderCode);
  if (!orderId) {
    return { ok: false, message: "Thiếu mã đơn để hủy." };
  }
  if (!canCancelPosOrder(order)) {
    return { ok: false, message: "Đơn này không còn ở trạng thái cho phép hủy trên POS." };
  }

  const metadata = getObject(order.metadata);
  const usesLoyaltyDiscount = Number(order.pointsDiscount || metadata.pointsDiscount || 0) > 0;
  const usesLoyaltyVoucher = toText(order.promoSource || metadata.promoSource).toLowerCase() === "loyalty";
  if (usesLoyaltyDiscount || usesLoyaltyVoucher) {
    return {
      ok: false,
      message: "Đơn đã dùng điểm hoặc voucher loyalty, tạm chưa hủy trực tiếp trên POS để tránh lệch quyền lợi khách."
    };
  }

  const cancelledAt = new Date().toISOString();
  const updated = await orderStorage.updateOrderAsync(orderId, (current) => {
    const currentMetadata = getObject(current?.metadata);
    return {
      ...current,
      status: "cancelled",
      orderStatus: "cancelled",
      kitchenStatus: "cancelled",
      pointStatus: current?.pointStatus || "pending",
      metadata: {
        ...currentMetadata,
        cancelledAt,
        cancelledBy: toText(cashierName) || "POS",
        cancelReason: toText(reason) || "Nhân viên hủy tại quầy",
        kitchenStatus: "cancelled",
        pointStatus: current?.pointStatus || currentMetadata.pointStatus || "pending"
      }
    };
  });

  if (!updated) {
    return { ok: false, message: "Không tìm thấy đơn để hủy." };
  }

  return {
    ok: true,
    order: updated,
    message: `Đã hủy đơn ${toText(updated.displayOrderCode || updated.orderCode || updated.id)}.`
  };
}

export async function createPosTakeawayOrder({
  cart = [],
  totals = {},
  pagerNumber = "",
  customerName = "",
  customerPhone = "",
  branch = null,
  orderNote = "",
  shift = null,
  cashierName = "Thu ngân",
  customerLookup = null,
  promoDiscount = 0,
  promoCode = "",
  promoSource = "",
  promoVoucherId = "",
  selectedPromotion = null,
  pointsDiscount = 0,
  pointsDiscountAmount = 0,
  pointRedeemRule = null,
  paymentMethod = "unpaid",
  paymentStatus = "unpaid",
  paymentAmount = 0,
  paymentReference = "",
  paidAt = "",
  paymentMeta = null,
  orderIdentity = null,
  status = "pending_zalo",
  kitchenStatus = "pending"
} = {}) {
  const items = normalizeCartForOrder(cart);
  if (!items.length) {
    return {
      ok: false,
      message: "Chưa có món trong bill."
    };
  }

  const pager = toText(pagerNumber);
  if (!pager) {
    return {
      ok: false,
      message: "Vui lòng nhập số thẻ rung."
    };
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const suppliedOrderCode = toText(orderIdentity?.orderCode);
  const suppliedDisplayCode = toText(orderIdentity?.displayOrderCode);
  const orderCode = suppliedOrderCode || buildPosOrderCode(now);
  const displayOrderCode = suppliedDisplayCode || buildShortDisplayOrderCode(orderCode);
  const subtotal = toNumber(totals.subtotal ?? items.reduce((sum, item) => sum + toNumber(item.lineTotal, 0), 0));
  const discountAmount = Math.max(0, Math.min(toNumber(promoDiscount, 0), subtotal));
  const safePointsDiscountAmount = Math.max(
    0,
    Math.min(toNumber(pointsDiscountAmount, 0), Math.max(0, subtotal - discountAmount))
  );
  const totalAmount = toNumber(totals.total ?? Math.max(0, subtotal - discountAmount - safePointsDiscountAmount));
  const normalizedPaymentMethod = toText(paymentMethod).toLowerCase() || "unpaid";
  const normalizedPaymentStatus = toText(paymentStatus).toLowerCase() || (normalizedPaymentMethod === "unpaid" ? "unpaid" : "paid");
  const normalizedPaidAt = normalizedPaymentStatus === "paid" ? (toText(paidAt) || createdAt) : "";
  const normalizedPaymentReference = toText(paymentReference);
  const normalizedPaymentAmount = Math.max(0, toNumber(paymentAmount || totalAmount));
  const normalizedStatus = toText(status).toLowerCase() || "pending_zalo";
  const normalizedKitchenStatus = toText(kitchenStatus).toLowerCase() || "pending";
  const spendPoints = Math.max(0, Math.floor(toNumber(pointsDiscount, 0)));
  const normalizedPromoCode = toText(promoCode).toUpperCase();
  const branchInfo = normalizeBranchForOrder(branch || {});
  const shiftInfo = shift && typeof shift === "object" ? shift : null;
  const shiftId = toText(shiftInfo?.id || shiftInfo?.shiftId);
  const normalizedCustomerPhone = getCustomerKey(customerPhone);
  const isWalkInCustomer = !normalizedCustomerPhone;
  const phone = normalizedCustomerPhone;
  const customerPhoneKey = normalizedCustomerPhone || buildWalkInCustomerKey(orderCode);
  const displayCustomerName = toText(customerName) || `Khách thẻ ${pager}`;

  const order = {
    id: orderCode,
    orderCode,
    displayOrderCode,
    pagerNumber: pager,
    pager_number: pager,
    phone,
    customerPhone: phone,
    customerPhoneKey,
    rawCustomerPhone: toText(customerPhone),
    customerName: displayCustomerName,
    orderCustomerName: displayCustomerName,
    shiftId,
    items,
    subtotal,
    total: totalAmount,
    totalAmount,
    shippingFee: 0,
    originalShippingFee: 0,
    shippingSupportDiscount: 0,
    promoDiscount: discountAmount,
    promoCode: normalizedPromoCode,
    promoSource: toText(promoSource),
    promoVoucherId: toText(promoVoucherId),
    pointsDiscount: safePointsDiscountAmount,
    pointsDiscountAmount: safePointsDiscountAmount,
    pointsEarned: 0,
    pointStatus: "pending",
    pointsBaseAmount: totalAmount,
    fulfillmentType: "pickup",
    paymentMethod: normalizedPaymentMethod,
    paymentStatus: normalizedPaymentStatus,
    paymentAmount: normalizedPaymentAmount,
    paymentReference: normalizedPaymentReference,
    paidAt: normalizedPaidAt,
    status: normalizedStatus,
    kitchenStatus: normalizedKitchenStatus,
    source: "pickup",
    channel: "pos",
    platform: "POS",
    orderSource: "pos",
    partnerSource: "pos",
    createdAt,
    orderTime: createdAt,
    pickupTimeText: "Lấy tại quầy",
    deliveryAddress: "Khách nhận tại quầy",
    note: toText(orderNote),
    customerNote: toText(orderNote),
    orderNote: toText(orderNote),
    ...branchInfo,
    metadata: {
      source: "pos",
      walkIn: isWalkInCustomer,
      customerPhone: phone,
      customerPhoneKey,
      shiftId,
      shift: shiftInfo ? {
        id: shiftId,
        branchValue: toText(shiftInfo.branchValue),
        branchName: toText(shiftInfo.branchName),
        cashierName: toText(shiftInfo.cashierName),
        openedAt: toText(shiftInfo.openedAt)
      } : null,
      orderSource: "pos",
      channel: "pos",
      fulfillmentType: "pickup",
      orderType: "takeaway",
      displayOrderCode,
      pagerNumber: pager,
      pager_number: pager,
      pagerStatus: "assigned",
      status: normalizedStatus,
      kitchenStatus: normalizedKitchenStatus,
      paymentStatus: normalizedPaymentStatus,
      paymentMethod: normalizedPaymentMethod,
      paymentAmount: normalizedPaymentAmount,
      paymentReference: normalizedPaymentReference,
      paidAt: normalizedPaidAt,
      paymentMeta: paymentMeta && typeof paymentMeta === "object" ? paymentMeta : null,
      promoDiscount: discountAmount,
      promoCode: normalizedPromoCode,
      promoSource: toText(promoSource),
      promoVoucherId: toText(promoVoucherId),
      pointsDiscount: safePointsDiscountAmount,
      pointsDiscountAmount: safePointsDiscountAmount,
      pointsSpent: spendPoints,
      pointRedeemRule,
      selectedPromotion: selectedPromotion ? {
        id: toText(selectedPromotion.id),
        code: toText(selectedPromotion.code).toUpperCase(),
        name: toText(selectedPromotion.name),
        discountType: toText(selectedPromotion.discountType),
        value: toNumber(selectedPromotion.value, 0),
        minOrder: toNumber(selectedPromotion.minOrder, 0),
        maxDiscount: toNumber(selectedPromotion.maxDiscount, 0)
      } : null,
      cashierName: toText(cashierName),
      orderNote: toText(orderNote),
      customerLookup: customerLookup ? {
        phone: toText(customerLookup.phone),
        customerName: toText(customerLookup.customerName),
        totalPoints: Number(customerLookup.loyalty?.totalPoints || 0),
        availableVouchers: (customerLookup.availableVouchers || []).map((voucher) => ({
          id: toText(voucher.id),
          code: toText(voucher.code),
          title: toText(voucher.title),
          expiredAt: toText(voucher.expiredAt)
        }))
      } : null
    }
  };

  try {
    const savedOrder = await orderStorage.addOrderAsync(order);
    let loyaltyWarning = "";
    if (normalizedPaymentStatus === "paid" && spendPoints > 0 && phone !== WALK_IN_PHONE) {
      try {
        await applyOrderLoyaltyAsync({
          phone,
          orderId: orderCode,
          amount: totalAmount,
          createdAt,
          promoSource: toText(promoSource),
          promoVoucherId: toText(promoVoucherId),
          promoCode: normalizedPromoCode,
          pointsDiscount: spendPoints,
          orderStatus: order.status
        });
      } catch (error) {
        loyaltyWarning = ` Đơn đã tạo nhưng chưa trừ được điểm: ${error?.message || "kiểm tra policy Supabase loyalty."}`;
      }
    }
    return {
      ok: true,
      order: savedOrder,
      message: `Đã tạo đơn ${orderCode} cho thẻ ${pager}.${loyaltyWarning}`
    };
  } catch (error) {
    return {
      ok: false,
      message: normalizePosOrderErrorMessage(error)
    };
  }
}

export async function markPosQrOrderPaidAsync(
  order = {},
  {
    cashierName = "",
    paymentReference = "",
    paidAt = new Date().toISOString(),
    paymentAmount = 0
  } = {}
) {
  const orderId = toText(order.id || order.orderCode);
  const normalizedPaidAt = toText(paidAt) || new Date().toISOString();
  if (!orderId) {
    return { ok: false, message: "Không tìm thấy đơn chờ thanh toán để xác nhận." };
  }

  const updatedOrder = await orderStorage.updateOrderAsync(orderId, (current) => {
    const currentMetadata = getObject(current?.metadata);
    const normalizedPaymentReference = toText(paymentReference || current?.paymentReference || currentMetadata.paymentReference);
    const normalizedPaymentAmount = Math.max(
      0,
      toNumber(paymentAmount || current?.paymentAmount || current?.totalAmount || current?.total)
    );

    return {
      ...current,
      status: "pending_zalo",
      orderStatus: "pending_zalo",
      kitchenStatus: "pending",
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: normalizedPaymentAmount,
      paymentReference: normalizedPaymentReference,
      paidAt: normalizedPaidAt,
      metadata: {
        ...currentMetadata,
        status: "pending_zalo",
        kitchenStatus: "pending",
        paymentMethod: "bank_qr",
        paymentStatus: "paid",
        paymentAmount: normalizedPaymentAmount,
        paymentReference: normalizedPaymentReference,
        paidAt: normalizedPaidAt,
        paymentConfirmedBy: toText(cashierName) || "POS",
        paymentConfirmedAt: normalizedPaidAt
      }
    };
  });

  if (!updatedOrder) {
    return { ok: false, message: "Không cập nhật được đơn QR chờ thanh toán." };
  }

  const phone = getCustomerKey(
    updatedOrder.customerPhone ||
    updatedOrder.customerPhoneKey ||
    updatedOrder.phone ||
    updatedOrder.rawCustomerPhone
  );
  const metadata = getObject(updatedOrder.metadata);
  const spendPoints = Math.max(
    0,
    Math.floor(
      toNumber(
        updatedOrder.pointsSpent ??
        metadata.pointsSpent ??
        metadata.pointsDiscount ??
        0
      )
    )
  );

  let loyaltyWarning = "";
  if (spendPoints > 0 && phone && phone !== WALK_IN_PHONE) {
    try {
      await applyOrderLoyaltyAsync({
        phone,
        orderId: updatedOrder.orderCode || updatedOrder.id,
        amount: toNumber(updatedOrder.totalAmount ?? updatedOrder.total, 0),
        createdAt: updatedOrder.createdAt || normalizedPaidAt,
        promoSource: toText(updatedOrder.promoSource || metadata.promoSource),
        promoVoucherId: toText(updatedOrder.promoVoucherId || metadata.promoVoucherId),
        promoCode: toText(updatedOrder.promoCode || metadata.promoCode),
        pointsDiscount: spendPoints,
        orderStatus: updatedOrder.status || "pending_zalo"
      });
    } catch (error) {
      loyaltyWarning = ` Đơn đã gửi bếp nhưng chưa trừ được điểm: ${error?.message || "kiểm tra policy loyalty."}`;
    }
  }

  return {
    ok: true,
    order: updatedOrder,
    message: `Đã nhận tiền và gửi đơn ${toText(updatedOrder.displayOrderCode || updatedOrder.orderCode || updatedOrder.id)} xuống bếp.${loyaltyWarning}`
  };
}

export { ALL_CATEGORY, WALK_IN_PHONE };
