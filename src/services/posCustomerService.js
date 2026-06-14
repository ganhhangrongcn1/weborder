import { defaultLoyaltyData, getLoyaltyRuleConfigAsync, normalizeLoyaltyData } from "./loyaltyService.js";
import { customerRepository } from "./repositories/customerRepository.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { getCustomerKey } from "./storageService.js";
import { orderStorage } from "./orderService.js";
import { readCustomerPartnerOrdersForAdmin } from "./adminOrderFeedService.js";
import { getCustomerOrderSummary } from "./orderSummaryService.js";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSourceKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getWebOrderSourceLabel(order = {}) {
  const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const key = normalizeSourceKey(
    order.sourceLabel ||
      order.orderSource ||
      order.source ||
      order.channel ||
      order.platform ||
      metadata.orderSource ||
      metadata.source ||
      ""
  );
  if (key.includes("pos")) return "POS";
  if (key.includes("website") || key.includes("web")) return "Website";
  return "Website";
}

function getPartnerSourceLabel(order = {}) {
  const rawData = order?.rawData && typeof order.rawData === "object" ? order.rawData : {};
  const key = normalizeSourceKey(
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
  if (key.includes("grab")) return "Grab";
  if (key.includes("shopee")) return "Shopee";
  if (key.includes("be")) return "Be";
  if (key.includes("gofood") || key.includes("gojek")) return "GoFood";
  if (key.includes("loship")) return "Loship";
  return "Food app";
}

function normalizePointStatus(value = "", points = 0) {
  const status = normalizeSourceKey(value);
  const safePoints = toNumber(points, 0);
  if (safePoints <= 0) return "none";
  if (status === "claimed" || status === "done" || status === "completed") return "claimed";
  if (status === "rejected" || status === "expired" || status === "cancelled" || status === "canceled") return "none";
  return "pending";
}

function isVoucherActive(voucher = {}, now = new Date()) {
  if (!voucher || typeof voucher !== "object") return false;
  if (voucher.used || voucher.canceled || voucher.cancelled) return false;

  const expiredAt = toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at);
  if (!expiredAt) return true;

  const expiryTime = new Date(`${expiredAt.slice(0, 10)}T23:59:59`).getTime();
  if (!Number.isFinite(expiryTime)) return true;
  return expiryTime >= now.getTime();
}

function normalizeVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const title = toText(voucher.title || voucher.name || "Voucher khách hàng");
  return {
    ...voucher,
    id: toText(voucher.id || code || title),
    code,
    title,
    expiredAt: toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at)
  };
}

function isRegisteredProfile(profile = null) {
  return Boolean(
    profile?.registered ||
    profile?.authUserId ||
    profile?.auth_user_id ||
    profile?.passwordDemo ||
    profile?.password_demo ||
    profile?.email
  );
}

function buildCustomerDisplayName(profile = null, phone = "", fallbackName = "") {
  const isRegistered = isRegisteredProfile(profile);
  return toText(
    profile?.name ||
    profile?.registeredCustomerName ||
    profile?.orderCustomerName ||
    profile?.customerName ||
    fallbackName
  ) || (phone ? (isRegistered ? "Khách thành viên" : "Khách vãng lai") : "");
}

function normalizePosOrder(order = {}) {
  const points = Math.max(0, Math.floor(toNumber(order.pointsEarned || order.metadata?.pointsEarned, 0)));
  const pointStatus = normalizePointStatus(order.pointStatus || order.metadata?.pointStatus || "pending", points);
  return {
    id: toText(order.id || order.orderCode),
    code: toText(order.displayOrderCode || order.orderCode || order.id),
    sourceType: "web",
    total: toNumber(order.totalAmount ?? order.total, 0),
    createdAt: toText(order.createdAt || order.orderTime),
    pointStatus,
    points,
    customerName: toText(order.customerName || order.orderCustomerName),
    sourceLabel: getWebOrderSourceLabel(order)
  };
}

function normalizePartnerOrder(order = {}) {
  const rawData = order?.raw_data && typeof order.raw_data === "object"
    ? order.raw_data
    : (order?.rawData && typeof order.rawData === "object" ? order.rawData : {});
  const total = toNumber(order.total_amount ?? order.totalAmount ?? order.total ?? rawData.total_amount, 0);
  const points = Math.max(0, Math.floor(toNumber(order.points_base_amount ?? order.pointsBaseAmount ?? total, 0) / 10000));
  const pointStatus = normalizePointStatus(order.point_status || order.pointStatus || "pending", points);
  return {
    id: toText(order.id || order.order_code || order.display_order_code),
    code: toText(order.display_order_code || order.displayOrderCode || order.order_code || order.orderCode || order.id),
    sourceType: "partner",
    total,
    createdAt: toText(order.created_at || order.createdAt || order.order_time || order.orderTime || order.updated_at),
    pointStatus,
    points,
    customerName: toText(order.customer_name || order.customerName),
    sourceLabel: getPartnerSourceLabel(order)
  };
}

