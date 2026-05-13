import { getRuntimeSupabaseClient, getRepositoryRuntimeInfo } from "./repositoryRuntime.js";
import { getCustomerKey } from "../storageService.js";
import { initSupabaseRuntimeClient } from "../supabase/supabaseRuntimeClient.js";
import { isSupabaseConfigSyncEnabled } from "../supabase/runtimeFlags.js";

let ordersWriteQueue = Promise.resolve();

function isSupabaseReady() {
  const info = getRepositoryRuntimeInfo();
  if (info.source === "supabase") return true;
  return isSupabaseConfigSyncEnabled();
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
        .filter((entry) => String(entry?.type || "").toUpperCase() === "CHECKIN")
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

function isPlaceholderCustomerName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized === "" || normalized === "khách" || normalized === "khách vãng lai" || normalized === "khach" || normalized === "khach vang lai";
}

function resolveCustomerNameFromOrder(existingName = "", incomingName = "") {
  const safeExisting = String(existingName || "").trim();
  const safeIncoming = String(incomingName || "").trim();
  if (!isPlaceholderCustomerName(safeExisting)) return safeExisting;
  if (!isPlaceholderCustomerName(safeIncoming)) return safeIncoming;
  return safeExisting || safeIncoming;
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
    member_rank: String(user.memberRank || user.member_rank || "Member")
  };
  if (safeName) row.name = safeName;
  if (safeEmail) row.email = safeEmail;
  if (safeAvatarUrl) row.avatar_url = safeAvatarUrl;
  if (safePasswordDemo) row.password_demo = safePasswordDemo;
  return row;
}

