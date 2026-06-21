import { getRuntimeSupabaseClient, getRepositoryRuntimeInfo } from "./repositoryRuntime.js";
import { getCustomerKey } from "../storageService.js";
import { initSupabaseRuntimeClient } from "../supabase/supabaseRuntimeClient.js";
import { isSupabaseConfigSyncEnabled } from "../supabase/runtimeFlags.js";
import { buildBranchLookupMap, normalizeBranchKey } from "../branchIdentityService.js";
import { isCheckinLikeEntryType } from "../loyaltyLedgerUtils.js";

let ordersWriteQueue = Promise.resolve();
let branchLookupCache = { value: null, cachedAt: 0 };
const BRANCH_LOOKUP_TTL_MS = 60 * 1000;
const unsupportedOrderColumns = new Set();
const unsupportedOrderItemColumns = new Set();
const PROFILE_TABLE = "profiles";
const LEGACY_CUSTOMER_TABLE = "customers";
const DEFAULT_PROFILE_ROLE = "customer";
const DEFAULT_PROFILE_STATUS = "active";
const CUSTOMER_ORDER_COLUMNS = [
  "id",
  "order_code",
  "customer_phone",
  "customer_name",
  "fulfillment_type",
  "payment_method",
  "status",
  "subtotal",
  "shipping_fee",
  "original_shipping_fee",
  "shipping_support_discount",
  "promo_discount",
  "promo_code",
  "points_discount",
  "points_earned",
  "total_amount",
  "distance_km",
  "lat",
  "lng",
  "branch_id",
  "branch_uuid",
  "branch_name",
  "branch_address",
  "pickup_branch_id",
  "pickup_branch_uuid",
  "pickup_branch_name",
  "pickup_branch_address",
  "delivery_branch_id",
  "delivery_branch_uuid",
  "delivery_branch_name",
  "delivery_branch_address",
  "pickup_time_text",
  "delivery_address",
  "pos_shift_id",
  "kitchen_status",
  "kitchen_done_at",
  "created_at",
  "metadata"
].join(",");
const CUSTOMER_ORDER_ITEM_COLUMNS = [
  "id",
  "order_id",
  "product_id",
  "product_name",
  "quantity",
  "unit_price",
  "line_total",
  "spice",
  "note",
  "toppings",
  "option_groups",
  "kitchen_item_status",
  "metadata"
].join(",");