function buildLedgerPointLookup(loyalty = {}) {
  const lookup = {
    orderPoints: new Map(),
    partnerOrderPoints: new Map()
  };

  (Array.isArray(loyalty.pointHistory) ? loyalty.pointHistory : []).forEach((entry) => {
    const type = toText(entry.type || entry.entryType).toUpperCase();
    const points = toNumber(entry.points, 0);
    if (points <= 0) return;

    if (type === "ORDER_EARN") {
      [entry.orderId, entry.order_id].map(toText).filter(Boolean).forEach((key) => {
        lookup.orderPoints.set(key, points);
      });
    }

    if (type === "PARTNER_ORDER_EARN") {
      [
        entry.partnerOrderId,
        entry.partner_order_id,
        entry.partnerOrderCode,
        entry.partner_order_code,
        entry.orderId,
        entry.order_id
      ].map(toText).filter(Boolean).forEach((key) => {
        lookup.partnerOrderPoints.set(key, points);
      });
    }
  });

  return lookup;
}

function applyLedgerPointStatus(order = {}, lookup = {}) {
  const keys = [order.id, order.code].map(toText).filter(Boolean);
  const map = order.sourceType === "partner" ? lookup.partnerOrderPoints : lookup.orderPoints;
  const ledgerPoints = keys.map((key) => map?.get(key)).find((value) => Number(value) > 0);
  if (!ledgerPoints) return order;
  return {
    ...order,
    pointStatus: "claimed",
    points: Math.max(toNumber(order.points, 0), toNumber(ledgerPoints, 0))
  };
}

function dedupeOrders(orders = []) {
  const map = new Map();
  orders.forEach((order) => {
    const key = toText(order.id || order.code || `${order.createdAt}-${order.total}`);
    if (!key) return;
    map.set(key, order);
  });
  return Array.from(map.values());
}

function buildStats(orders = []) {
  const validOrders = orders.filter((order) => order.total > 0);
  return {
    totalOrders: validOrders.length,
    totalSpent: validOrders.reduce((sum, order) => sum + toNumber(order.total, 0), 0),
    claimedPoints: validOrders
      .filter((order) => order.pointStatus === "claimed")
      .reduce((sum, order) => sum + toNumber(order.points, 0), 0),
    pendingPoints: validOrders
      .filter((order) => order.pointStatus === "pending")
      .reduce((sum, order) => sum + toNumber(order.points, 0), 0)
  };
}

export async function lookupPosCustomerByPhone(phone = "") {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) {
    return {
      ok: false,
      reason: "invalid_phone",
      message: "Nhập đủ số điện thoại để tra khách."
    };
  }

  const [profile, loyalty, loyaltyRule, posOrders, partnerOrders, orderSummary] = await Promise.all([
    customerRepository.getUserByPhoneAsync(phoneKey),
    loyaltyRepository.getByPhoneAsync(phoneKey, defaultLoyaltyData).then(normalizeLoyaltyData),
    getLoyaltyRuleConfigAsync(),
    orderStorage.getByPhoneAsync(phoneKey, { limit: 60 }),
    readCustomerPartnerOrdersForAdmin(phoneKey, { limit: 60 }).catch(() => []),
    getCustomerOrderSummary(phoneKey).catch(() => null)
  ]);

  const ledgerLookup = buildLedgerPointLookup(loyalty);
  const normalizedPosOrders = (Array.isArray(posOrders) ? posOrders : [])
    .map(normalizePosOrder)
    .map((order) => applyLedgerPointStatus(order, ledgerLookup));
  const normalizedPartnerOrders = (Array.isArray(partnerOrders) ? partnerOrders : [])
    .map(normalizePartnerOrder)
    .map((order) => applyLedgerPointStatus(order, ledgerLookup));
  const allOrders = dedupeOrders([...normalizedPosOrders, ...normalizedPartnerOrders])
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const recentOrders = allOrders
    .slice(0, 6);
  const stats = orderSummary || buildStats(allOrders);
  const latestOrder = recentOrders[0] || null;
  const availableVouchers = (loyalty.voucherHistory || [])
    .map(normalizeVoucher)
    .filter((voucher) => isVoucherActive(voucher))
    .slice(0, 8);
  const registeredCustomer = isRegisteredProfile(profile);
  const customerName = buildCustomerDisplayName(profile, phoneKey, latestOrder?.customerName || "");

  return {
    ok: true,
    phone: phoneKey,
    profile: profile || null,
    customerName,
    loyalty,
    loyaltyRule,
    availableVouchers,
    stats,
    registeredCustomer,
    message: registeredCustomer || stats.totalOrders > 0
      ? "Đã tìm thấy khách hàng."
      : "Khách mới hoặc chưa có hồ sơ."
  };
}