function fromCustomerRow(row = {}) {
  return {
    phone: normalizePhone(row.phone),
    name: String(row.name || ""),
    email: String(row.email || ""),
    avatarUrl: String(row.avatar_url || ""),
    passwordDemo: String(row.password_demo || ""),
    registered: Boolean(row.registered),
    totalOrders: Number(row.total_orders || 0),
    totalSpent: Number(row.total_spent || 0),
    memberRank: String(row.member_rank || "Member"),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

async function readCustomersMapFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const { data, error } = await client.from("customers").select("*");
  if (error) throw error;
  if (!Array.isArray(data)) return {};
  return data.reduce((acc, row) => {
    const user = fromCustomerRow(row);
    if (!user.phone) return acc;
    acc[user.phone] = user;
    return acc;
  }, {});
}

async function writeCustomersMapToTable(usersMap = {}) {
  if (!isSupabaseReady()) return usersMap;
  const client = await getSupabaseClientAsync();
  if (!client) return usersMap;
  const rows = Object.values(usersMap || {}).map(toCustomerRow).filter(Boolean);
  if (!rows.length) return usersMap;
  const { error } = await client.from("customers").upsert(rows, { onConflict: "phone" });
  if (error) throw error;
  return usersMap;
}

async function writeCustomerRowToTable(user = {}) {
  if (!isSupabaseReady()) return user;
  const client = await getSupabaseClientAsync();
  if (!client) return user;
  const row = toCustomerRow(user);
  if (!row) return user;
  const { error } = await client.from("customers").upsert([row], { onConflict: "phone" });
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

  const { data: existingCustomers, error: existingCustomersError } = await client
    .from("customers")
    .select("phone")
    .in("phone", phones);
  if (existingCustomersError) throw existingCustomersError;
  const existingPhones = new Set((existingCustomers || []).map((item) => normalizePhone(item.phone)));
  const missingCustomerRows = phones
    .filter((phone) => phone && !existingPhones.has(phone))
    .map((phone) => ({ phone, registered: false }));
  if (missingCustomerRows.length) {
    const { error: customerInsertError } = await client.from("customers").insert(missingCustomerRows);
    if (customerInsertError) throw customerInsertError;
  }

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

async function readOrdersByPhoneFromTable() {
  if (!isSupabaseReady()) return null;
  const client = await getSupabaseClientAsync();
  if (!client) return null;
  const { data: orders, error: orderError } = await client.from("orders").select("*").order("created_at", { ascending: false });
  if (orderError) throw orderError;

  const { data: items, error: itemError } = await client.from("order_items").select("*");
  if (itemError) throw itemError;

  const itemMap = new Map();
  (items || []).forEach((item) => {
    const list = itemMap.get(item.order_id) || [];
    list.push({
      id: item.product_id || "",
      name: item.product_name || "",
      quantity: Number(item.quantity || 1),
      price: Number(item.unit_price || 0),
      unitTotal: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
      spice: item.spice || "",
      note: item.note || "",
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
      optionGroups: Array.isArray(item.option_groups) ? item.option_groups : []
    });
    itemMap.set(item.order_id, list);
  });

  const map = {};
  (orders || []).forEach((order) => {
    const phone = getOrderPhoneKey(order.customer_phone || "");
    if (!phone) return;
    const next = {
      id: order.id,
      orderCode: order.order_code || order.id,
      phone,
      customerPhone: phone,
      customerName: order.customer_name || "",
      status: order.status || "pending_zalo",
      fulfillmentType: order.fulfillment_type || "delivery",
      paymentMethod: order.payment_method || "cash",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      originalShippingFee: Number(order.original_shipping_fee || 0),
      shippingSupportDiscount: Number(order.shipping_support_discount || 0),
      promoDiscount: Number(order.promo_discount || 0),
      promoCode: order.promo_code || "",
      pointsDiscount: Number(order.points_discount || 0),
      pointsEarned: Number(order.points_earned || 0),
      totalAmount: Number(order.total_amount || 0),
      total: Number(order.total_amount || 0),
      distanceKm: order.distance_km,
      lat: order.lat,
      lng: order.lng,
      branchName: order.branch_name || "",
      branchAddress: order.branch_address || "",
      pickupTimeText: order.pickup_time_text || "",
      deliveryAddress: order.delivery_address || "",
      createdAt: order.created_at,
      items: itemMap.get(order.id) || []
    };
    map[phone] = [next, ...(map[phone] || [])];
  });
  return map;
}

async function readOrdersForPhoneFromTable(phone) {
  if (!isSupabaseReady()) return [];
  const client = await getSupabaseClientAsync();
  if (!client) return [];
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) return [];

  const { data: orders, error: orderError } = await client
    .from("orders")
    .select("*")
    .eq("customer_phone", customerPhone)
    .order("created_at", { ascending: false });
  if (orderError) throw orderError;
  if (!Array.isArray(orders) || !orders.length) return [];

  const orderIds = orders.map((order) => order?.id).filter(Boolean);
  let items = [];
  if (orderIds.length) {
    const { data: itemRows, error: itemError } = await client
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);
    if (itemError) throw itemError;
    items = Array.isArray(itemRows) ? itemRows : [];
  }

  const itemMap = new Map();
  items.forEach((item) => {
    const list = itemMap.get(item.order_id) || [];
    list.push({
      id: item.product_id || "",
      name: item.product_name || "",
      quantity: Number(item.quantity || 1),
      price: Number(item.unit_price || 0),
      unitTotal: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
      spice: item.spice || "",
      note: item.note || "",
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
      optionGroups: Array.isArray(item.option_groups) ? item.option_groups : []
    });
    itemMap.set(item.order_id, list);
  });

  return orders.map((order) => {
    const phoneKey = getOrderPhoneKey(order.customer_phone || "");
    return {
      id: order.id,
      orderCode: order.order_code || order.id,
      phone: phoneKey,
      customerPhone: phoneKey,
      customerName: order.customer_name || "",
      status: order.status || "pending_zalo",
      fulfillmentType: order.fulfillment_type || "delivery",
      paymentMethod: order.payment_method || "cash",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      originalShippingFee: Number(order.original_shipping_fee || 0),
      shippingSupportDiscount: Number(order.shipping_support_discount || 0),
      promoDiscount: Number(order.promo_discount || 0),
      promoCode: order.promo_code || "",
      pointsDiscount: Number(order.points_discount || 0),
      pointsEarned: Number(order.points_earned || 0),
      totalAmount: Number(order.total_amount || 0),
      total: Number(order.total_amount || 0),
      distanceKm: order.distance_km,
      lat: order.lat,
      lng: order.lng,
      branchName: order.branch_name || "",
      branchAddress: order.branch_address || "",
      pickupTimeText: order.pickup_time_text || "",
      deliveryAddress: order.delivery_address || "",
      createdAt: order.created_at,
      items: itemMap.get(order.id) || []
    };
  });
}

