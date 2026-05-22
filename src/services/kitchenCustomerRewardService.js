import {
  getSupabaseKitchenAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseKitchenAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { getCustomerTier } from "./crmService.js";
import { getCustomerKey } from "./storageService.js";
import { recordKitchenRequest } from "./kitchenRequestAuditService.js";

const MONTHLY_GIFT_CODE = "MONTHLY_3_ORDERS";
const MONTHLY_GIFT_NAME = "Quà khách quen tháng";
const MONTHLY_GIFT_THRESHOLD = 3;
const CANCELLED_STATUS_KEYS = new Set(["cancelled", "canceled", "cancel", "refunded"]);
const MONTHLY_GIFT_STATS_CACHE_TTL_MS = 15 * 60 * 1000;
const monthlyGiftStatsCache = new Map();

function toText(value = "") {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStatus(value = "") {
  return toText(value).toLowerCase();
}

function normalizeTextKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isCancelledOrder(...statuses) {
  return statuses.some((status) => CANCELLED_STATUS_KEYS.has(normalizeStatus(status)));
}

function getMonthKey(value = "") {
  const raw = toText(value);
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);

  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return getMonthKey(new Date().toISOString());

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthRange(monthKey = "") {
  const safeMonthKey = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : getMonthKey();
  const start = new Date(`${safeMonthKey}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  return {
    monthKey: safeMonthKey,
    dateFrom: start.toISOString(),
    dateTo: end.toISOString()
  };
}

function getOrderIdentitySignature(order = {}) {
  const raw = getObject(order.raw);
  return toText(
    order.stableKey ||
      order.id ||
      order.orderCode ||
      order.displayOrderCode ||
      raw.id ||
      raw.order_code ||
      raw.display_order_code
  );
}

function buildGiftStatsCacheKey(monthKey = "", customerKey = "") {
  const month = toText(monthKey);
  const key = toText(customerKey);
  return month && key ? `${month}|customer:${key}` : "";
}

function getFreshGiftStatsCache(cacheKey = "", visibleOrderSignatures = []) {
  const entry = monthlyGiftStatsCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > MONTHLY_GIFT_STATS_CACHE_TTL_MS) {
    monthlyGiftStatsCache.delete(cacheKey);
    return null;
  }

  const cachedSignatures = entry.orderSignatures instanceof Set ? entry.orderSignatures : new Set();
  const hasUnknownVisibleOrder = (Array.isArray(visibleOrderSignatures) ? visibleOrderSignatures : [])
    .some((signature) => signature && !cachedSignatures.has(signature));
  if (hasUnknownVisibleOrder) {
    monthlyGiftStatsCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setGiftStatsCache(cacheKey = "", value = {}, orderSignatures = []) {
  if (!cacheKey) return;
  monthlyGiftStatsCache.set(cacheKey, {
    cachedAt: Date.now(),
    orderSignatures: new Set((Array.isArray(orderSignatures) ? orderSignatures : []).filter(Boolean)),
    value
  });
}

function clearGiftStatsCacheForCustomer(monthKey = "", customerKey = "") {
  const key = toText(customerKey);
  if (!key) return;
  monthlyGiftStatsCache.delete(buildGiftStatsCacheKey(monthKey, key));
}

async function getReadClient() {
  return getSupabaseKitchenAuthClient() || getSupabaseRuntimeClient() || (await initSupabaseKitchenAuthClient()) || (await initSupabaseRuntimeClient());
}

async function getWriteClient() {
  return getSupabaseKitchenAuthClient() || (await initSupabaseKitchenAuthClient()) || getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
}

export function resolveKitchenCustomerIdentity(order = {}) {
  const raw = getObject(order.raw);
  const metadata = getObject(raw.metadata || raw.raw_data);
  const rawData = getObject(raw.raw_data);
  const phone = getCustomerKey(
    order.customerPhone ||
      order.customerPhoneKey ||
      raw.customer_phone_key ||
      raw.customer_phone ||
      rawData.customer_phone_key ||
      rawData.customer_phone ||
      metadata.customerPhone ||
      metadata.phone
  );

  if (phone) {
    return {
      key: phone,
      type: "phone",
      phone,
      name: toText(order.customerName || raw.customer_name || metadata.customerName)
    };
  }

  const externalId = toText(
    raw.customer_id ||
      raw.customerId ||
      rawData.customer_id ||
      rawData.customerId ||
      metadata.customerId ||
      metadata.customer_id
  );

  if (externalId) {
    return {
      key: `external-${normalizeTextKey(externalId)}`,
      type: "external_id",
      phone: "",
      name: toText(order.customerName || raw.customer_name || metadata.customerName)
    };
  }

  const name = toText(order.customerName || raw.customer_name || metadata.customerName);
  const nameKey = normalizeTextKey(name);

  if (nameKey && !["khach", "khach-le", "guest"].includes(nameKey)) {
    return {
      key: `name-${nameKey}`,
      type: "name",
      phone: "",
      name
    };
  }

  return {
    key: "",
    type: "",
    phone: "",
    name
  };
}

function countMonthlyOrders(rows = [], keySet = new Set()) {
  const counts = new Map();

  rows.forEach((order) => {
    const identity = resolveKitchenCustomerIdentity(order);
    if (!identity.key || !keySet.has(identity.key)) return;
    counts.set(identity.key, (counts.get(identity.key) || 0) + 1);
  });

  return counts;
}

function mergeCountStats(base = new Map(), rows = []) {
  rows.forEach((row) => {
    const identity = resolveKitchenCustomerIdentity(row);
    if (!identity.key) return;

    const current = base.get(identity.key) || { totalOrders: 0, totalSpent: 0 };
    current.totalOrders += 1;
    current.totalSpent += Math.max(0, toNumber(row.totalAmount, 0));
    base.set(identity.key, current);
  });

  return base;
}

function groupVisibleOrderSignaturesByCustomer(orders = []) {
  const map = new Map();

  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const identity = resolveKitchenCustomerIdentity(order);
    if (!identity.key) return;
    const signature = getOrderIdentitySignature(order);
    if (!signature) return;
    const signatures = map.get(identity.key) || [];
    signatures.push(signature);
    map.set(identity.key, signatures);
  });

  return map;
}

function buildStatsForCustomer(customerKey = "", stats = {}) {
  return {
    monthlyOrderCount: stats.monthlyCounts?.get(customerKey) || 0,
    claim: stats.giftClaims?.get(customerKey) || null,
    profile: stats.profiles?.get(customerKey) || null,
    allTimeStats: stats.allTimeStatsMap?.get(customerKey) || null
  };
}

function profileNeedsAllTimeFallback(profile = null) {
  if (!profile) return true;
  return toNumber(profile.total_orders, 0) <= 0;
}

async function readMonthlyWebsiteOrders(client, range) {
  const { data, error } = await client
    .from("orders")
    .select("id,order_code,customer_name,customer_phone,status,created_at,metadata")
    .gte("created_at", range.dateFrom)
    .lt("created_at", range.dateTo);
  recordKitchenRequest("gift monthly website orders", "orders");

  if (error) throw error;

  return (data || [])
    .filter((row) => !isCancelledOrder(row.status))
    .map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      sourceType: "website",
      customerName: row.customer_name,
      customerPhone: row.customer_phone || getObject(row.metadata).phone || "",
      customerPhoneKey: "",
      raw: row
    }));
}

async function readAllTimeWebsiteOrdersByPhones(client, phoneKeys = []) {
  if (!phoneKeys.length) return [];

  const byPhoneTasks = [
    client
      .from("orders")
      .select("id,order_code,customer_name,customer_phone,status,total_amount,metadata")
      .in("customer_phone", phoneKeys)
  ];
  const [byPhoneRaw] = await Promise.all(byPhoneTasks);
  recordKitchenRequest("gift all-time website orders", "orders");
  if (byPhoneRaw.error) throw byPhoneRaw.error;

  const rowMap = new Map();
  [...(byPhoneRaw.data || [])].forEach((row) => {
    const id = toText(row.id);
    if (!id || rowMap.has(id)) return;
    rowMap.set(id, row);
  });

  return [...rowMap.values()]
    .filter((row) => !isCancelledOrder(row.status))
    .map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      sourceType: "website",
      customerName: row.customer_name,
      customerPhone: row.customer_phone || getObject(row.metadata).phone || "",
      customerPhoneKey: "",
      totalAmount: toNumber(row.total_amount, 0),
      raw: row
    }));
}

async function readMonthlyPartnerOrders(client, range) {
  const { data, error } = await client
    .from("partner_orders")
    .select("id,order_code,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,order_time,raw_data")
    .gte("order_time", range.dateFrom)
    .lt("order_time", range.dateTo);
  recordKitchenRequest("gift monthly partner orders", "partner_orders");

  if (error) throw error;

  return (data || [])
    .filter((row) => !isCancelledOrder(row.order_status, row.nexpos_status, getObject(row.raw_data).status))
    .map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      sourceType: "partner",
      customerName: row.customer_name,
      customerPhone: row.customer_phone || row.customer_phone_key,
      customerPhoneKey: row.customer_phone_key,
      raw: row
    }));
}

async function readAllTimePartnerOrdersByPhones(client, phoneKeys = []) {
  if (!phoneKeys.length) return [];

  const byPhoneTasks = [
    client
      .from("partner_orders")
      .select("id,order_code,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,total_amount,raw_data")
      .in("customer_phone_key", phoneKeys),
    client
      .from("partner_orders")
      .select("id,order_code,customer_name,customer_phone,customer_phone_key,order_status,nexpos_status,total_amount,raw_data")
      .in("customer_phone", phoneKeys)
  ];
  const [byPhoneKey, byPhoneRaw] = await Promise.all(byPhoneTasks);
  recordKitchenRequest("gift all-time partner orders by phone key", "partner_orders");
  recordKitchenRequest("gift all-time partner orders by phone", "partner_orders");
  if (byPhoneKey.error) throw byPhoneKey.error;
  if (byPhoneRaw.error) throw byPhoneRaw.error;

  const rowMap = new Map();
  [...(byPhoneKey.data || []), ...(byPhoneRaw.data || [])].forEach((row) => {
    const id = toText(row.id);
    if (!id || rowMap.has(id)) return;
    rowMap.set(id, row);
  });

  return [...rowMap.values()]
    .filter((row) => !isCancelledOrder(row.order_status, row.nexpos_status, getObject(row.raw_data).status))
    .map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      sourceType: "partner",
      customerName: row.customer_name,
      customerPhone: row.customer_phone || row.customer_phone_key,
      customerPhoneKey: row.customer_phone_key,
      totalAmount: toNumber(row.total_amount, 0),
      raw: row
    }));
}

async function readGiftClaims(client, customerKeys = [], monthKey = "") {
  if (!customerKeys.length) return new Map();

  const { data, error } = await client
    .from("monthly_customer_gifts")
    .select("*")
    .eq("reward_month", monthKey)
    .eq("gift_code", MONTHLY_GIFT_CODE)
    .in("customer_key", customerKeys);
  recordKitchenRequest("gift claims", "monthly_customer_gifts");

  if (error) throw error;

  return (data || []).reduce((map, row) => {
    map.set(row.customer_key, row);
    return map;
  }, new Map());
}

async function readCustomerProfiles(client, phoneKeys = []) {
  if (!phoneKeys.length) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select("phone,total_orders,total_spent,member_rank")
    .in("phone", phoneKeys);
  recordKitchenRequest("gift profiles", "profiles");

  if (error) throw error;

  return (data || []).reduce((map, row) => {
    map.set(getCustomerKey(row.phone), row);
    return map;
  }, new Map());
}

function buildMonthlyGiftInfo(order = {}, options = {}) {
  const identity = resolveKitchenCustomerIdentity(order);
  const claim = options.claim || null;
  const profile = options.profile || null;
  const allTimeStats = options.allTimeStats || null;
  const monthlyOrderCount = toNumber(options.monthlyOrderCount, 0);
  const profileTotalSpent = toNumber(profile?.total_spent, 0);
  const profileTotalOrders = toNumber(profile?.total_orders, 0);
  const dynamicTotalSpent = toNumber(allTimeStats?.totalSpent, 0);
  const dynamicTotalOrders = toNumber(allTimeStats?.totalOrders, 0);
  const profileMemberRank = toText(profile?.member_rank);
  const hasProfileLifetimeStats = Boolean(
    profile && (profileTotalOrders > 0 || profileTotalSpent > 0 || (profileMemberRank && profileMemberRank !== "Member"))
  );
  const totalSpent = hasProfileLifetimeStats ? profileTotalSpent : dynamicTotalSpent;
  const totalOrderCount = hasProfileLifetimeStats
    ? Math.max(profileTotalOrders, monthlyOrderCount)
    : Math.max(dynamicTotalOrders, monthlyOrderCount);
  const memberTier = profileMemberRank && profileMemberRank !== "Member"
    ? profileMemberRank
    : getCustomerTier(totalSpent);

  return {
    customerKey: identity.key,
    customerKeyType: identity.type,
    customerName: identity.name || order.customerName || "",
    customerPhone: identity.phone || order.customerPhone || "",
    giftCode: MONTHLY_GIFT_CODE,
    giftName: MONTHLY_GIFT_NAME,
    threshold: MONTHLY_GIFT_THRESHOLD,
    rewardMonth: options.monthKey,
    monthlyOrderCount,
    totalOrderCount,
    totalSpent,
    memberTier,
    eligible: Boolean(identity.key && monthlyOrderCount >= MONTHLY_GIFT_THRESHOLD),
    claimed: Boolean(claim),
    claimedAt: claim?.claimed_at || "",
    claimedOrderCode: claim?.claimed_order_code || "",
    claimedByName: claim?.claimed_by_name || "",
    canClaim: Boolean(identity.key && monthlyOrderCount >= MONTHLY_GIFT_THRESHOLD && !claim)
  };
}

export async function enrichKitchenOrdersWithMonthlyGifts(orders = [], options = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const monthKey = getMonthKey(options.dateKey || options.dateFrom || new Date().toISOString());
  const range = getMonthRange(monthKey);
  const identities = list.map(resolveKitchenCustomerIdentity);
  const customerKeys = [...new Set(identities.map((identity) => identity.key).filter(Boolean))];
  const phoneKeys = [...new Set(identities.filter((identity) => identity.type === "phone").map((identity) => identity.key))];
  const visibleSignaturesByCustomer = groupVisibleOrderSignaturesByCustomer(list);

  if (!customerKeys.length) {
    return {
      orders: list.map((order) => ({
        ...order,
        monthlyGift: buildMonthlyGiftInfo(order, { monthKey })
      })),
      error: ""
    };
  }

  try {
    const cachedStatsByCustomer = new Map();
    const missingCustomerKeys = [];

    if (!options.force) {
      customerKeys.forEach((customerKey) => {
        const cacheKey = buildGiftStatsCacheKey(monthKey, customerKey);
        const cachedStats = getFreshGiftStatsCache(cacheKey, visibleSignaturesByCustomer.get(customerKey) || []);
        if (cachedStats) {
          cachedStatsByCustomer.set(customerKey, cachedStats);
        } else {
          missingCustomerKeys.push(customerKey);
        }
      });

      if (!missingCustomerKeys.length) {
        return {
          orders: list.map((order) => {
            const identity = resolveKitchenCustomerIdentity(order);
            const cachedStats = cachedStatsByCustomer.get(identity.key) || {};
            return {
              ...order,
              monthlyGift: buildMonthlyGiftInfo(order, {
                monthKey,
                monthlyOrderCount: cachedStats.monthlyOrderCount || 0,
                claim: cachedStats.claim || null,
                profile: cachedStats.profile || null,
                allTimeStats: cachedStats.allTimeStats || null
              })
            };
          }),
          error: ""
        };
      }
    } else {
      missingCustomerKeys.push(...customerKeys);
    }

    const client = await getReadClient();
    if (!client) throw new Error("Supabase chưa sẵn sàng.");

    const missingCustomerSet = new Set(missingCustomerKeys);
    const missingPhoneKeys = phoneKeys.filter((phone) => missingCustomerSet.has(phone));
    const [websiteOrders, partnerOrders, giftClaims, profiles] = await Promise.all([
      readMonthlyWebsiteOrders(client, range),
      readMonthlyPartnerOrders(client, range),
      readGiftClaims(client, missingCustomerKeys, monthKey),
      readCustomerProfiles(client, missingPhoneKeys)
    ]);
    const dynamicPhoneKeys = missingPhoneKeys.filter((phone) => profileNeedsAllTimeFallback(profiles.get(phone)));
    const [allTimeWebsiteOrders, allTimePartnerOrders] = await Promise.all([
      readAllTimeWebsiteOrdersByPhones(client, dynamicPhoneKeys),
      readAllTimePartnerOrdersByPhones(client, dynamicPhoneKeys)
    ]);
    const monthlyCounts = countMonthlyOrders([...websiteOrders, ...partnerOrders], missingCustomerSet);
    const allTimeStatsMap = mergeCountStats(
      mergeCountStats(new Map(), allTimeWebsiteOrders),
      allTimePartnerOrders
    );
    const stats = {
      monthlyCounts,
      giftClaims,
      profiles,
      allTimeStatsMap
    };

    missingCustomerKeys.forEach((customerKey) => {
      const cacheKey = buildGiftStatsCacheKey(monthKey, customerKey);
      const customerStats = buildStatsForCustomer(customerKey, stats);
      cachedStatsByCustomer.set(customerKey, customerStats);
      setGiftStatsCache(cacheKey, customerStats, visibleSignaturesByCustomer.get(customerKey) || []);
    });

    return {
      orders: list.map((order) => {
        const identity = resolveKitchenCustomerIdentity(order);
        const customerStats = cachedStatsByCustomer.get(identity.key) || {};
        return {
          ...order,
          monthlyGift: buildMonthlyGiftInfo(order, {
            monthKey,
            monthlyOrderCount: customerStats.monthlyOrderCount || 0,
            claim: customerStats.claim || null,
            profile: customerStats.profile || null,
            allTimeStats: customerStats.allTimeStats || null
          })
        };
      }),
      error: ""
    };
  } catch (error) {
    return {
      orders: list.map((order) => ({
        ...order,
        monthlyGift: buildMonthlyGiftInfo(order, { monthKey })
      })),
      error: error?.message || "Không đọc được chương trình quà khách quen."
    };
  }
}

export async function claimMonthlyCustomerGift(order = {}, options = {}) {
  const identity = resolveKitchenCustomerIdentity(order);
  const currentGift = order.monthlyGift || {};
  const monthKey = currentGift.rewardMonth || getMonthKey(options.dateKey || order.createdAt || new Date().toISOString());

  if (!identity.key) {
    return {
      ok: false,
      message: "Đơn này chưa có đủ thông tin để xác định khách nhận quà."
    };
  }

  if (toNumber(currentGift.monthlyOrderCount, 0) < MONTHLY_GIFT_THRESHOLD) {
    return {
      ok: false,
      message: "Khách chưa đủ 3 đơn trong tháng để nhận quà."
    };
  }

  const client = await getWriteClient();
  if (!client) {
    return {
      ok: false,
      message: "Supabase chưa sẵn sàng để xác nhận quà."
    };
  }

  const row = {
    customer_key: identity.key,
    customer_key_type: identity.type || "phone",
    customer_name: identity.name || order.customerName || "",
    customer_phone: identity.phone || order.customerPhone || "",
    reward_month: monthKey,
    order_count_at_claim: toNumber(currentGift.monthlyOrderCount, 0),
    gift_code: MONTHLY_GIFT_CODE,
    gift_name: MONTHLY_GIFT_NAME,
    claimed_order_source: order.sourceType || order.source || "",
    claimed_order_id: String(order.id || ""),
    claimed_order_code: String(order.displayOrderCode || order.orderCode || order.id || ""),
    claimed_by_profile_id: options.profileId || null,
    claimed_by_name: options.profileName || "",
    metadata: {
      platform: order.platform || "",
      branchName: order.branchName || "",
      totalOrderCount: toNumber(currentGift.totalOrderCount, 0)
    }
  };

  const { data, error } = await client
    .from("monthly_customer_gifts")
    .insert(row)
    .select("*")
    .single();
  recordKitchenRequest("claim monthly gift", "monthly_customer_gifts", "write");

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await client
        .from("monthly_customer_gifts")
        .select("*")
        .eq("customer_key", identity.key)
        .eq("reward_month", monthKey)
        .eq("gift_code", MONTHLY_GIFT_CODE)
        .maybeSingle();
      recordKitchenRequest("read existing gift claim", "monthly_customer_gifts");

      clearGiftStatsCacheForCustomer(monthKey, identity.key);

      return {
        ok: true,
        alreadyClaimed: true,
        gift: existing || null,
        message: "Khách này đã được tặng quà trong tháng."
      };
    }

    return {
      ok: false,
      message: error.message || "Không xác nhận được quà khách quen."
    };
  }

  clearGiftStatsCacheForCustomer(monthKey, identity.key);

  return {
    ok: true,
    gift: data,
    message: "Đã xác nhận tặng quà khách quen."
  };
}

export { MONTHLY_GIFT_CODE, MONTHLY_GIFT_NAME, MONTHLY_GIFT_THRESHOLD, getMonthKey };
