import { supabase } from "../supabase/client";

const DEFAULT_LOYALTY_RULE = {
  currencyPerPoint: 100,
  pointPerUnit: 1,
  redeemPointUnit: 1,
  redeemValue: 1
};

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeCustomerPhone(value = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

const VIETNAM_MOBILE_PHONE_PATTERN = /^0(?:3[2-9]|5[25689]|7[06789]|8[1-9]|9[0-46-9])\d{7}$/;

export function isValidVietnamMobilePhone(value = "") {
  const digits = toText(value).replace(/\D/g, "");
  return VIETNAM_MOBILE_PHONE_PATTERN.test(digits);
}

function buildPhoneVariants(phone = "") {
  const phoneKey = normalizeCustomerPhone(phone);
  const variants = new Set([phoneKey]);
  if (/^0\d{9}$/.test(phoneKey)) {
    variants.add(phoneKey.slice(1));
    variants.add(`84${phoneKey.slice(1)}`);
  }
  return Array.from(variants).filter(Boolean);
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

function isRegisteredProfile(profile = null) {
  return Boolean(
    profile?.registered ||
    profile?.auth_user_id ||
    profile?.authUserId ||
    profile?.email
  );
}

function isExcludedOrderStatus(...values) {
  const statuses = values.map(normalizeSourceKey).filter(Boolean);
  return statuses.some((status) => ["cancel", "cancelled", "canceled", "refunded", "huy", "da_huy", "dahuy"].includes(status));
}

function isCompletedOrderStatus(value = "") {
  return ["done", "completed", "complete", "finish", "finished", "served", "hoan_tat", "hoantat"].includes(normalizeSourceKey(value));
}

function calculateOrderPoints(amount = 0, loyaltyRule = DEFAULT_LOYALTY_RULE) {
  const currencyPerPoint = Math.max(1, toNumber(loyaltyRule.currencyPerPoint, 100));
  const pointPerUnit = Math.max(1, toNumber(loyaltyRule.pointPerUnit, 1));
  return Math.floor((toNumber(amount, 0) / currencyPerPoint) * pointPerUnit);
}

function normalizeVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const title = toText(voucher.title || voucher.name || code || "Voucher khách hàng");
  return {
    ...voucher,
    id: toText(voucher.id || voucher.couponId || voucher.coupon_id || code || title),
    code,
    title,
    expiredAt: toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at)
  };
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

function normalizeLoyaltyData(data = null, phone = "") {
  const metadata = getObject(data?.metadata);
  const vouchers = Array.isArray(data?.vouchers)
    ? data.vouchers
    : Array.isArray(metadata.voucherHistory)
      ? metadata.voucherHistory
      : [];
  const pointHistory = Array.isArray(metadata.pointHistory) ? metadata.pointHistory : [];

  return {
    phone,
    totalPoints: Math.max(0, Math.floor(toNumber(data?.total_points ?? data?.totalPoints, 0))),
    voucherHistory: vouchers,
    pointHistory
  };
}

function normalizeLoyaltyConfig(data = null) {
  const config = getObject(data?.value || data);
  return {
    ...DEFAULT_LOYALTY_RULE,
    ...config,
    currencyPerPoint: Math.max(1, toNumber(config.currencyPerPoint ?? config.currency_per_point, DEFAULT_LOYALTY_RULE.currencyPerPoint)),
    pointPerUnit: Math.max(1, toNumber(config.pointPerUnit ?? config.point_per_unit, DEFAULT_LOYALTY_RULE.pointPerUnit)),
    redeemPointUnit: Math.max(1, toNumber(config.redeemPointUnit ?? config.redeem_point_unit, DEFAULT_LOYALTY_RULE.redeemPointUnit)),
    redeemValue: Math.max(1, toNumber(config.redeemValue ?? config.redeem_value, DEFAULT_LOYALTY_RULE.redeemValue))
  };
}

function getOrderIds(order = {}) {
  return [
    order.id,
    order.order_code,
    order.display_order_code,
    order.partner_order_code
  ].map(toText).filter(Boolean);
}

function buildEarnedLookup(ledgerRows = []) {
  const orderIds = new Set();
  const partnerOrderIds = new Set();
  let claimedPoints = 0;

  (Array.isArray(ledgerRows) ? ledgerRows : []).forEach((entry) => {
    const type = toText(entry.entry_type || entry.type).toUpperCase();
    const points = toNumber(entry.points, 0);
    if (!["ORDER_EARN", "PARTNER_ORDER_EARN"].includes(type) || points <= 0) return;

    claimedPoints += points;
    [entry.order_id, entry.orderId, entry.partner_order_code, entry.partnerOrderCode].map(toText).filter(Boolean).forEach((id) => orderIds.add(id));
    [entry.partner_order_id, entry.partnerOrderId].map(toText).filter(Boolean).forEach((id) => partnerOrderIds.add(id));
  });

  return { orderIds, partnerOrderIds, claimedPoints };
}

function mapOrderSummaryRow(row = {}) {
  return {
    totalOrders: Math.max(0, toNumber(row.total_orders, 0)),
    totalSpent: Math.round(Math.max(0, toNumber(row.total_spent, 0))),
    claimedPoints: Math.round(Math.max(0, toNumber(row.claimed_points, 0))),
    pendingPoints: Math.round(Math.max(0, toNumber(row.pending_points, 0)))
  };
}

function dedupeRowsById(rows = []) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = toText(row?.id || row?.order_code || row?.display_order_code);
    if (key && !map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function pickBestProfile(profiles = [], preferredPhone = "") {
  const rows = Array.isArray(profiles) ? profiles : [];
  if (!rows.length) return null;
  const preferred = normalizeCustomerPhone(preferredPhone);
  return rows.find((profile) => isRegisteredProfile(profile)) ||
    rows.find((profile) => normalizeCustomerPhone(profile?.phone) === preferred) ||
    rows[0] ||
    null;
}

async function readProfile(phoneVariants = [], preferredPhone = "") {
  if (!supabase) return null;
  const phones = Array.from(new Set((Array.isArray(phoneVariants) ? phoneVariants : [phoneVariants]).map(toText).filter(Boolean)));
  if (!phones.length) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,auth_user_id,phone,name,email,registered,metadata")
    .in("phone", phones);

  if (error) return null;
  return pickBestProfile(data, preferredPhone);
}

async function readProfileByPhone(phone = "") {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!/^0\d{9}$/.test(normalizedPhone)) return null;
  return readProfile(buildPhoneVariants(normalizedPhone), normalizedPhone);
}

async function createDirectGuestProfile({
  phone = "",
  name = "",
  source = "pos_mobile",
  sourceRef = ""
} = {}) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!supabase || !/^0\d{9}$/.test(normalizedPhone)) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }

  const existingProfile = await readProfileByPhone(normalizedPhone);
  if (existingProfile?.phone) {
    return {
      ok: true,
      existing: true,
      phone: toText(existingProfile.phone || normalizedPhone),
      registered: Boolean(existingProfile.registered),
      hydratedName: toText(existingProfile.name || name),
      message: "Đã có hồ sơ khách trên Supabase."
    };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      phone: normalizedPhone,
      name: toText(name) || null,
      role: "customer",
      status: "active",
      registered: false,
      metadata: {
        customer_stub: true,
        customer_source_first: toText(source) || "pos_mobile",
        customer_source_latest: toText(source) || "pos_mobile",
        customer_source_ref_latest: toText(sourceRef) || null,
        customer_stub_last_synced_at: nowIso
      },
      updated_at: nowIso
    })
    .select("phone,name,registered")
    .maybeSingle();

  if (error) {
    const profileAfterInsert = await readProfileByPhone(normalizedPhone);
    if (profileAfterInsert?.phone) {
      return {
        ok: true,
        existing: true,
        phone: toText(profileAfterInsert.phone || normalizedPhone),
        registered: Boolean(profileAfterInsert.registered),
        hydratedName: toText(profileAfterInsert.name || name),
        message: "Đã có hồ sơ khách trên Supabase."
      };
    }

    return {
      ok: false,
      phone: normalizedPhone,
      message: error.message || "Không tạo được hồ sơ khách vãng lai."
    };
  }

  return {
    ok: true,
    createdNew: true,
    phone: toText(data?.phone || normalizedPhone),
    registered: Boolean(data?.registered),
    hydratedName: toText(data?.name || name),
    message: "Đã tạo hồ sơ khách vãng lai."
  };
}