function toOrderRows(order = {}) {
  const phone = normalizePhone(order.phone || order.customerPhone || "");
  if (!phone) return null;
  const id = String(order.id || order.orderCode || `order_${Date.now()}`);
  const orderRow = {
    id,
    order_code: String(order.orderCode || id),
    customer_phone: phone,
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
    branch_name: String(order.branchName || ""),
    branch_address: String(order.branchAddress || ""),
    pickup_time_text: String(order.pickupTimeText || ""),
    delivery_address: String(order.deliveryAddress || ""),
    metadata: order
  };
  const itemRows = (order.items || []).map((item) => ({
    order_id: id,
    product_id: String(item.id || ""),
    product_name: String(item.name || ""),
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unitTotal ?? item.price ?? 0),
    line_total: Number(item.lineTotal ?? (Number(item.quantity || 1) * Number(item.unitTotal ?? item.price ?? 0))),
    spice: String(item.spice || ""),
    note: String(item.note || ""),
    toppings: Array.isArray(item.toppings) ? item.toppings : [],
    option_groups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
    metadata: item
  }));
  return { orderRow, itemRows };
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
        orderRows.map((row) => [
          row.customer_phone,
          {
            phone: row.customer_phone
          }
        ])
      ).values()
    );
    if (customerRowsRaw.length) {
      const { data: existingCustomers, error: existingCustomersError } = await client
        .from("customers")
        .select("phone,name,registered")
        .in("phone", customerRowsRaw.map((item) => item.phone));
      if (existingCustomersError) throw existingCustomersError;
      const existingCustomerByPhone = new Map(
        (existingCustomers || []).map((item) => [normalizePhone(item.phone), item])
      );
      const customerRows = customerRowsRaw.map((item) => {
        const existing = existingCustomerByPhone.get(normalizePhone(item.phone)) || null;
        const row = {
          phone: item.phone,
          registered: Boolean(existing?.registered)
        };
        return {
          ...row
        };
      });
      const { error: customerUpsertError } = await client.from("customers").upsert(customerRows, { onConflict: "phone" });
      if (customerUpsertError) throw customerUpsertError;
    }

    const { error: orderError } = await client.from("orders").upsert(orderRows, { onConflict: "id" });
    if (orderError) throw orderError;

    const orderIds = orderRows.map((row) => row.id);
    if (orderIds.length) {
      const { error: deleteItemsError } = await client.from("order_items").delete().in("order_id", orderIds);
      if (deleteItemsError) throw deleteItemsError;
    }
    if (itemRows.length) {
      const { error: itemInsertError } = await client.from("order_items").insert(itemRows);
      if (itemInsertError) throw itemInsertError;
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
  const mapped = toOrderRows(order);
  if (!mapped) return order;
  const { orderRow, itemRows } = mapped;

  const customerPhone = normalizePhone(orderRow.customer_phone);
  if (customerPhone) {
    const { data: existingCustomer, error: existingCustomerError } = await client
      .from("customers")
      .select("phone,name,registered")
      .eq("phone", customerPhone)
      .maybeSingle();
    if (existingCustomerError) throw existingCustomerError;
    const customerRow = {
      phone: customerPhone,
      registered: Boolean(existingCustomer?.registered)
    };
    const { error: customerUpsertError } = await client.from("customers").upsert(customerRow, { onConflict: "phone" });
    if (customerUpsertError) throw customerUpsertError;
  }

  const { error: orderError } = await client.from("orders").upsert(orderRow, { onConflict: "id" });
  if (orderError) throw orderError;

  const { error: deleteItemsError } = await client.from("order_items").delete().eq("order_id", orderRow.id);
  if (deleteItemsError) throw deleteItemsError;
  if (itemRows.length) {
    const { error: itemInsertError } = await client.from("order_items").insert(itemRows);
    if (itemInsertError) throw itemInsertError;
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
    createdAt: row.created_at
  }));
  return { rows, total: Number(count || 0) };
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
  const normalizedEntryType = String(entryType || "OTHER").trim().toUpperCase();
  const normalizedOrderId = String(orderId || "").trim();

  // Guard against duplicate order-scoped events (ORDER_EARN / ORDER_SPEND).
  if (normalizedOrderId && (normalizedEntryType === "ORDER_EARN" || normalizedEntryType === "ORDER_SPEND")) {
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
    .from("customers")
    .select("phone")
    .in("phone", phones.map((phone) => normalizePhone(phone)));
  if (existingCustomersError) throw existingCustomersError;
  const existingPhones = new Set((existingCustomers || []).map((item) => normalizePhone(item.phone)));
  const missingCustomerRows = phones
    .map((phone) => normalizePhone(phone))
    .filter((phone) => phone && !existingPhones.has(phone))
    .map((phone) => ({ phone, registered: false }));
  if (missingCustomerRows.length) {
    const { error: customerInsertError } = await client.from("customers").insert(missingCustomerRows);
    if (customerInsertError) throw customerInsertError;
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
    .from("customers")
    .select("phone")
    .eq("phone", key)
    .maybeSingle();
  if (existingCustomerError) throw existingCustomerError;
  if (!existingCustomer?.phone) {
    const { error: customerInsertError } = await client.from("customers").insert({ phone: key, registered: false });
    if (customerInsertError) throw customerInsertError;
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
  } catch (_error) {
    // keep fallback from in-memory snapshot
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
        "customers",
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
    } catch (_error) {
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

function subscribeCustomersRealtime(onChange) {
  return subscribeCoreDomainRealtime({
    tables: ["customers"],
    onChange
  });
}

export const coreSupabaseRepository = {
  readCustomersMapFromTable,
  writeCustomersMapToTable,
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
  applyLoyaltyEvent,
  writeLoyaltyByPhoneToTable,
  writeLoyaltyPhoneToTable,
  upsertLoyaltyAccountByPhone,
  upsertLoyaltyEntryByPhone,
  subscribeCustomersRealtime,
  subscribeCustomerAddressesRealtime,
  subscribeOrdersRealtime,
  subscribeLoyaltyRealtime
};
