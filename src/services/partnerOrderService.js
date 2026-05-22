import { getCustomerKey } from "./storageService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

const SOURCE_BADGES = {
  website: {
    label: "Website",
    className: "border-sky-100 bg-sky-50 text-sky-700"
  },
  pickup: {
    label: "Tự Lấy",
    className: "border-amber-100 bg-amber-50 text-amber-700"
  },
  qr_counter: {
    label: "QR Tại Quầy",
    className: "border-violet-100 bg-violet-50 text-violet-700"
  },
  grabfood: {
    label: "Grab",
    className: "border-green-100 bg-green-50 text-green-700"
  },
  shopeefood: {
    label: "Shopee",
    className: "border-red-100 bg-red-50 text-red-600"
  },
  xanhngon: {
    label: "Xanh Ngon",
    className: "border-emerald-100 bg-emerald-50 text-emerald-600"
  },
  weborder: {
    label: "Website",
    className: "border-sky-100 bg-sky-50 text-sky-700"
  }
};

function normalizeBranchMatch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getBranchCandidates(branch = {}) {
  return [
    branch.branch_uuid,
    branch.branchUuid,
    branch.uuid,
    branch.id,
    branch.dbId,
    branch.branch_code,
    branch.branchCode,
    branch.legacy_id,
    branch.slug,
    branch.name,
    branch.address
  ];
}

function getOrderBranchCandidates(order = {}) {
  return [
    order.branchUuid,
    order.branch_uuid,
    order.pickupBranchUuid,
    order.pickup_branch_uuid,
    order.deliveryBranchUuid,
    order.delivery_branch_uuid,
    order.branchId,
    order.branch_id,
    order.pickupBranchId,
    order.deliveryBranchId,
    order.branchName,
    order.branch_name,
    order.pickupBranchName,
    order.deliveryBranchName,
    order.branch?.name
  ];
}

function findBranchByAlias(orderBranchText = "", branches = []) {
  const normalized = normalizeBranchMatch(orderBranchText);
  if (!normalized) return null;

  const aliasTargets = [
    {
      aliases: ["phuhoa"],
      targets: ["duong304", "duong30thang4", "304", "cn01"]
    },
    {
      aliases: ["thichquangduc", "tqd"],
      targets: ["thichquangduc", "cn02"]
    },
    {
      aliases: ["lehongphong", "lhp"],
      targets: ["lehongphong", "cn03"]
    }
  ];

  const matchedAlias = aliasTargets.find((item) => item.aliases.some((alias) => normalized.includes(alias)));
  if (!matchedAlias) return null;

  return (branches || []).find((branch) => {
    const branchText = getBranchCandidates(branch).map(normalizeBranchMatch).join(" ");
    return matchedAlias.targets.some((target) => branchText.includes(target));
  }) || null;
}

export function resolveOrderBranch(order = {}, branches = []) {
  const branchList = Array.isArray(branches) ? branches.filter(Boolean) : [];
  if (!branchList.length || !order) return null;

  const orderCandidates = getOrderBranchCandidates(order).map((value) => String(value || "").trim()).filter(Boolean);
  for (const orderCandidate of orderCandidates) {
    const normalizedOrderCandidate = normalizeBranchMatch(orderCandidate);
    const matched = branchList.find((branch) => {
      const branchCandidates = getBranchCandidates(branch).map((value) => String(value || "").trim()).filter(Boolean);
      return branchCandidates.some((branchCandidate) => {
        const normalizedBranchCandidate = normalizeBranchMatch(branchCandidate);
        return (
          branchCandidate.toLowerCase() === orderCandidate.toLowerCase() ||
          (normalizedOrderCandidate && normalizedBranchCandidate === normalizedOrderCandidate)
        );
      });
    });
    if (matched) return matched;
  }

  for (const orderCandidate of orderCandidates) {
    const matchedAlias = findBranchByAlias(orderCandidate, branchList);
    if (matchedAlias) return matchedAlias;
  }

  return null;
}

export function getCanonicalOrderBranchName(order = {}, branches = []) {
  const matchedBranch = resolveOrderBranch(order, branches);
  return (
    matchedBranch?.name ||
    order.branchName ||
    order.pickupBranchName ||
    order.deliveryBranchName ||
    order.branch?.name ||
    ""
  );
}

export function normalizePartnerSource(source = "") {
  const value = String(source || "").trim().toLowerCase();
  if (["grab", "grab_food", "grabfood"].includes(value)) return "grabfood";
  if (["shopee", "shopee_food", "shopeefood"].includes(value)) return "shopeefood";
  if (["xanh", "xanh_ngon", "xanhngon"].includes(value)) return "xanhngon";
  return value || "partner";
}

export function getPartnerSourceBadge(source = "") {
  const key = resolveOrderSourceKey(source);
  return SOURCE_BADGES[key] || {
    label: "FoodApp",
    className: "border-slate-100 bg-slate-50 text-slate-600"
  };
}

export function resolveOrderSourceKey(orderOrSource = "") {
  if (orderOrSource && typeof orderOrSource === "object") {
    const source = normalizePartnerSource(
      orderOrSource.partnerSource ||
        orderOrSource.source ||
        orderOrSource.orderSource ||
        orderOrSource.channel ||
        orderOrSource.platform ||
        orderOrSource.sourceType ||
        ""
    );
    if (["grabfood", "shopeefood", "xanhngon"].includes(source)) return source;
    if (source === "qr_counter") return "qr_counter";
    if (String(orderOrSource.fulfillmentType || "").toLowerCase() === "pickup") return "pickup";
    return "website";
  }

  const source = normalizePartnerSource(orderOrSource);
  if (["grabfood", "shopeefood", "xanhngon"].includes(source)) return source;
  if (["qr", "qr_counter", "counter"].includes(source)) return "qr_counter";
  if (["pickup", "takeaway", "self_pickup"].includes(source)) return "pickup";
  if (["web", "website", "weborder", "online"].includes(source)) return "website";
  return source || "website";
}