async function readLoyalty(phone = "") {
  if (!supabase) return normalizeLoyaltyData(null, phone);

  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("customer_phone,total_points,vouchers,metadata,updated_at")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (error || !data) return normalizeLoyaltyData(null, phone);
  return normalizeLoyaltyData(data, phone);
}

async function readLoyaltyRule() {
  if (!supabase) return { ...DEFAULT_LOYALTY_RULE };

  const { data, error } = await supabase
    .from("app_configs")
    .select("id,value,updated_at")
    .eq("id", "ghr_loyalty")
    .maybeSingle();

  if (error || !data) return { ...DEFAULT_LOYALTY_RULE };
  return normalizeLoyaltyConfig(data);
}

async function readWebOrders(phoneVariants = []) {
  if (!supabase || !phoneVariants.length) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id,order_code,status,total_amount,points_earned,customer_phone,customer_name,created_at")
    .in("customer_phone", phoneVariants)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error || !Array.isArray(data)) return [];
  return data;
}

async function readPartnerOrders(phoneVariants = []) {
  if (!supabase || !phoneVariants.length) return [];

  const columns = "id,order_code,display_order_code,customer_phone,customer_phone_key,total_amount,points_base_amount,point_status,order_status,nexpos_status,customer_name,order_time,created_at";
  const rows = [];

  for (const column of ["customer_phone_key", "customer_phone"]) {
    const { data, error } = await supabase
      .from("partner_orders")
      .select(columns)
      .in(column, phoneVariants)
      .order("order_time", { ascending: false })
      .limit(120);

    if (!error && Array.isArray(data)) rows.push(...data);
  }

  return dedupeRowsById(rows)
    .sort((a, b) => new Date(b.order_time || b.created_at || 0) - new Date(a.order_time || a.created_at || 0))
    .slice(0, 120);
}