function isSupabaseReady() {
  const info = getRepositoryRuntimeInfo();
  if (info.source === "supabase") return true;
  return isSupabaseConfigSyncEnabled();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isWalkInOrder(order = {}) {
  const metadata = getObject(order.metadata);
  return Boolean(
    metadata.walkIn ||
      metadata.walk_in ||
      String(order.customerPhoneKey || order.phone || "").startsWith("walkin:")
  );
}

async function getSupabaseClientAsync() {
  const existing = getRuntimeSupabaseClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  return getRuntimeSupabaseClient();
}

function normalizePhone(phone) {
  return getCustomerKey(phone || "");
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function toNullableUuid(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return isUuidLike(raw) ? raw : null;
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKitchenItemStatus(value = "") {
  return String(value || "").trim().toLowerCase() === "done" ? "done" : "pending";
}

function normalizeOrderItemOption(option = {}) {
  if (typeof option === "string") {
    return {
      id: "",
      name: option.trim(),
      price: 0,
      quantity: 1
    };
  }
  if (!option || typeof option !== "object" || Array.isArray(option)) {
    return null;
  }
  const name = String(option.name || option.label || option.value || option.title || option.optionName || "").trim();
  if (!name) return null;
  return {
    id: String(option.id || option.optionId || option.option_id || ""),
    name,
    price: toFiniteNumber(option.price, 0),
    quantity: Math.max(1, toFiniteNumber(option.quantity, 1))
  };
}

function normalizeOrderItemToppings(item = {}) {
  return (Array.isArray(item.toppings) ? item.toppings : [])
    .map((topping) => {
      const option = normalizeOrderItemOption(topping);
      if (!option) return null;
      return {
        ...topping,
        ...option,
        groupId: String(topping?.groupId || topping?.group_id || ""),
        groupName: String(topping?.groupName || topping?.group_name || topping?.group || ""),
        type: String(topping?.type || "")
      };
    })
    .filter(Boolean);
}

function getSelectedOptionGroupRows(item = {}) {
  const toppings = normalizeOrderItemToppings(item);
  const selectedByGroup = toppings.reduce((map, topping) => {
    const groupId = String(topping?.groupId || topping?.group_id || "").trim();
    const groupName = String(topping?.groupName || topping?.group_name || topping?.group || "").trim();
    const key = groupId || groupName;
    if (!key) return map;
    const current = map.get(key) || {
      id: groupId,
      name: groupName,
      type: topping?.type || "",
      options: []
    };
    current.options.push({
      id: topping?.id || "",
      name: topping?.name || topping?.label || "",
      price: Number(topping?.price || 0),
      quantity: Number(topping?.quantity || 1)
    });
    map.set(key, current);
    return map;
  }, new Map());

  const groupedFromToppings = [...selectedByGroup.values()];
  if (groupedFromToppings.length) return groupedFromToppings;

  return (Array.isArray(item.optionGroups) ? item.optionGroups : [])
    .map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return null;
      const rawOptions = Array.isArray(group.selectedOptions)
        ? group.selectedOptions
        : Array.isArray(group.selected)
          ? group.selected
          : [];
      const options = rawOptions.map(normalizeOrderItemOption).filter(Boolean);
      if (!options.length) return null;
      return {
        id: String(group.id || group.groupId || ""),
        name: String(group.name || group.groupName || ""),
        type: String(group.type || ""),
        options
      };
    })
    .filter(Boolean);
}

function getOrderItemOptionLabels(item = {}) {
  const labels = [];

  function pushLabel(value = "") {
    const label = String(value || "").trim();
    if (label && !labels.includes(label)) labels.push(label);
  }

  normalizeOrderItemToppings(item).forEach((topping) => {
    const prefix = topping.groupName ? `${topping.groupName}: ` : "";
    pushLabel(`${prefix}${topping.name}`);
  });
  getSelectedOptionGroupRows(item).forEach((group) => {
    (group.options || []).forEach((option) => {
      const prefix = group.name ? `${group.name}: ` : "";
      pushLabel(`${prefix}${option.name}`);
    });
  });
  if (item.spice) pushLabel(item.spice);
  return labels;
}

function getOrderItemProductId(item = {}, index = 0) {
  return String(
    item.productId ||
      item.product_id ||
      item.product?.id ||
      item.id ||
      item.cartId ||
      `item-${index}`
  );
}

function buildOrderItemMetadata(item = {}, index = 0) {
  const productId = getOrderItemProductId(item, index);
  return {
    ...item,
    id: String(item.id || productId),
    productId,
    product_id: productId,
    cartId: String(item.cartId || item.id || productId),
    options: getOrderItemOptionLabels(item),
    toppings: normalizeOrderItemToppings(item),
    optionGroups: getSelectedOptionGroupRows(item),
    kitchenItemStatus: normalizeKitchenItemStatus(item.kitchenItemStatus || item.kitchen_item_status || item.status),
    ghrOrderIndex: Number(item.ghrOrderIndex ?? index)
  };
}

function buildOrderItemRow(item = {}, orderId = "", index = 0) {
  const productId = getOrderItemProductId(item, index);
  const quantity = Math.max(1, toFiniteNumber(item.quantity, 1));
  const unitPrice = toFiniteNumber(item.unitTotal ?? item.unitPrice ?? item.price, 0);
  const lineTotal = toFiniteNumber(item.lineTotal, quantity * unitPrice);
  const sourceItemId = toNullableUuid(item.sourceItemId || item.source_item_id || item.rowId);
  const row = {
    order_id: orderId,
    product_id: productId,
    product_name: String(item.name || item.productName || item.product_name || ""),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    spice: String(item.spice || ""),
    note: String(item.note || ""),
    toppings: normalizeOrderItemToppings(item),
    option_groups: getSelectedOptionGroupRows(item),
    kitchen_item_status: normalizeKitchenItemStatus(item.kitchenItemStatus || item.kitchen_item_status || item.status),
    metadata: buildOrderItemMetadata(item, index)
  };
  if (sourceItemId) row.id = sourceItemId;
  return row;
}

async function readBranchLookupMap() {
  if (!isSupabaseReady()) return new Map();
  const now = Date.now();
  if (branchLookupCache.value && now - branchLookupCache.cachedAt < BRANCH_LOOKUP_TTL_MS) {
    return branchLookupCache.value;
  }
  const client = await getSupabaseClientAsync();
  if (!client) return new Map();

  const trySelectBranches = async (columns, withIsOpenFilter) => {
    let query = client.from("branches").select(columns);
    if (withIsOpenFilter) query = query.eq("is_open", true);
    return query;
  };
  const branchSelectCandidates = [
    "branch_uuid,branch_code,slug,name,id,data",
    "branch_uuid,branch_code,name,id,data",
    "branch_uuid,name,id,data",
    "name,id,data"
  ];

  let data = [];
  let resolved = false;
  let lastError = null;
  for (const columns of branchSelectCandidates) {
    for (const withIsOpenFilter of [true, false]) {
      try {
        const result = await trySelectBranches(columns, withIsOpenFilter);
        if (result?.error) {
          lastError = result.error;
          continue;
        }
        data = Array.isArray(result?.data) ? result.data : [];
        resolved = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (resolved) break;
  }
  if (!resolved && lastError) throw lastError;

  const map = buildBranchLookupMap(data);

  branchLookupCache = { value: map, cachedAt: now };
  return map;
}

async function enrichOrderBranchUuids(order = {}) {
  let branchLookup = new Map();
  try {
    branchLookup = await readBranchLookupMap();
  } catch (error) {
    console.warn("[orderRepository] branch lookup map unavailable, skip uuid enrichment", {
      message: error?.message || String(error || ""),
      code: error?.code || ""
    });
    return order;
  }
  if (!branchLookup.size) return order;

  const resolveUuid = (...candidates) => {
    for (const candidate of candidates) {
      const raw = String(candidate || "").trim();
      if (!raw) continue;
      if (branchLookup.has(raw)) return branchLookup.get(raw);
      const normalized = normalizeBranchKey(raw);
      if (normalized && branchLookup.has(normalized)) return branchLookup.get(normalized);
    }
    return "";
  };

  const fulfillmentType = String(order?.fulfillmentType || "").toLowerCase();
  const branchUuid = String(order?.branchUuid || "").trim() || resolveUuid(order?.branchId, order?.branchName);
  const pickupBranchUuid =
    String(order?.pickupBranchUuid || "").trim() ||
    (fulfillmentType === "pickup" ? resolveUuid(order?.pickupBranchId, order?.pickupBranchName, order?.branchId, order?.branchName) : "");
  const deliveryBranchUuid =
    String(order?.deliveryBranchUuid || "").trim() ||
    (fulfillmentType === "delivery" ? resolveUuid(order?.deliveryBranchId, order?.deliveryBranchName, order?.branchId, order?.branchName) : "");

  return {
    ...order,
    branchUuid: branchUuid || null,
    pickupBranchUuid: pickupBranchUuid || null,
    deliveryBranchUuid: deliveryBranchUuid || null
  };
}

function readOrderItemMetadata(item = {}) {
  if (item?.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)) {
    return item.metadata;
  }
  return {};
}

function mapOrderItemRowToCartItem(item = {}) {
  const metadata = readOrderItemMetadata(item);
  const quantity = Number(item.quantity || metadata.quantity || 1);
  const unitTotal = Number(item.unit_price || metadata.unitTotal || metadata.price || 0);
  const lineTotal = Number(item.line_total || metadata.lineTotal || quantity * unitTotal);
  const sourceItemId = String(item.id || metadata.sourceItemId || "");
  const productId = String(item.product_id || metadata.productId || metadata.product_id || metadata.id || "");
  const kitchenItemStatus = String(item.kitchen_item_status || metadata.kitchenItemStatus || metadata.status || "pending");
  const metadataImage = String(
    metadata.image ||
      metadata.thumbnail ||
      metadata.thumbnailUrl ||
      metadata.thumbnail_url ||
      metadata.imageUrl ||
      metadata.image_url ||
      metadata.productImage ||
      metadata.product_image ||
      metadata.photo ||
      metadata.img ||
      ""
  );
  const toppings = Array.isArray(item.toppings) ? item.toppings : Array.isArray(metadata.toppings) ? metadata.toppings : [];
  const optionGroups = Array.isArray(item.option_groups) ? item.option_groups : Array.isArray(metadata.optionGroups) ? metadata.optionGroups : [];
  const options = [
    ...toppings.map((option) => String(option?.label || option?.name || option?.value || "").trim()),
    ...optionGroups.flatMap((group) => {
      if (Array.isArray(group?.options)) return group.options;
      if (Array.isArray(group?.items)) return group.items;
      return Array.isArray(group) ? group : [group];
    }).map((option) => String(option?.label || option?.name || option?.value || option?.title || "").trim()),
    String(item.spice || metadata.spice || "").trim()
  ].filter(Boolean);
  return {
    ...metadata,
    id: productId || sourceItemId,
    sourceItemId,
    orderId: String(item.order_id || metadata.orderId || ""),
    productId,
    product_id: productId,
    name: item.product_name || metadata.name || "",
    quantity,
    price: Number(metadata.price ?? unitTotal),
    unitTotal,
    lineTotal,
    spice: item.spice || metadata.spice || "",
    note: item.note || metadata.note || "",
    image: metadataImage,
    toppings,
    optionGroups,
    options: Array.from(new Set(options)),
    kitchenItemStatus,
    status: kitchenItemStatus,
    metadata
  };
}

function getDateKeyFromIso(value) {
  const iso = String(value || "");
  return iso.length >= 10 ? iso.slice(0, 10) : "";
}

function previousDateKey(dateKey) {
  const base = new Date(`${String(dateKey).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

function buildCheckinStatsFromLedger(pointHistory = []) {
  const checkinDates = Array.from(
    new Set(
      (pointHistory || [])
        .filter((entry) => isCheckinLikeEntryType(entry?.type))
        .map((entry) => getDateKeyFromIso(entry?.createdAt))
        .filter(Boolean)
    )
  ).sort((a, b) => String(b).localeCompare(String(a)));

  const lastCheckinDate = checkinDates[0] || null;
  if (!lastCheckinDate) {
    return {
      checkinHistory: [],
      checkinStreak: 0,
      lastCheckinDate: null
    };
  }

  const checkinSet = new Set(checkinDates);
  let streak = 0;
  let cursor = lastCheckinDate;
  while (cursor && checkinSet.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return {
    checkinHistory: [...checkinDates].sort((a, b) => String(a).localeCompare(String(b))),
    checkinStreak: streak,
    lastCheckinDate
  };
}

function buildLoyaltySnapshotFromRows(accountRow = null, ledgerRows = [], phone = "") {
  const pointHistory = (ledgerRows || []).map((row) => ({
    id: row.id,
    type: row.entry_type,
    orderId: row.order_id,
    points: Number(row.points || 0),
    amount: Number(row.amount || 0),
    title: row.title || "",
    note: row.note || "",
    source: row.source || "",
    sourceType: row.source_type || "",
    sourceOrderId: row.source_order_id || "",
    action: row.action || "",
    actionVersion: Number(row.action_version || 0),
    idempotencyKey: row.idempotency_key || "",
    partnerOrderCode: row.partner_order_code || "",
    partnerOrderId: row.partner_order_id || "",
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at
  }));
  const totalPoints = pointHistory.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
  const checkinStats = buildCheckinStatsFromLedger(pointHistory);

  return {
    phone,
    totalPoints: Math.max(0, Number(totalPoints || 0)),
    checkinStreak: Number(checkinStats.checkinStreak || 0),
    lastCheckinDate: checkinStats.lastCheckinDate || null,
    lastMissedStreak: Number(accountRow?.last_missed_streak || 0),
    comebackUsedDate: accountRow?.comeback_used_date || null,
    voucherHistory: Array.isArray(accountRow?.vouchers) ? accountRow.vouchers : [],
    pointHistory,
    checkinHistory: checkinStats.checkinHistory
  };
}

function getOrderPhoneKey(rawPhone) {
  const normalized = normalizePhone(rawPhone);
  if (normalized) return normalized;
  const raw = String(rawPhone || "").trim();
  if (!raw) return "";
  return `raw:${raw}`;
}

function _isPlaceholderCustomerName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized === "" || normalized === "khách" || normalized === "khách vãng lai" || normalized === "khach" || normalized === "khach vang lai";
}

function toCustomerRow(user = {}) {
  const phone = normalizePhone(user.phone);
  if (!phone) return null;
  const safeName = String(user.name || "").trim();
  const safeEmail = String(user.email || "").trim();
  const safeAvatarUrl = String(user.avatarUrl || user.avatar_url || "").trim();
  const safePasswordDemo = String(user.passwordDemo || user.password_demo || "").trim();
  const row = {
    phone,
    registered: Boolean(user.registered || user.passwordDemo || user.password_demo),
    total_orders: Number(user.totalOrders || user.total_orders || 0),
    total_spent: Number(user.totalSpent || user.total_spent || 0),
    member_rank: String(user.memberRank || user.member_rank || "Member"),
    role: String(user.role || DEFAULT_PROFILE_ROLE),
    status: String(user.status || DEFAULT_PROFILE_STATUS)
  };
  const safeAuthUserId = String(user.authUserId || user.auth_user_id || "").trim();
  if (safeAuthUserId) row.auth_user_id = safeAuthUserId;
  if (safeName) row.name = safeName;
  if (safeEmail) row.email = safeEmail;
  if (safeAvatarUrl) row.avatar_url = safeAvatarUrl;
  if (safePasswordDemo) row.password_demo = safePasswordDemo;
  row.metadata = {
    ...(user.metadata && typeof user.metadata === "object" ? user.metadata : {}),
    source: user.metadata?.source || "app"
  };
  return row;
}

function toLegacyCustomerRow(row = {}) {
  const phone = normalizePhone(row.phone);
  if (!phone) return null;
  const safeRole = String(row.role || DEFAULT_PROFILE_ROLE).trim().toLowerCase();
  if (safeRole && safeRole !== DEFAULT_PROFILE_ROLE) return null;
  const safeName = String(row.name || "").trim();
  const safeEmail = String(row.email || "").trim();
  const safeAvatarUrl = String(row.avatar_url || row.avatarUrl || "").trim();
  const safePasswordDemo = String(row.password_demo || row.passwordDemo || "").trim();
  const safeId = toNullableUuid(row.id);
  const createdAt = row.created_at || row.createdAt || null;
  const updatedAt = row.updated_at || row.updatedAt || new Date().toISOString();
  const legacyRow = {
    phone,
    email: safeEmail,
    avatar_url: safeAvatarUrl,
    password_demo: safePasswordDemo,
    registered: Boolean(row.registered || safePasswordDemo),
    total_orders: Number(row.total_orders || row.totalOrders || 0),
    total_spent: Number(row.total_spent || row.totalSpent || 0),
    member_rank: String(row.member_rank || row.memberRank || "Member"),
    updated_at: updatedAt
  };
  if (Object.prototype.hasOwnProperty.call(row, "name")) legacyRow.name = safeName;
  if (safeId) legacyRow.id = safeId;
  if (createdAt) legacyRow.created_at = createdAt;
  return legacyRow;
}

function fromCustomerRow(row = {}) {
  return {
    id: String(row.id || ""),
    authUserId: String(row.auth_user_id || ""),
    phone: normalizePhone(row.phone),
    name: String(row.name || ""),
    email: String(row.email || ""),
    avatarUrl: String(row.avatar_url || ""),
    passwordDemo: String(row.password_demo || ""),
    registered: Boolean(row.registered),
    role: String(row.role || DEFAULT_PROFILE_ROLE),
    status: String(row.status || DEFAULT_PROFILE_STATUS),
    totalOrders: Number(row.total_orders || 0),
    totalSpent: Number(row.total_spent || 0),
    memberRank: String(row.member_rank || "Member"),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function buildCustomerStubProfileRow(phone, profile = {}, existingProfile = null) {
  const customerPhone = normalizePhone(phone || profile?.phone);
  if (!customerPhone) return null;
  const safeName = String(
    profile?.name ||
      profile?.customerName ||
      profile?.customer_name ||
      ""
  ).trim();
  const existingRegistered = Boolean(existingProfile?.registered);
  const existingName = String(existingProfile?.name || "").trim();
  const metadata = {
    ...(existingProfile?.metadata && typeof existingProfile.metadata === "object" ? existingProfile.metadata : {}),
    ...(profile?.metadata && typeof profile.metadata === "object" ? profile.metadata : {}),
    source:
      profile?.metadata?.source ||
      profile?.source ||
      existingProfile?.metadata?.source ||
      "app",
    customer_stub: true
  };

  const row = {
    phone: customerPhone,
    role: DEFAULT_PROFILE_ROLE,
    status: DEFAULT_PROFILE_STATUS,
    registered: existingRegistered,
    metadata
  };

  const nextName = existingName || safeName;
  if (nextName) row.name = nextName;
  return row;
}

function selectProfileRows(client, columns = "*") {
  return client.from(PROFILE_TABLE).select(columns).eq("role", DEFAULT_PROFILE_ROLE);
}

async function upsertProfileRows(client, rows, options = {}) {
  const payload = (Array.isArray(rows) ? rows : [rows]).filter(Boolean).map((row) => {
    const nextRow = { ...row };
    if (!Object.prototype.hasOwnProperty.call(nextRow, "role")) {
      delete nextRow.role;
    }
    if (!Object.prototype.hasOwnProperty.call(nextRow, "status")) {
      delete nextRow.status;
    }
    return nextRow;
  });
  if (!payload.length) return null;
  const profileResult = await client.from(PROFILE_TABLE).upsert(payload, { onConflict: options.onConflict || "phone" });
  if (profileResult?.error) return profileResult;

  const legacyPayload = payload.map(toLegacyCustomerRow).filter(Boolean);
  if (legacyPayload.length) {
    const legacyResult = await client.from(LEGACY_CUSTOMER_TABLE).upsert(legacyPayload, { onConflict: "phone" });
    if (legacyResult?.error) return legacyResult;
  }

  return profileResult;
}

async function ensureProfileExistsByPhone(client, phone, profile = {}) {
  const key = normalizePhone(phone);
  if (!key) return null;
  const { data: existingProfile, error: existingProfileError } = await client
    .from(PROFILE_TABLE)
    .select("phone,name,registered,metadata")
    .eq("phone", key)
    .maybeSingle();
  if (existingProfileError) throw existingProfileError;
  const row = buildCustomerStubProfileRow(key, profile, existingProfile || null);
  if (!row) return null;
  const { error } = await upsertProfileRows(client, row, { onConflict: "phone" });
  if (error) throw error;
  return row;
}

async function ensureProfilesExistByPhones(client, phones = [], profileByPhone = {}) {
  const normalizedPhones = Array.from(new Set((Array.isArray(phones) ? phones : []).map((phone) => normalizePhone(phone)).filter(Boolean)));
  if (!normalizedPhones.length) return [];

  const { data: existingCustomers, error: existingCustomersError } = await client
    .from(PROFILE_TABLE)
    .select("phone,name,registered,metadata")
    .in("phone", normalizedPhones);
  if (existingCustomersError) throw existingCustomersError;

  const existingCustomerByPhone = new Map((existingCustomers || []).map((item) => [normalizePhone(item.phone), item]));
  const rows = normalizedPhones
    .filter((phone) => !existingCustomerByPhone.has(phone))
    .map((phone) => buildCustomerStubProfileRow(phone, profileByPhone?.[phone] || {}, null))
    .filter(Boolean);

  if (rows.length) {
    const { error: customerInsertError } = await upsertProfileRows(client, rows);
    if (customerInsertError) throw customerInsertError;
  }

  return rows;
}

async function readProfilesMapFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await selectProfileRows(client, "*").range(from, from + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.reduce((acc, row) => {
    const user = fromCustomerRow(row);
    if (!user.phone) return acc;
    acc[user.phone] = user;
    return acc;
  }, {});
}

async function readCustomerProfileCountFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const { count, error } = await client
    .from(PROFILE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("role", DEFAULT_PROFILE_ROLE);
  if (error) throw error;
  return Number.isFinite(Number(count)) ? Number(count) : null;
}

async function writeProfilesMapToTable(usersMap = {}) {
  if (!isSupabaseReady()) return usersMap;
  const client = await getSupabaseClientAsync();
  if (!client) return usersMap;
  const rows = Object.values(usersMap || {}).map(toCustomerRow).filter(Boolean);
  if (!rows.length) return usersMap;
  const { error } = await upsertProfileRows(client, rows, { onConflict: "phone" });
  if (error) throw error;
  return usersMap;
}

async function writeProfileRowToTable(user = {}) {
  if (!isSupabaseReady()) return user;
  const client = await getSupabaseClientAsync();
  if (!client) return user;
  const row = toCustomerRow(user);
  if (!row) return user;
  const { error } = await upsertProfileRows(client, [row], { onConflict: "phone" });
  if (error) throw error;
  return user;
}

function toAddressRow(phone, address = {}) {
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) return null;
  const rawId = String(address.id || "").trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
  const row = {
    customer_phone: customerPhone,
    label: String(address.label || ""),
    receiver_name: String(address.receiverName || ""),
    phone: String(address.phone || customerPhone),
    address: String(address.address || ""),
    lat: address.lat ?? null,
    lng: address.lng ?? null,
    distance_km: address.distanceKm ?? null,
    delivery_fee: address.deliveryFee ?? null,
    is_default: Boolean(address.isDefault)
  };
  if (isUuid) row.id = rawId;
  return row;
}

async function readAddressesByPhoneFromTable(phone = "") {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const key = normalizePhone(phone);
  let query = client.from("customer_addresses").select("*");
  if (key) {
    query = query.eq("customer_phone", key);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data)) return {};
  return data.reduce((acc, row) => {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) return acc;
    const item = {
      id: String(row.id || ""),
      label: String(row.label || ""),
      receiverName: String(row.receiver_name || ""),
      phone: String(row.phone || phone),
      address: String(row.address || ""),
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      distanceKm: row.distance_km ?? null,
      deliveryFee: row.delivery_fee ?? null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
    acc[phone] = [...(acc[phone] || []), item];
    return acc;
  }, {});
}

async function writeAddressesByPhoneToTable(addressesByPhone = {}) {
  if (!isSupabaseReady()) return addressesByPhone;
  const client = await getSupabaseClientAsync();
  if (!client) return addressesByPhone;
  const phones = Object.keys(addressesByPhone || {}).map((item) => normalizePhone(item)).filter(Boolean);
  if (!phones.length) return addressesByPhone;

  await ensureProfilesExistByPhones(client, phones);

  const { error: deleteError } = await client.from("customer_addresses").delete().in("customer_phone", phones);
  if (deleteError) throw deleteError;

  const rows = phones.flatMap((phone) => {
    const list = Array.isArray(addressesByPhone[phone]) ? addressesByPhone[phone] : [];
    return list.map((item) => toAddressRow(phone, item)).filter(Boolean);
  });
  if (rows.length) {
    const { error: insertError } = await client.from("customer_addresses").insert(rows);
    if (insertError) throw insertError;
  }
  return addressesByPhone;
}

async function writeAddressesForPhoneToTable(phone, addresses = []) {
  const key = normalizePhone(phone);
  if (!key) return addresses;
  await writeAddressesByPhoneToTable({
    [key]: Array.isArray(addresses) ? addresses : []
  });
  return addresses;
}

async function readOrdersByPhoneFromTable(options = {}) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const dateFrom = String(options?.dateFrom || "").trim();
  const dateTo = String(options?.dateTo || "").trim();
  let ordersQuery = client.from("orders").select(CUSTOMER_ORDER_COLUMNS);
  if (dateFrom) {
    ordersQuery = ordersQuery.gte("created_at", dateFrom);
  }
  if (dateTo) {
    ordersQuery = ordersQuery.lt("created_at", dateTo);
  }
  const { data: orders, error: orderError } = await ordersQuery.order("created_at", { ascending: false });
  if (orderError) throw orderError;

  const orderIds = Array.isArray(orders) ? orders.map((order) => order?.id).filter(Boolean) : [];
  let items = [];
  if (orderIds.length) {
    const { data: itemRows, error: itemError } = await client
      .from("order_items")
      .select(CUSTOMER_ORDER_ITEM_COLUMNS)
      .in("order_id", orderIds);
    if (itemError) throw itemError;
    items = Array.isArray(itemRows) ? itemRows : [];
  }

  const itemMap = new Map();
  (items || []).forEach((item) => {
    const list = itemMap.get(item.order_id) || [];
    list.push(mapOrderItemRowToCartItem(item));
    itemMap.set(item.order_id, list);
  });

  const map = {};
  (orders || []).forEach((order) => {
    const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
    const isWalkIn = Boolean(metadata.walkIn || metadata.walk_in);
    const phone = getOrderPhoneKey(order.customer_phone || "") || (
      isWalkIn ? String(metadata.customerPhoneKey || metadata.customer_phone_key || `walkin:${order.id || order.order_code}`).trim() : ""
    );
    if (!phone) return;
    const next = {
      id: order.id,
      orderCode: order.order_code || order.id,
      displayOrderCode: order.display_order_code || metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id,
      phone,
      customerPhone: isWalkIn ? "" : phone,
      customerName: order.customer_name || "",
      status: order.status || "pending_zalo",
      kitchenStatus: order.kitchen_status || metadata.kitchenStatus || "",
      kitchenDoneAt: order.kitchen_done_at || metadata.kitchenDoneAt || "",
      fulfillmentType: order.fulfillment_type || "delivery",
      paymentMethod: order.payment_method || "cash",
      paymentStatus: order.payment_status || metadata.paymentStatus || metadata.payment_status || "unpaid",
      paymentAmount: Number(order.payment_amount || metadata.paymentAmount || metadata.payment_amount || order.total_amount || 0),
      paymentReference: order.payment_reference || metadata.paymentReference || metadata.payment_reference || "",
      paidAt: order.paid_at || metadata.paidAt || metadata.paid_at || "",
      source: order.source || metadata.source || metadata.orderSource || metadata.channel || "online",
      channel: order.channel || metadata.channel || metadata.source || metadata.orderSource || "online",
      orderSource: metadata.orderSource || order.source || order.channel || "online",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      originalShippingFee: Number(order.original_shipping_fee || 0),
      shippingSupportDiscount: Number(order.shipping_support_discount || 0),
      promoDiscount: Number(order.promo_discount || 0),
      promoCode: order.promo_code || "",
      pointsDiscount: Number(order.points_discount || 0),
      pointStatus: order.point_status || metadata.pointStatus || metadata.point_status || "pending",
      pointsEarned: Number(order.points_earned || 0),
      totalAmount: Number(order.total_amount || 0),
      total: Number(order.total_amount || 0),
      distanceKm: order.distance_km,
      lat: order.lat,
      lng: order.lng,
      branchId: order.branch_id || metadata.branchId || "",
      branchUuid: order.branch_uuid || metadata.branchUuid || "",
      branchName: order.branch_name || "",
      branchAddress: order.branch_address || "",
      pickupBranchId: order.pickup_branch_id || metadata.pickupBranchId || "",
      pickupBranchUuid: order.pickup_branch_uuid || metadata.pickupBranchUuid || "",
      pickupBranchName: order.pickup_branch_name || metadata.pickupBranchName || "",
      pickupBranchAddress: order.pickup_branch_address || metadata.pickupBranchAddress || "",
      deliveryBranchId: order.delivery_branch_id || metadata.deliveryBranchId || "",
      deliveryBranchUuid: order.delivery_branch_uuid || metadata.deliveryBranchUuid || "",
      deliveryBranchName: order.delivery_branch_name || metadata.deliveryBranchName || "",
      deliveryBranchAddress: order.delivery_branch_address || metadata.deliveryBranchAddress || "",
      pickupTimeText: order.pickup_time_text || "",
      deliveryAddress: order.delivery_address || "",
      posShiftId: order.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id || metadata.shiftId || "",
      createdAt: order.created_at,
      items: itemMap.get(order.id) || []
    };
    map[phone] = [next, ...(map[phone] || [])];
  });
  return map;
}

async function readOrdersForPhoneFromTable(phone, options = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) return [];
  const limit = Number(options?.limit || 0);
  const includeItems = options?.includeItems !== false;

  let ordersQuery = client
    .from("orders")
    .select(CUSTOMER_ORDER_COLUMNS)
    .eq("customer_phone", customerPhone)
    .order("created_at", { ascending: false });
  if (Number.isFinite(limit) && limit > 0) {
    ordersQuery = ordersQuery.limit(Math.floor(limit));
  }

  const { data: orders, error: orderError } = await ordersQuery;
  if (orderError) throw orderError;
  if (!Array.isArray(orders) || !orders.length) return [];

  const orderIds = orders.map((order) => order?.id).filter(Boolean);
  let items = [];
  if (includeItems && orderIds.length) {
    const { data: itemRows, error: itemError } = await client
      .from("order_items")
      .select(CUSTOMER_ORDER_ITEM_COLUMNS)
      .in("order_id", orderIds);
    if (itemError) throw itemError;
    items = Array.isArray(itemRows) ? itemRows : [];
  }

  const itemMap = new Map();
  items.forEach((item) => {
    const list = itemMap.get(item.order_id) || [];
    list.push(mapOrderItemRowToCartItem(item));
    itemMap.set(item.order_id, list);
  });

  return orders.map((order) => {
    const phoneKey = getOrderPhoneKey(order.customer_phone || "");
    const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
    return {
      id: order.id,
      orderCode: order.order_code || order.id,
      displayOrderCode: order.display_order_code || metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id,
      phone: phoneKey,
      customerPhone: phoneKey,
      customerName: order.customer_name || "",
      status: order.status || "pending_zalo",
      kitchenStatus: order.kitchen_status || metadata.kitchenStatus || "",
      kitchenDoneAt: order.kitchen_done_at || metadata.kitchenDoneAt || "",
      fulfillmentType: order.fulfillment_type || "delivery",
      paymentMethod: order.payment_method || "cash",
      paymentStatus: order.payment_status || metadata.paymentStatus || metadata.payment_status || "unpaid",
      paymentAmount: Number(order.payment_amount || metadata.paymentAmount || metadata.payment_amount || order.total_amount || 0),
      paymentReference: order.payment_reference || metadata.paymentReference || metadata.payment_reference || "",
      paidAt: order.paid_at || metadata.paidAt || metadata.paid_at || "",
      source: order.source || metadata.source || metadata.orderSource || metadata.channel || "online",
      channel: order.channel || metadata.channel || metadata.source || metadata.orderSource || "online",
      orderSource: metadata.orderSource || order.source || order.channel || "online",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      originalShippingFee: Number(order.original_shipping_fee || 0),
      shippingSupportDiscount: Number(order.shipping_support_discount || 0),
      promoDiscount: Number(order.promo_discount || 0),
      promoCode: order.promo_code || "",
      pointsDiscount: Number(order.points_discount || 0),
      pointStatus: order.point_status || metadata.pointStatus || metadata.point_status || "pending",
      pointsEarned: Number(order.points_earned || 0),
      totalAmount: Number(order.total_amount || 0),
      total: Number(order.total_amount || 0),
      distanceKm: order.distance_km,
      lat: order.lat,
      lng: order.lng,
      branchId: order.branch_id || metadata.branchId || "",
      branchUuid: order.branch_uuid || metadata.branchUuid || "",
      branchName: order.branch_name || "",
      branchAddress: order.branch_address || "",
      pickupBranchId: order.pickup_branch_id || metadata.pickupBranchId || "",
      pickupBranchUuid: order.pickup_branch_uuid || metadata.pickupBranchUuid || "",
      pickupBranchName: order.pickup_branch_name || metadata.pickupBranchName || "",
      pickupBranchAddress: order.pickup_branch_address || metadata.pickupBranchAddress || "",
      deliveryBranchId: order.delivery_branch_id || metadata.deliveryBranchId || "",
      deliveryBranchUuid: order.delivery_branch_uuid || metadata.deliveryBranchUuid || "",
      deliveryBranchName: order.delivery_branch_name || metadata.deliveryBranchName || "",
      deliveryBranchAddress: order.delivery_branch_address || metadata.deliveryBranchAddress || "",
      pickupTimeText: order.pickup_time_text || "",
      deliveryAddress: order.delivery_address || "",
      posShiftId: order.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id || metadata.shiftId || "",
      createdAt: order.created_at,
      items: itemMap.get(order.id) || []
    };
  });
}

function toOrderRows(order = {}) {
  const walkIn = isWalkInOrder(order);
  const phone = normalizePhone(order.phone || order.customerPhone || "");
  if (!phone && !walkIn) return null;
  const id = String(order.id || order.orderCode || `order_${Date.now()}`);
  const orderRow = {
    id,
    order_code: String(order.orderCode || id),
    customer_phone: phone || null,
    customer_name: String(order.customerName || ""),
    fulfillment_type: String(order.fulfillmentType || "delivery"),
    payment_method: String(order.paymentMethod || "cash"),
    status: String(order.status || "pending_zalo"),
    subtotal: Number(order.subtotal ?? order.totalAmount ?? order.total ?? 0),
    shipping_fee: Number(order.shippingFee || 0),
    original_shipping_fee: Number(order.originalShippingFee || order.shippingFee || 0),
    shipping_support_discount: Number(order.shippingSupportDiscount || 0),
    promo_discount: Number(order.promoDiscount || 0),
    promo_code: String(order.promoCode || ""),
    points_discount: Number(order.pointsDiscount || 0),
    points_earned: Number(order.pointsEarned || 0),
    total_amount: Number(order.totalAmount ?? order.total ?? 0),
    distance_km: order.distanceKm ?? null,
    lat: order.lat ?? null,
    lng: order.lng ?? null,
    branch_id: toNullableUuid(order.branchId),
    branch_uuid: toNullableUuid(order.branchUuid),
    branch_name: String(order.branchName || ""),
    branch_address: String(order.branchAddress || ""),
    pickup_branch_id: toNullableUuid(order.pickupBranchId),
    pickup_branch_uuid: toNullableUuid(order.pickupBranchUuid),
    pickup_branch_name: String(order.pickupBranchName || ""),
    pickup_branch_address: String(order.pickupBranchAddress || ""),
    delivery_branch_id: toNullableUuid(order.deliveryBranchId),
    delivery_branch_uuid: toNullableUuid(order.deliveryBranchUuid),
    delivery_branch_name: String(order.deliveryBranchName || ""),
    delivery_branch_address: String(order.deliveryBranchAddress || ""),
    pickup_time_text: String(order.pickupTimeText || ""),
    delivery_address: String(order.deliveryAddress || ""),
    pos_shift_id: toNullableUuid(order.posShiftId || order.pos_shift_id || order.shiftId),
    metadata: order
  };
  const itemRows = (order.items || []).map((item, index) => buildOrderItemRow(item, id, index));
  return { orderRow, itemRows };
}

function shouldRetryWithTrimmedColumns(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    code === "42703" ||
    code === "pgrst204" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column"))
  );
}

function extractMissingColumnName(error) {
  const message = String(error?.message || "");
  const match = message.match(/column\s+"([^"]+)"/i);
  if (match?.[1]) return match[1];
  const pgrstMatch = message.match(/could not find the\s+'([^']+)'\s+column/i);
  return pgrstMatch?.[1] || "";
}

async function upsertOrderRowWithSchemaFallback(client, orderRow) {
  const mutableRow = { ...(orderRow || {}) };
  unsupportedOrderColumns.forEach((column) => {
    if (column in mutableRow) delete mutableRow[column];
  });
  const removedColumns = new Set();
  let attempts = 0;

  while (attempts < 4) {
    attempts += 1;
    const { error } = await client.from("orders").upsert(mutableRow, { onConflict: "id" });
    if (!error) return;
    if (!shouldRetryWithTrimmedColumns(error)) throw error;
    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || removedColumns.has(missingColumn)) throw error;
    removedColumns.add(missingColumn);
    unsupportedOrderColumns.add(missingColumn);
    delete mutableRow[missingColumn];
  }

  throw new Error("orders_upsert_failed_after_schema_fallback");
}

async function insertOrderItemRowsWithSchemaFallback(client, itemRows = []) {
  if (!itemRows.length) return;
  const removedColumns = new Set();
  let attempts = 0;

  while (attempts < 5) {
    attempts += 1;
    const payload = itemRows.map((row) => {
      const nextRow = { ...(row || {}) };
      unsupportedOrderItemColumns.forEach((column) => {
        if (column in nextRow) delete nextRow[column];
      });
      return nextRow;
    });
    const { error } = await client.from("order_items").insert(payload);
    if (!error) return;
    if (!shouldRetryWithTrimmedColumns(error)) throw error;
    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || removedColumns.has(missingColumn)) throw error;
    removedColumns.add(missingColumn);
    unsupportedOrderItemColumns.add(missingColumn);
  }

  throw new Error("order_items_insert_failed_after_schema_fallback");
}

async function writeOrdersByPhoneToTable(ordersByPhone = {}) {
  const runWrite = async () => {
    if (!isSupabaseReady()) return ordersByPhone;
    const client = await getSupabaseClientAsync();
    if (!client) return ordersByPhone;
    const orderList = Object.values(ordersByPhone || {}).flat().filter(Boolean);
    if (!orderList.length) return ordersByPhone;
    const mapped = orderList.map(toOrderRows).filter(Boolean);
    const orderRows = mapped.map((item) => item.orderRow);
    const itemRows = mapped.flatMap((item) => item.itemRows);

    const customerRowsRaw = Array.from(
      new Map(
        orderRows.filter((row) => row.customer_phone).map((row) => [
          row.customer_phone,
          {
            phone: row.customer_phone,
            name: row.customer_name
          }
        ])
      ).values()
    );
    if (customerRowsRaw.length) {
      await ensureProfilesExistByPhones(
        client,
        customerRowsRaw.map((item) => item.phone),
        customerRowsRaw.reduce((map, item) => {
          map[normalizePhone(item.phone)] = item;
          return map;
        }, {})
      );
    }

    for (const row of orderRows) {
      await upsertOrderRowWithSchemaFallback(client, row);
    }

    const orderIds = orderRows.map((row) => row.id);
    if (orderIds.length) {
      const { error: deleteItemsError } = await client.from("order_items").delete().in("order_id", orderIds);
      if (deleteItemsError) throw deleteItemsError;
    }
    if (itemRows.length) {
      await insertOrderItemRowsWithSchemaFallback(client, itemRows);
    }
    return ordersByPhone;
  };

  ordersWriteQueue = ordersWriteQueue.then(runWrite, runWrite);
  return ordersWriteQueue;
}

async function upsertOrderToTable(order = {}) {
  if (!isSupabaseReady()) return order;
  const client = await getSupabaseClientAsync();
  if (!client) return order;
  const normalizedOrder = await enrichOrderBranchUuids(order);
  const mapped = toOrderRows(normalizedOrder);
  if (!mapped) return order;
  const { orderRow, itemRows } = mapped;

  const customerPhone = normalizePhone(orderRow.customer_phone);
  if (customerPhone) {
    await ensureProfileExistsByPhone(client, customerPhone, {
      customerName: orderRow.customer_name,
      source: "orders"
    });
  }

  await upsertOrderRowWithSchemaFallback(client, orderRow);

  const { error: deleteItemsError } = await client.from("order_items").delete().eq("order_id", orderRow.id);
  if (deleteItemsError) throw deleteItemsError;
  if (itemRows.length) {
    await insertOrderItemRowsWithSchemaFallback(client, itemRows);
  }
  return order;
}

async function updateOrderStatusById(orderId, nextStatus) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const id = String(orderId || "").trim();
  const status = String(nextStatus || "").trim();
  if (!id || !status) return null;

  const patch = {
    status,
    updated_at: new Date().toISOString()
  };

  let updatedRow = null;
  const { data: byIdRows, error: byIdError } = await client
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select("*");
  if (byIdError) throw byIdError;
  if (Array.isArray(byIdRows) && byIdRows.length) {
    updatedRow = byIdRows[0];
  } else {
    const { data: byCodeRows, error: byCodeError } = await client
      .from("orders")
      .update(patch)
      .eq("order_code", id)
      .select("*");
    if (byCodeError) throw byCodeError;
    if (Array.isArray(byCodeRows) && byCodeRows.length) {
      updatedRow = byCodeRows[0];
    }
  }

  return updatedRow;
}

async function readLoyaltyByPhoneFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const { data: accounts, error: accountError } = await client.from("loyalty_accounts").select("*");
  if (accountError) throw accountError;
  const { data: ledger, error: ledgerError } = await client.from("loyalty_ledger").select("*").order("created_at", { ascending: false });
  if (ledgerError) throw ledgerError;

  const ledgerByPhone = {};
  (ledger || []).forEach((row) => {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) return;
    ledgerByPhone[phone] = [...(ledgerByPhone[phone] || []), row];
  });
  const map = {};
  (accounts || []).forEach((row) => {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) return;
    map[phone] = buildLoyaltySnapshotFromRows(row, ledgerByPhone[phone] || [], phone);
  });
  Object.entries(ledgerByPhone).forEach(([phone, rows]) => {
    if (map[phone]) return;
    map[phone] = buildLoyaltySnapshotFromRows(null, rows || [], phone);
  });
  return map;
}

async function readLoyaltyForPhoneFromTable(phone) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const key = normalizePhone(phone);
  if (!key) return null;

  const { data: account, error: accountError } = await client
    .from("loyalty_accounts")
    .select("*")
    .eq("customer_phone", key)
    .maybeSingle();
  if (accountError) throw accountError;

  const { data: ledger, error: ledgerError } = await client
    .from("loyalty_ledger")
    .select("*")
    .eq("customer_phone", key)
    .order("created_at", { ascending: false });
  if (ledgerError) throw ledgerError;

  return buildLoyaltySnapshotFromRows(account || null, ledger || [], key);
}

async function readLoyaltyAccountsSummaryFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const { data, error } = await client
    .from("loyalty_accounts")
    .select("customer_phone,total_points,checkin_streak,last_checkin_date,last_missed_streak,comeback_used_date,vouchers,updated_at");
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) return;
    map[phone] = {
      phone,
      totalPoints: Number(row.total_points || 0),
      checkinStreak: Number(row.checkin_streak || 0),
      lastCheckinDate: row.last_checkin_date || null,
      lastMissedStreak: Number(row.last_missed_streak || 0),
      comebackUsedDate: row.comeback_used_date || null,
      voucherHistory: Array.isArray(row.vouchers) ? row.vouchers : [],
      pointHistory: [],
      checkinHistory: [],
      updatedAt: row.updated_at || ""
    };
  });
  return map;
}

async function readLoyaltyLedgerByPhonePaged(phone, { limit = 50, offset = 0 } = {}) {
  if (!isSupabaseReady()) return { rows: [], total: 0 };
  const client = await getSupabaseClientAsync();
  if (!client) return { rows: [], total: 0 };
  const key = normalizePhone(phone);
  if (!key) return { rows: [], total: 0 };
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const safeOffset = Math.max(0, Number(offset || 0));

  const { count, error: countError } = await client
    .from("loyalty_ledger")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", key);
  if (countError) throw countError;

  const { data, error } = await client
    .from("loyalty_ledger")
    .select("*")
    .eq("customer_phone", key)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;

  const rows = (data || []).map((row) => ({
    id: row.id,
    type: row.entry_type,
    orderId: row.order_id,
    points: Number(row.points || 0),
    amount: Number(row.amount || 0),
    title: row.title || "",
    note: row.note || "",
    source: row.source || "",
    sourceType: row.source_type || "",
    sourceOrderId: row.source_order_id || "",
    action: row.action || "",
    actionVersion: Number(row.action_version || 0),
    partnerOrderId: row.partner_order_id || "",
    partnerOrderCode: row.partner_order_code || "",
    createdAt: row.created_at
  }));
  return { rows, total: Number(count || 0) };
}

async function processOrderLoyalty({
  sourceType = "ORDER",
  sourceOrderId = "",
  action = "",
  idempotencyKey = ""
} = {}) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;

  const payload = {
    p_source_type: String(sourceType || "ORDER").trim().toUpperCase(),
    p_source_order_id: String(sourceOrderId || "").trim(),
    p_action: String(action || "").trim().toUpperCase(),
    p_idempotency_key: String(idempotencyKey || "").trim()
  };

  const { data, error } = await client.rpc("process_order_loyalty", payload);
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function processLoyaltyCheckin({ idempotencyKey = "" } = {}) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;

  const { data, error } = await client.rpc("process_loyalty_checkin", {
    p_idempotency_key: String(idempotencyKey || "").trim()
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function activateLoyaltyRuleVersion({
  earnNumerator = 1,
  earnDenominator = 100,
  redeemPointUnit = 1,
  redeemValue = 1,
  checkinDailyPoints = 0,
  streakRewards = {},
  idempotencyKey = ""
} = {}) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;

  const { data, error } = await client.rpc("activate_loyalty_rule_version", {
    p_earn_numerator: Math.max(1, Math.floor(Number(earnNumerator || 1))),
    p_earn_denominator: Math.max(1, Math.floor(Number(earnDenominator || 100))),
    p_redeem_point_unit: Math.max(1, Math.floor(Number(redeemPointUnit || 1))),
    p_redeem_value: Math.max(1, Math.floor(Number(redeemValue || 1))),
    p_checkin_daily_points: Math.max(0, Math.floor(Number(checkinDailyPoints || 0))),
    p_streak_rewards: streakRewards && typeof streakRewards === "object" ? streakRewards : {},
    p_idempotency_key: String(idempotencyKey || "").trim()
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function auditLoyaltyReconcileBacklog({
  customerPhone = "",
  sourceType = "",
  limit = 200
} = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];

  const { data, error } = await client.rpc("audit_loyalty_reconcile_backlog", {
    p_customer_phone: String(customerPhone || "").trim() || null,
    p_source_type: String(sourceType || "").trim().toUpperCase() || null,
    p_limit: Math.max(1, Math.min(1000, Number(limit || 200)))
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function reconcileLoyaltyBacklog({
  customerPhone = "",
  sourceType = "",
  limit = 200,
  dryRun = true
} = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];

  const { data, error } = await client.rpc("reconcile_loyalty_backlog", {
    p_customer_phone: String(customerPhone || "").trim() || null,
    p_source_type: String(sourceType || "").trim().toUpperCase() || null,
    p_limit: Math.max(1, Math.min(1000, Number(limit || 200))),
    p_dry_run: dryRun !== false
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function auditLoyaltyReconcilePlan({
  customerPhone = "",
  sourceType = "",
  limit = 200
} = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];

  const { data, error } = await client.rpc("audit_loyalty_reconcile_plan", {
    p_customer_phone: String(customerPhone || "").trim() || null,
    p_source_type: String(sourceType || "").trim().toUpperCase() || null,
    p_limit: Math.max(1, Math.min(1000, Number(limit || 200)))
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function reconcileLoyaltyBacklogSafe({
  customerPhone = "",
  sourceType = "",
  limit = 200,
  dryRun = true
} = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];

  const { data, error } = await client.rpc("reconcile_loyalty_backlog_safe", {
    p_customer_phone: String(customerPhone || "").trim() || null,
    p_source_type: String(sourceType || "").trim().toUpperCase() || null,
    p_limit: Math.max(1, Math.min(1000, Number(limit || 200))),
    p_dry_run: dryRun !== false
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function getCustomerOrderPointStatuses(phone = "", { limit = 200 } = {}) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];
  const key = normalizePhone(phone);
  if (!key) return [];

  const { data, error } = await client.rpc("get_customer_order_point_statuses", {
    p_customer_phone: key,
    p_limit: Math.max(1, Math.min(500, Number(limit || 200)))
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function applyLoyaltyEvent({
  phone = "",
  entryType = "OTHER",
  points = 0,
  orderId = "",
  amount = 0,
  title = "",
  note = "",
  metadata = {},
  createdAt = new Date().toISOString()
} = {}) {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const key = normalizePhone(phone);
  if (!key) return null;
  await ensureProfileExistsByPhone(client, key);
  const normalizedEntryType = String(entryType || "OTHER").trim().toUpperCase();
  const normalizedOrderId = String(orderId || "").trim();

  // Guard against duplicate order-scoped events (ORDER_EARN / ORDER_SPEND).
  if (normalizedOrderId && (normalizedEntryType === "ORDER_EARN" || normalizedEntryType === "ORDER_SPEND")) {
    try {
      const { data: existingRows, error: existingError } = await client
        .from("loyalty_ledger")
        .select("id")
        .eq("customer_phone", key)
        .eq("entry_type", normalizedEntryType)
        .eq("order_id", normalizedOrderId)
        .limit(1);
      if (existingError) throw existingError;
      if (Array.isArray(existingRows) && existingRows.length) {
        return readLoyaltyForPhoneFromTable(key);
      }
    } catch (error) {
      // The SECURITY DEFINER RPC below performs the same idempotency check.
      // Staff may not have direct select policy on loyalty_ledger, and that is OK.
      console.warn("[coreSupabaseRepository] skip client loyalty duplicate check", {
        code: error?.code || "",
        message: error?.message || String(error || "")
      });
    }
  }

  const payload = {
    p_customer_phone: key,
    p_entry_type: normalizedEntryType,
    p_points: Number(points || 0),
    p_order_id: normalizedOrderId || null,
    p_amount: Number(amount || 0),
    p_title: String(title || ""),
    p_note: String(note || ""),
    p_metadata: metadata && typeof metadata === "object" ? metadata : {},
    p_created_at: createdAt || new Date().toISOString()
  };

  const { error } = await client.rpc("apply_loyalty_event", payload);
  if (error) throw error;
  return readLoyaltyForPhoneFromTable(key);
}

async function writeLoyaltyByPhoneToTable(loyaltyByPhone = {}) {
  if (!isSupabaseReady()) return loyaltyByPhone;
  const client = await getSupabaseClientAsync();
  if (!client) return loyaltyByPhone;
  const phones = Object.keys(loyaltyByPhone || {});
  if (!phones.length) return loyaltyByPhone;

  const { data: existingCustomers, error: existingCustomersError } = await client
    .from(PROFILE_TABLE)
    .select("phone")
    .in("phone", phones.map((phone) => normalizePhone(phone)));
  if (existingCustomersError) throw existingCustomersError;
  const existingPhones = new Set((existingCustomers || []).map((item) => normalizePhone(item.phone)));
  const missingCustomerPhones = phones
    .map((phone) => normalizePhone(phone))
    .filter((phone) => phone && !existingPhones.has(phone));
  if (missingCustomerPhones.length) {
    await ensureProfilesExistByPhones(
      client,
      missingCustomerPhones,
      missingCustomerPhones.reduce((map, phone) => {
        map[phone] = { phone, source: "loyalty" };
        return map;
      }, {})
    );
  }

  const accountRows = phones.map((phone) => {
    const item = loyaltyByPhone[phone] || {};
    return {
      customer_phone: normalizePhone(phone),
      total_points: Number(item.totalPoints || 0),
      checkin_streak: Number(item.checkinStreak || 0),
      last_checkin_date: item.lastCheckinDate || null,
      last_missed_streak: Number(item.lastMissedStreak || 0),
      comeback_used_date: item.comebackUsedDate || null,
      vouchers: Array.isArray(item.voucherHistory) ? item.voucherHistory : Array.isArray(item.vouchers) ? item.vouchers : [],
      metadata: item
    };
  });

  const { error: accountError } = await client.from("loyalty_accounts").upsert(accountRows, { onConflict: "customer_phone" });
  if (accountError) throw accountError;

  const ledgerRows = phones.flatMap((phone) => {
    const item = loyaltyByPhone[phone] || {};
    return (item.pointHistory || []).map((entry) => ({
      id: String(entry.id || `point-${Date.now()}-${Math.random()}`),
      customer_phone: normalizePhone(phone),
      entry_type: String(entry.type || "ORDER_EARN"),
      order_id: entry.orderId || null,
      points: Number(entry.points || 0),
      amount: Number(entry.amount || 0),
      title: String(entry.title || ""),
      note: String(entry.note || ""),
      created_at: entry.createdAt || new Date().toISOString(),
      metadata: entry
    }));
  });

  if (phones.length) {
    const { error: deleteLedgerError } = await client.from("loyalty_ledger").delete().in("customer_phone", phones);
    if (deleteLedgerError) throw deleteLedgerError;
  }
  if (ledgerRows.length) {
    const { error: insertLedgerError } = await client.from("loyalty_ledger").insert(ledgerRows);
    if (insertLedgerError) throw insertLedgerError;
  }
  return loyaltyByPhone;
}

async function writeLoyaltyPhoneToTable(phone, loyalty = {}) {
  const key = normalizePhone(phone);
  if (!key) return loyalty;
  await writeLoyaltyByPhoneToTable({
    [key]: {
      ...(loyalty || {}),
      phone: key
    }
  });
  return loyalty;
}

function normalizeLoyaltyEntryId(entry = {}) {
  const explicitId = String(entry?.id || "").trim();
  if (explicitId) return explicitId;
  const orderId = String(entry?.orderId || "").trim();
  if (orderId) return `point-${orderId}`;
  return `point-${Date.now()}-${Math.random()}`;
}

function toLoyaltyLedgerRow(phone, entry = {}) {
  const key = normalizePhone(phone);
  if (!key) return null;
  return {
    id: normalizeLoyaltyEntryId(entry),
    customer_phone: key,
    entry_type: String(entry.type || "ORDER_EARN"),
    order_id: entry.orderId || null,
    points: Number(entry.points || 0),
    amount: Number(entry.amount || 0),
    title: String(entry.title || ""),
    note: String(entry.note || ""),
    created_at: entry.createdAt || new Date().toISOString(),
    metadata: entry
  };
}

async function upsertLoyaltyAccountByPhone(phone, loyalty = {}) {
  if (!isSupabaseReady()) return loyalty;
  const client = await getSupabaseClientAsync();
  if (!client) return loyalty;
  const key = normalizePhone(phone);
  if (!key) return loyalty;

  const { data: existingCustomer, error: existingCustomerError } = await client
    .from(PROFILE_TABLE)
    .select("phone")
    .eq("phone", key)
    .maybeSingle();
  if (existingCustomerError) throw existingCustomerError;
  if (!existingCustomer?.phone) {
    await ensureProfileExistsByPhone(client, key, { source: "loyalty" });
  }

  const pointHistory = Array.isArray(loyalty.pointHistory) ? loyalty.pointHistory : [];
  const totalFromHistory = pointHistory.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
  const checkinStats = buildCheckinStatsFromLedger(pointHistory);

  let ledgerTotal = totalFromHistory;
  let ledgerCheckinStats = checkinStats;
  try {
    const { data: ledgerRows, error: ledgerError } = await client
      .from("loyalty_ledger")
      .select("points, entry_type, created_at")
      .eq("customer_phone", key)
      .order("created_at", { ascending: false });
    if (ledgerError) throw ledgerError;
    if (Array.isArray(ledgerRows) && ledgerRows.length) {
      ledgerTotal = ledgerRows.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
      ledgerCheckinStats = buildCheckinStatsFromLedger(
        ledgerRows.map((entry) => ({
          type: entry?.entry_type || "",
          points: Number(entry?.points || 0),
          createdAt: entry?.created_at || ""
        }))
      );
    }
  } catch {
  }

  const row = {
    customer_phone: key,
    total_points: Math.max(0, Number(ledgerTotal || loyalty.totalPoints || 0)),
    checkin_streak: Number(ledgerCheckinStats.checkinStreak || loyalty.checkinStreak || 0),
    last_checkin_date: ledgerCheckinStats.lastCheckinDate || loyalty.lastCheckinDate || null,
    last_missed_streak: Number(loyalty.lastMissedStreak || 0),
    comeback_used_date: loyalty.comebackUsedDate || null,
    vouchers: Array.isArray(loyalty.voucherHistory) ? loyalty.voucherHistory : Array.isArray(loyalty.vouchers) ? loyalty.vouchers : [],
    metadata: loyalty
  };

  const { error } = await client.from("loyalty_accounts").upsert(row, { onConflict: "customer_phone" });
  if (error) throw error;
  return loyalty;
}

async function upsertLoyaltyEntryByPhone(phone, entry = {}) {
  if (!isSupabaseReady()) return entry;
  const client = await getSupabaseClientAsync();
  if (!client) return entry;
  await ensureProfileExistsByPhone(client, phone);
  const row = toLoyaltyLedgerRow(phone, entry);
  if (!row) return entry;
  const { error } = await client.from("loyalty_ledger").upsert(row, { onConflict: "id" });
  if (error) throw error;
  return entry;
}

function subscribeCoreDomainRealtime({ tables = [], onChange }) {
  const client = getRuntimeSupabaseClient();
  if (!client || typeof onChange !== "function") return () => {};
  const normalizedTables = Array.from(new Set((tables || []).map((item) => String(item || "").trim()).filter(Boolean)));
  if (!normalizedTables.length) return () => {};
  if (typeof window !== "undefined") {
    const path = String(window.location.pathname || "").toLowerCase();
    const isAdminOrKitchen = path.includes("/admin") || path.includes("/kitchen");
    if (!isAdminOrKitchen) {
      const blockedCustomerTables = new Set([
        PROFILE_TABLE,
        "customer_addresses",
        "loyalty_accounts",
        "loyalty_ledger",
        "app_configs",
        "products",
        "categories",
        "toppings",
        "promotions",
        "smart_promotions",
        "campaigns",
        "coupons",
        "home_banners",
        "branches",
        "delivery_zones",
        "home_content"
      ]);
      const hasBlocked = normalizedTables.some((table) => blockedCustomerTables.has(table));
      if (hasBlocked) return () => {};
    }
  }

  const channelName = `ghr-core-${normalizedTables.join("-")}-${Date.now()}`;
  let channel = client.channel(channelName);
  normalizedTables.forEach((table) => {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        onChange({
          table,
          payload
        });
      }
    );
  });
  channel = channel.subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // noop
    }
  };
}

function subscribeOrdersRealtime(onChange) {
  return subscribeCoreDomainRealtime({
    tables: ["orders", "order_items"],
    onChange
  });
}

function subscribeLoyaltyRealtime(onChange) {
  return subscribeCoreDomainRealtime({
    tables: ["loyalty_accounts", "loyalty_ledger"],
    onChange
  });
}

function subscribeCustomerAddressesRealtime(onChange) {
  return subscribeCoreDomainRealtime({
    tables: ["customer_addresses"],
    onChange
  });
}

function subscribeProfilesRealtime(onChange) {
  return subscribeCoreDomainRealtime({
    tables: [PROFILE_TABLE],
    onChange
  });
}

// Backward-compatible aliases during the customers -> profiles transition.
const readCustomersMapFromTable = readProfilesMapFromTable;
const writeCustomersMapToTable = writeProfilesMapToTable;
const writeCustomerRowToTable = writeProfileRowToTable;
const subscribeCustomersRealtime = subscribeProfilesRealtime;

export const coreSupabaseRepository = {
  readProfilesMapFromTable,
  readCustomerProfileCountFromTable,
  readCustomersMapFromTable,
  writeProfilesMapToTable,
  writeCustomersMapToTable,
  writeProfileRowToTable,
  writeCustomerRowToTable,
  readAddressesByPhoneFromTable,
  writeAddressesByPhoneToTable,
  writeAddressesForPhoneToTable,
  readOrdersByPhoneFromTable,
  readOrdersForPhoneFromTable,
  writeOrdersByPhoneToTable,
  upsertOrderToTable,
  updateOrderStatusById,
  readLoyaltyByPhoneFromTable,
  readLoyaltyForPhoneFromTable,
  readLoyaltyAccountsSummaryFromTable,
  readLoyaltyLedgerByPhonePaged,
  processOrderLoyalty,
  processLoyaltyCheckin,
  activateLoyaltyRuleVersion,
  auditLoyaltyReconcileBacklog,
  reconcileLoyaltyBacklog,
  auditLoyaltyReconcilePlan,
  reconcileLoyaltyBacklogSafe,
  getCustomerOrderPointStatuses,
  applyLoyaltyEvent,
  writeLoyaltyByPhoneToTable,
  writeLoyaltyPhoneToTable,
  upsertLoyaltyAccountByPhone,
  upsertLoyaltyEntryByPhone,
  subscribeProfilesRealtime,
  subscribeCustomersRealtime,
  subscribeCustomerAddressesRealtime,
  subscribeOrdersRealtime,
  subscribeLoyaltyRealtime
};

export { getSelectedOptionGroupRows };