export function getOrderSourceBadge(orderOrSource = "") {
  const key = resolveOrderSourceKey(orderOrSource);
  return SOURCE_BADGES[key] || SOURCE_BADGES.website;
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapPartnerOrderRow(row = {}) {
  const partnerSource = normalizePartnerSource(row.partner_source);
  return {
    id: row.id,
    sourceType: "partner",
    source: partnerSource,
    partnerSource,
    orderCode: row.order_code || "",
    displayOrderCode: row.display_order_code || row.order_code || "",
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    customerPhoneKey: row.customer_phone_key || "",
    branchId: row.branch_id || "",
    branchUuid: row.branch_uuid || "",
    branchName: row.branch_name || row.nexpos_site_name || row.nexpos_hub_name || "",
    totalAmount: toNumber(row.total_amount),
    total: toNumber(row.total_amount),
    pointsBaseAmount: toNumber(row.points_base_amount),
    orderStatus: row.order_status || "",
    nexposStatus: row.nexpos_status || row.raw_data?.status || "",
    kitchenStatus: row.kitchen_status || "",
    pointStatus: row.point_status || "",
    createdAt: row.order_time || row.created_at || "",
    orderTime: row.order_time || row.created_at || "",
    items: Array.isArray(row.items) ? row.items : []
  };
}

function mapPartnerOrderItemRow(row = {}) {
  const options = Array.isArray(row.options) ? row.options.flat(Infinity).filter(Boolean) : [];
  return {
    id: row.id || row.item_key || "",
    cartId: row.item_key || row.id || "",
    name: row.partner_item_name || row.web_product_name || "Món",
    quantity: toNumber(row.quantity) || 1,
    price: toNumber(row.unit_price),
    unitTotal: toNumber(row.unit_price),
    lineTotal: toNumber(row.line_total),
    note: row.note || "",
    toppings: options.map((option) => ({
      name: option?.name || option?.option_item || "",
      price: toNumber(option?.price)
    })).filter((option) => option.name)
  };
}

export async function getPartnerOrdersByPhone(phone, options = {}) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) return [];

  const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) return [];
  const limit = Number(options?.limit || 0);

  let ordersQuery = client
    .from("partner_orders")
    .select(
      "id,order_code,display_order_code,partner_source,branch_id,branch_uuid,branch_name,nexpos_site_name,nexpos_hub_name,customer_name,customer_phone,customer_phone_key,total_amount,points_base_amount,order_status,nexpos_status,kitchen_status,point_status,order_time,created_at"
    )
    .eq("customer_phone_key", phoneKey)
    .order("order_time", { ascending: false });
  if (Number.isFinite(limit) && limit > 0) {
    ordersQuery = ordersQuery.limit(Math.floor(limit));
  }

  const { data, error } = await ordersQuery;

  if (error) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] getPartnerOrdersByPhone failed", error);
    }
    return [];
  }

  const partnerOrders = (data || []).map(mapPartnerOrderRow);
  const orderIds = partnerOrders.map((order) => order.id).filter(Boolean);
  if (!orderIds.length) return partnerOrders;

  const { data: itemRows, error: itemError } = await client
    .from("partner_order_items")
    .select("id,item_key,partner_order_id,partner_item_name,web_product_name,quantity,unit_price,line_total,options,note,item_status")
    .in("partner_order_id", orderIds);

  if (itemError) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] partner_order_items read failed", itemError);
    }
    return partnerOrders;
  }

  const itemsByOrderId = new Map();
  (itemRows || []).forEach((row) => {
    const key = row.partner_order_id;
    const nextItems = itemsByOrderId.get(key) || [];
    nextItems.push(mapPartnerOrderItemRow(row));
    itemsByOrderId.set(key, nextItems);
  });

  return partnerOrders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) || []
  }));
}

export function mergeCustomerLookupOrders(webOrders = [], partnerOrders = []) {
  const normalizedWebOrders = (webOrders || []).map((order) => ({
    ...order,
    sourceType: order.sourceType || "weborder",
    source: order.source || order.orderSource || "weborder",
    partnerSource: order.partnerSource || "weborder"
  }));

  return [...normalizedWebOrders, ...(partnerOrders || [])].sort((first, second) => {
    const firstTime = new Date(first.orderTime || first.createdAt || 0).getTime();
    const secondTime = new Date(second.orderTime || second.createdAt || 0).getTime();
    return secondTime - firstTime;
  });
}

export async function claimPartnerOrderPoints({ orderId = null, orderCode = "", phone = "" } = {}) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }

  const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) {
    return { ok: false, message: "Chưa kết nối được Supabase." };
  }

  const { data, error } = await client.rpc("claim_partner_order_points", {
    p_order_id: orderId || null,
    p_order_code: orderCode || "",
    p_customer_phone: phoneKey
  });

  if (error) {
    if (import.meta?.env?.DEV) {
      console.warn("[partnerOrderService] claimPartnerOrderPoints failed", error);
    }
    return { ok: false, message: error.message || "Không thể cộng điểm lúc này." };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(result?.ok),
    message: result?.message || (result?.ok ? "Cộng điểm thành công." : "Không thể cộng điểm."),
    partnerOrderId: result?.partner_order_id || orderId || null,
    partnerOrderCode: result?.partner_order_code || orderCode || "",
    points: toNumber(result?.points),
    totalPoints: toNumber(result?.total_points)
  };
}