async function readLoyaltyLedger(phoneVariants = []) {
  if (!supabase || !phoneVariants.length) return [];

  const { data, error } = await supabase
    .from("loyalty_ledger")
    .select("entry_type,order_id,partner_order_id,partner_order_code,points,amount")
    .in("customer_phone", phoneVariants);

  if (error || !Array.isArray(data)) return [];
  return data;
}

async function readOrderSummaryRpc(phone = "") {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc("get_customer_order_count_summary", {
      p_phone: phone
    });

    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapOrderSummaryRow(row) : null;
  } catch {
    return null;
  }
}

function buildStats({ webOrders = [], partnerOrders = [], ledgerRows = [], loyaltyRule = DEFAULT_LOYALTY_RULE } = {}) {
  const earnedLookup = buildEarnedLookup(ledgerRows);
  const currentTime = Date.now();
  const summary = {
    totalOrders: 0,
    totalSpent: 0,
    claimedPoints: earnedLookup.claimedPoints,
    pendingPoints: 0
  };

  webOrders.forEach((order) => {
    if (isExcludedOrderStatus(order.status)) return;

    const total = toNumber(order.total_amount, 0);
    summary.totalOrders += 1;
    summary.totalSpent += total;

    const alreadyEarned = getOrderIds(order).some((id) => earnedLookup.orderIds.has(id));
    const points = toNumber(order.points_earned, 0) || calculateOrderPoints(total, loyaltyRule);
    if (!alreadyEarned && isCompletedOrderStatus(order.status) && points > 0) {
      summary.pendingPoints += points;
    }
  });

  partnerOrders.forEach((order) => {
    if (isExcludedOrderStatus(order.order_status, order.nexpos_status)) return;

    const total = toNumber(order.total_amount, 0);
    const pointBase = toNumber(order.points_base_amount, 0) || total;
    const points = calculateOrderPoints(pointBase, loyaltyRule);
    const pointStatus = normalizeSourceKey(order.point_status || "pending");
    const orderTime = new Date(order.order_time || order.created_at || 0).getTime();
    const claimExpired = Number.isFinite(orderTime) && orderTime > 0 && currentTime >= orderTime + (7 * 24 * 60 * 60 * 1000);
    const alreadyEarned = earnedLookup.partnerOrderIds.has(toText(order.id)) ||
      getOrderIds(order).some((id) => earnedLookup.orderIds.has(id));

    summary.totalOrders += 1;
    summary.totalSpent += total;

    if (!alreadyEarned && pointStatus === "claimed" && points > 0) {
      summary.claimedPoints += points;
      return;
    }

    if (!alreadyEarned && !claimExpired && !["claimed", "rejected", "expired"].includes(pointStatus) && points > 0) {
      summary.pendingPoints += points;
    }
  });

  return {
    totalOrders: summary.totalOrders,
    totalSpent: Math.round(summary.totalSpent),
    claimedPoints: Math.round(summary.claimedPoints),
    pendingPoints: Math.round(summary.pendingPoints)
  };
}

