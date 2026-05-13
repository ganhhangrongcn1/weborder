import { getCustomerKey } from "../storageService.js";

function sortOrdersDesc(orders = []) {
  return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getOrderId(order) {
  return String(order?.id || order?.orderCode || "");
}

function uniqueOrders(orders = []) {
  const seen = new Set();
  return sortOrdersDesc(orders).filter((order) => {
    const id = getOrderId(order);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeOrderPhone(order, phoneKey) {
  return {
    ...order,
    phone: phoneKey,
    customerPhoneKey: phoneKey,
    rawCustomerPhone: order?.rawCustomerPhone || order?.customerPhone || order?.phone || ""
  };
}

function mergeAddressLists(current = [], incoming = []) {
  const seen = new Set();
  return [...current, ...incoming].filter((address) => {
    const key = [
      String(address?.address || "").trim().toLowerCase(),
      String(address?.receiverName || "").trim().toLowerCase(),
      getCustomerKey(address?.phone || "")
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePointHistory(current = [], incoming = []) {
  const seen = new Set();
  return [...current, ...incoming].filter((entry) => {
    const key = String(entry?.id || entry?.orderId || `${entry?.type || ""}-${entry?.createdAt || ""}-${entry?.points || 0}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeVoucherHistory(current = [], incoming = []) {
  const seen = new Set();
  return [...current, ...incoming].filter((voucher) => {
    const key = String(voucher?.id || voucher?.code || `${voucher?.title || ""}-${voucher?.createdAt || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeLoyalty(current = {}, incoming = {}, phoneKey = "") {
  const pointHistory = mergePointHistory(current.pointHistory || [], incoming.pointHistory || []);
  const voucherHistory = mergeVoucherHistory(current.voucherHistory || [], incoming.voucherHistory || []);
  const pointsFromHistory = pointHistory.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
  const hasHistory = pointHistory.length > 0;
  return {
    ...current,
    ...incoming,
    phone: phoneKey,
    totalPoints: hasHistory
      ? Math.max(0, pointsFromHistory)
      : Math.max(0, Number(incoming.totalPoints ?? current.totalPoints ?? 0)),
    checkinStreak: Math.max(Number(current.checkinStreak || 0), Number(incoming.checkinStreak || 0)),
    pointHistory,
    voucherHistory,
    checkinHistory: Array.from(new Set([...(current.checkinHistory || []), ...(incoming.checkinHistory || [])])),
    rewardHistory: Array.from(new Set([...(current.rewardHistory || []), ...(incoming.rewardHistory || [])]))
  };
}

function mergeUsers(current = {}, incoming = {}, phoneKey = "") {
  const currentUpdated = new Date(current.updatedAt || current.createdAt || 0).getTime();
  const incomingUpdated = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
  const preferred = incomingUpdated >= currentUpdated ? incoming : current;
  return {
    ...current,
    ...incoming,
    ...preferred,
    phone: phoneKey,
    registered: Boolean(current.registered || incoming.registered || current.passwordDemo || incoming.passwordDemo),
    createdAt: current.createdAt || incoming.createdAt || preferred.createdAt || "",
    updatedAt: preferred.updatedAt || incoming.updatedAt || current.updatedAt || ""
  };
}

export function normalizeOrdersByPhoneMap(ordersByPhone = {}) {
  return Object.entries(ordersByPhone || {}).reduce((acc, [phone, orders]) => {
    const normalizedPhone = getCustomerKey(phone);
    const rawPhone = String(phone || "").trim();
    const phoneKey = normalizedPhone || (rawPhone ? rawPhone : "");
    if (!phoneKey) return acc;
    const normalizedOrders = (orders || []).map((order) => normalizeOrderPhone(order, phoneKey));
    acc[phoneKey] = uniqueOrders([...(acc[phoneKey] || []), ...normalizedOrders]);
    return acc;
  }, {});
}

export function normalizeUsersMap(users = {}) {
  return Object.entries(users || {}).reduce((acc, [phone, user]) => {
    const phoneKey = getCustomerKey(phone || user?.phone);
    if (!phoneKey) return acc;
    acc[phoneKey] = mergeUsers(acc[phoneKey] || {}, user || {}, phoneKey);
    return acc;
  }, {});
}

export function normalizeAddressesByPhoneMap(addressesByPhone = {}) {
  return Object.entries(addressesByPhone || {}).reduce((acc, [phone, addresses]) => {
    const phoneKey = getCustomerKey(phone);
    if (!phoneKey) return acc;
    const normalizedAddresses = (addresses || []).map((address) => ({
      ...address,
      phone: getCustomerKey(address?.phone || phoneKey) || phoneKey
    }));
    acc[phoneKey] = mergeAddressLists(acc[phoneKey] || [], normalizedAddresses);
    return acc;
  }, {});
}

export function normalizeLoyaltyByPhoneMap(loyaltyByPhone = {}) {
  return Object.entries(loyaltyByPhone || {}).reduce((acc, [phone, loyalty]) => {
    const phoneKey = getCustomerKey(phone || loyalty?.phone);
    if (!phoneKey) return acc;
    acc[phoneKey] = mergeLoyalty(acc[phoneKey] || {}, loyalty || {}, phoneKey);
    return acc;
  }, {});
}
