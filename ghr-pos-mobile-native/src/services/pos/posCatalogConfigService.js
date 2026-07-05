import { supabase } from "../supabase/client";

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

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  const text = toText(value).toLowerCase();
  if (["false", "0", "off", "no"].includes(text)) return false;
  if (["true", "1", "on", "yes"].includes(text)) return true;
  return fallback;
}

function normalizeWeekdays(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function normalizeSalesChannels(value) {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set(["web", "qr", "pos"]);
  const normalized = value
    .map((item) => toText(item).toLowerCase())
    .filter((item) => allowed.has(item));
  return normalized.length ? Array.from(new Set(normalized)) : [];
}

function normalizeCoupon(row = {}) {
  const data = getObject(row.data);
  const salesChannels = normalizeSalesChannels(data.salesChannels || data.sales_channels || row.sales_channels);
  return {
    ...data,
    id: toText(data.id || row.id || row.code),
    code: toText(data.code || row.code).toUpperCase(),
    name: toText(data.name || row.name || row.code || "Voucher"),
    discountType: toText(data.discountType || row.discount_type || "fixed") === "percent" ? "percent" : "fixed",
    value: toNumber(data.value ?? row.value, 0),
    maxDiscount: toNumber(data.maxDiscount ?? row.max_discount, 0),
    minOrder: toNumber(data.minOrder ?? row.min_order, 0),
    startAt: toText(data.startAt || row.start_at),
    endAt: toText(data.endAt || data.expiry || row.end_at),
    expiry: toText(data.endAt || data.expiry || row.end_at),
    customerType: toText(data.customerType || row.customer_type || "all").toLowerCase(),
    usageLimit: toNumber(data.usageLimit ?? row.usage_limit, 0),
    perUserLimit: Math.max(1, toNumber(data.perUserLimit ?? row.per_user_limit, 1)),
    totalUsed: toNumber(data.totalUsed ?? row.total_used, 0),
    voucherType: toText(data.voucherType || row.voucher_type || "checkout").toLowerCase(),
    fulfillmentType: toText(data.fulfillmentType || row.fulfillment_type || "all").toLowerCase(),
    scopeType: toText(data.scopeType || row.scope_type || "all").toLowerCase(),
    scopeValues: toText(data.scopeValues || row.scope_values),
    ...(salesChannels ? { salesChannels } : {}),
    stackable: Boolean(data.stackable ?? row.stackable),
    active: normalizeBoolean(data.active ?? row.active, true)
  };
}

function normalizeSmartPromotion(row = {}) {
  const data = getObject(row.data);
  const condition = getObject(data.condition || row.condition);
  const reward = getObject(data.reward || row.reward);
  const displayPlaces = Array.isArray(data.displayPlaces)
    ? data.displayPlaces
    : Array.isArray(row.display_places)
      ? row.display_places
      : [];
  const salesChannels = normalizeSalesChannels(data.salesChannels || data.sales_channels || row.sales_channels);

  return {
    ...data,
    id: toText(data.id || row.id || row.code || row.name),
    code: toText(data.code || row.code).toUpperCase(),
    name: toText(data.name || row.name || "Khuyến mãi"),
    title: toText(data.title || row.title || data.name || row.name),
    text: toText(data.text || row.text),
    type: toText(data.type || row.type || "gift_threshold").toLowerCase(),
    icon: toText(data.icon || row.icon),
    active: normalizeBoolean(data.active ?? row.active, true),
    displayPlaces,
    condition: {
      minSubtotal: toNumber(condition.minSubtotal ?? condition.min_subtotal, 0),
      customerType: toText(condition.customerType || condition.customer_type || "all").toLowerCase(),
      productIds: toText(condition.productIds || condition.product_ids),
      categoryIds: toText(condition.categoryIds || condition.category_ids),
      applyScope: toText(condition.applyScope || condition.apply_scope || "product").toLowerCase(),
      useTimeWindow: normalizeBoolean(condition.useTimeWindow ?? condition.use_time_window, true),
      startTime: toText(condition.startTime || condition.start_time || "00:00"),
      endTime: toText(condition.endTime || condition.end_time || "23:59"),
      weekdays: normalizeWeekdays(condition.weekdays),
      totalSlots: toNumber(condition.totalSlots ?? condition.total_slots, 0),
      soldCount: toNumber(condition.soldCount ?? condition.sold_count, 0),
      maxPerCustomer: Math.max(1, toNumber(condition.maxPerCustomer ?? condition.max_per_customer, 1)),
      minDiscountToShow: Math.max(0, toNumber(condition.minDiscountToShow ?? condition.min_discount_to_show, 0)),
      minFinalPrice: Math.max(0, toNumber(condition.minFinalPrice ?? condition.min_final_price, 0)),
      noStackWithOtherPromotions: normalizeBoolean(condition.noStackWithOtherPromotions ?? condition.no_stack_with_other_promotions, false)
    },
    reward: {
      type: toText(reward.type || "gift").toLowerCase(),
      productId: toText(reward.productId || reward.product_id),
      value: toNumber(reward.value, 0),
      roundMode: toText(reward.roundMode || reward.round_mode || "none"),
      name: toText(reward.name || reward.title || reward.value)
    },
    startAt: toText(data.startAt || row.start_at),
    endAt: toText(data.endAt || row.end_at),
    ...(salesChannels ? { salesChannels } : {}),
    priority: toNumber(data.priority ?? row.priority, 99)
  };
}

async function readCoupons() {
  if (!supabase) return [];

  const selectCandidates = [
    "id,data,code,name,discount_type,value,max_discount,min_order,start_at,end_at,customer_type,usage_limit,per_user_limit,total_used,voucher_type,fulfillment_type,scope_type,scope_values,sales_channels,stackable,active,updated_at",
    "id,data,code,name,discount_type,value,max_discount,min_order,start_at,end_at,customer_type,usage_limit,per_user_limit,total_used,voucher_type,fulfillment_type,scope_type,scope_values,stackable,active,updated_at",
    "id,data,updated_at",
    "id,data"
  ];

  for (const columns of selectCandidates) {
    const { data, error } = await supabase
      .from("coupons")
      .select(columns)
      .order("updated_at", { ascending: false });

    if (error) continue;
    return (Array.isArray(data) ? data : [])
      .map(normalizeCoupon)
      .filter((coupon) => coupon.id || coupon.code);
  }

  return [];
}

async function readSmartPromotions() {
  if (!supabase) return [];

  const selectCandidates = [
    "id,data,name,title,text,type,icon,condition,reward,display_places,sales_channels,start_at,end_at,priority,active,updated_at",
    "id,data,name,title,text,type,icon,condition,reward,display_places,start_at,end_at,priority,active,updated_at",
    "id,data,name,type,condition,reward,display_places,start_at,end_at,priority,active,updated_at",
    "id,data,updated_at",
    "id,data"
  ];

  for (const columns of selectCandidates) {
    const { data, error } = await supabase
      .from("smart_promotions")
      .select(columns)
      .order("updated_at", { ascending: false });

    if (error) continue;
    return (Array.isArray(data) ? data : [])
      .map(normalizeSmartPromotion)
      .filter((promotion) => promotion.id);
  }

  return [];
}

export async function fetchPosCatalogConfig() {
  if (!supabase) {
    return {
      ok: true,
      coupons: [],
      smartPromotions: [],
      message: ""
    };
  }

  try {
    const [coupons, smartPromotions] = await Promise.all([
      readCoupons(),
      readSmartPromotions()
    ]);

    return {
      ok: true,
      coupons,
      smartPromotions,
      message: ""
    };
  } catch (error) {
    return {
      ok: false,
      coupons: [],
      smartPromotions: [],
      message: error?.message || "Không tải được cấu hình khuyến mãi POS."
    };
  }
}