function getRealCustomerName(profile = null, latestOrderName = "") {
  const metadata = getObject(profile?.metadata);
  return toText(
    profile?.name ||
    metadata.customerName ||
    metadata.customer_name ||
    metadata.registeredCustomerName ||
    latestOrderName
  );
}

function getLatestOrderName(webOrders = [], partnerOrders = []) {
  return [...(Array.isArray(webOrders) ? webOrders : []), ...(Array.isArray(partnerOrders) ? partnerOrders : [])]
    .sort((a, b) => new Date(b.order_time || b.created_at || 0) - new Date(a.order_time || a.created_at || 0))
    .map((order) => toText(order.customer_name || order.customerName))
    .find(Boolean) || "";
}

function buildCustomerStatus({ registeredCustomer = false, stats = {}, customerName = "" } = {}) {
  const totalOrders = Math.max(0, Math.floor(toNumber(stats.totalOrders, 0)));
  const totalSpent = Math.max(0, Math.round(toNumber(stats.totalSpent, 0)));

  if (registeredCustomer) {
    return {
      key: "registered",
      label: "Khách thành viên",
      shortLabel: "Đã nhận diện thành viên",
      title: customerName || "Thành viên",
      detail: `${totalOrders.toLocaleString("vi-VN")} đơn · Tổng mua ${totalSpent.toLocaleString("vi-VN")}đ`
    };
  }

  if (totalOrders > 0 || totalSpent > 0) {
    return {
      key: "returning_guest",
      label: "Khách cũ chưa đăng ký",
      shortLabel: "Khách cũ chưa đăng ký",
      title: customerName || "Khách cũ",
      detail: `${totalOrders.toLocaleString("vi-VN")} đơn · Tổng mua ${totalSpent.toLocaleString("vi-VN")}đ`
    };
  }

  return {
    key: "new_phone",
    label: "SĐT mới",
    shortLabel: "SĐT mới",
    title: "SĐT mới",
    detail: "Chưa có lịch sử mua"
  };
}

function buildCustomerDisplayName(profile = null, stats = {}, latestOrderName = "") {
  const registeredCustomer = isRegisteredProfile(profile);
  const realName = getRealCustomerName(profile, latestOrderName);
  if (realName) return realName;
  if (registeredCustomer) return "Khách thành viên";
  return "";
}

