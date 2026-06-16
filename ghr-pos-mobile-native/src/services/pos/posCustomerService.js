import { supabase } from "../supabase/client";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCustomerPhone(value = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

function isRegisteredProfile(profile = null) {
  return Boolean(
    profile?.registered ||
    profile?.auth_user_id ||
    profile?.authUserId ||
    profile?.email
  );
}

function normalizeVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const title = toText(voucher.title || voucher.name || code || "Voucher khách hàng");
  return {
    ...voucher,
    id: toText(voucher.id || code || title),
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

async function readProfile(phone = "") {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,auth_user_id,phone,name,email,registered,metadata")
    .eq("phone", phone)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function readLoyalty(phone = "") {
  if (!supabase) {
    return {
      totalPoints: 0,
      voucherHistory: []
    };
  }

  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("customer_phone,total_points,vouchers,updated_at")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (error || !data) {
    return {
      totalPoints: 0,
      voucherHistory: []
    };
  }

  return {
    phone,
    totalPoints: Math.max(0, Math.floor(toNumber(data.total_points, 0))),
    voucherHistory: Array.isArray(data.vouchers) ? data.vouchers : []
  };
}

async function readOrderStats(phone = "") {
  if (!supabase) {
    return {
      totalOrders: 0,
      totalSpent: 0,
      latestOrderName: ""
    };
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id,customer_name,total_amount,created_at")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error || !Array.isArray(data)) {
    return {
      totalOrders: 0,
      totalSpent: 0,
      latestOrderName: ""
    };
  }

  return {
    totalOrders: data.length,
    totalSpent: data.reduce((sum, order) => sum + toNumber(order.total_amount, 0), 0),
    latestOrderName: toText(data[0]?.customer_name)
  };
}

export async function lookupPosCustomerByPhone(rawPhone = "") {
  const phone = normalizeCustomerPhone(rawPhone);
  if (!/^0\d{9}$/.test(phone)) {
    return {
      ok: false,
      reason: "invalid_phone",
      message: "Nhập đủ số điện thoại để tra khách."
    };
  }

  const [profile, loyalty, stats] = await Promise.all([
    readProfile(phone),
    readLoyalty(phone),
    readOrderStats(phone)
  ]);

  const registeredCustomer = isRegisteredProfile(profile);
  const customerName = toText(profile?.name || stats.latestOrderName) ||
    (registeredCustomer ? "Khách thành viên" : "Khách vãng lai");
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
    availableVouchers,
    stats,
    registeredCustomer,
    message: registeredCustomer || stats.totalOrders > 0
      ? "Đã tìm thấy khách hàng."
      : "Khách mới hoặc chưa có hồ sơ."
  };
}