export async function lookupPosCustomerByPhone(rawPhone = "") {
  const phone = normalizeCustomerPhone(rawPhone);
  if (!isValidVietnamMobilePhone(phone)) {
    return {
      ok: false,
      reason: "invalid_phone",
      message: "Nhập đủ số điện thoại để tra khách."
    };
  }

  const phoneVariants = buildPhoneVariants(phone);
  const [profile, loyalty, loyaltyRule, orderSummary, webOrders, partnerOrders, ledgerRows] = await Promise.all([
    readProfile(phoneVariants, phone),
    readLoyalty(phone),
    readLoyaltyRule(),
    readOrderSummaryRpc(phone),
    readWebOrders(phoneVariants),
    readPartnerOrders(phoneVariants),
    readLoyaltyLedger(phoneVariants)
  ]);

  const stats = orderSummary || buildStats({ webOrders, partnerOrders, ledgerRows, loyaltyRule });
  const latestOrderName = getLatestOrderName(webOrders, partnerOrders);
  const registeredCustomer = isRegisteredProfile(profile);
  const customerName = buildCustomerDisplayName(profile, stats, latestOrderName);
  const customerStatus = buildCustomerStatus({ registeredCustomer, stats, customerName });
  const availableVouchers = (loyalty.voucherHistory || [])
    .map(normalizeVoucher)
    .filter((voucher) => isVoucherActive(voucher))
    .slice(0, 8);

  return {
    ok: true,
    phone,
    profile,
    customerName,
    loyalty,
    loyaltyRule,
    availableVouchers,
    stats,
    registeredCustomer,
    customerStatusKey: customerStatus.key,
    customerStatusLabel: customerStatus.label,
    customerStatusShortLabel: customerStatus.shortLabel,
    customerStatusTitle: customerStatus.title,
    customerStatusDetail: customerStatus.detail,
    message: registeredCustomer || stats.totalOrders > 0
      ? "Đã tìm thấy khách hàng."
      : "Khách mới hoặc chưa có hồ sơ."
  };
}

export async function ensurePosGuestProfile(input = {}) {
  const normalizedPhone = normalizeCustomerPhone(input.phone);
  if (!supabase || !/^0\d{9}$/.test(normalizedPhone)) {
    return { ok: true, skipped: true };
  }

  const result = await ensurePosGuestProfileLegacy({
    ...input,
    phone: normalizedPhone
  });

  if (!result?.ok) {
    const directResult = await createDirectGuestProfile({
      ...input,
      phone: normalizedPhone
    });
    if (directResult.ok) return directResult;

    const existingProfile = await readProfileByPhone(normalizedPhone);
    if (existingProfile?.phone) {
      return {
        ok: true,
        existing: true,
        phone: toText(existingProfile.phone || normalizedPhone),
        registered: Boolean(existingProfile.registered),
        hydratedName: toText(existingProfile.name || input.name),
        message: "Đã có hồ sơ khách trên Supabase."
      };
    }

    return {
      ok: false,
      phone: normalizedPhone,
      message: result?.message || directResult.message || "Không tạo được hồ sơ khách vãng lai."
    };
  }

  const confirmedProfile = await readProfileByPhone(result.phone || normalizedPhone);
  if (!confirmedProfile?.phone) {
    const directResult = await createDirectGuestProfile({
      ...input,
      phone: normalizedPhone
    });
    if (directResult.ok) return directResult;

    return {
      ok: false,
      phone: normalizedPhone,
      message: directResult.message || "Đã gọi tạo hồ sơ khách nhưng chưa thấy trong bảng profiles."
    };
  }

  return {
    ...result,
    ok: true,
    phone: toText(confirmedProfile.phone || result.phone || normalizedPhone),
    registered: Boolean(result.registered || confirmedProfile.registered),
    hydratedName: toText(result.hydratedName || confirmedProfile.name || input.name),
    message: result.message || "Đã đồng bộ hồ sơ khách vãng lai."
  };
}

async function ensurePosGuestProfileLegacy({
  phone = "",
  name = "",
  source = "pos_mobile",
  sourceRef = ""
} = {}) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!supabase || !/^0\d{9}$/.test(normalizedPhone)) {
    return { ok: true, skipped: true };
  }

  let data = null;
  let error = null;

  try {
    const result = await supabase.rpc("upsert_customer_stub_profile", {
      p_phone: normalizedPhone,
      p_name: toText(name) || null,
      p_source: toText(source) || "pos_mobile",
      p_source_ref: toText(sourceRef) || null
    });
    data = result.data;
    error = result.error;
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    return {
      ok: false,
      message: error.message || "Không tạo được hồ sơ khách vãng lai."
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok ?? true),
    createdNew: Boolean(row?.created_new),
    phone: toText(row?.phone || normalizedPhone),
    registered: Boolean(row?.registered),
    hydratedName: toText(row?.hydrated_name || name),
    message: toText(row?.message) || "Đã đồng bộ hồ sơ khách vãng lai."
  };
}
