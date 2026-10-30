import { createClient } from "npm:@supabase/supabase-js@2";
import { PREORDER_WINDOW_CONFIG_KEY, normalizePreorderWindowConfig, getPreorderQueryWindow } from "./preorderWindow.mjs";
import { EVENT_STATUSES, lease, commitOrder, scopedRows, normalizeDetail } from "./eventSync.mjs";
import { dispatchPartnerAutoBills } from "./autoPrint.mjs";

type JsonRecord = Record<string, unknown>;

const BASE_URL = "https://saas-api.nexpos.io/v1";
const CONTROL_KEY = "nexpos_partner_orders";
const SESSION_KEY = "nexpos_master_account";
const PARTNER_AUTOMATION_CONFIG_KEY = "ghr_partner_order_automation";
const DEFAULT_GRAB_PREP_MINUTES = 20;
const PAGE_SIZE = 20;
const MAX_PAGES_PER_HUB = 5;
const SHADOW_HEARTBEAT_MS = 15 * 60 * 1000;
const FAST_POLL_STATUSES = ["DOING"];
const RARE_POLL_STATUSES = ["PRE_ORDER", "DOING", "CANCEL"];
const FULL_POLL_STATUSES = ["PRE_ORDER", "DOING", "PICK", "FINISH", "CANCEL"];
const LATE_RECONCILIATION_STATUSES = ["PICK", "FINISH", "CANCEL"];
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function toText(value: unknown = "") { return String(value ?? "").trim(); }
function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function getArray(value: unknown) { return Array.isArray(value) ? value : []; }
function sameJson(first: unknown, second: unknown) {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}
function normalizeOptions(value: unknown): JsonRecord[] {
  const normalized: JsonRecord[] = [];
  const visit = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    const option = getObject(entry);
    if (Object.keys(option).length > 0) normalized.push(option);
  };
  visit(value);
  return normalized;
}
function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function normalizeGrabAutomationConfig(value: unknown) {
  const config = getObject(value);
  const minutes = Math.min(30, Math.max(1, Math.round(toNumber(
    config.grabPrepMinutes,
    DEFAULT_GRAB_PREP_MINUTES
  ))));
  return {
    enabled: config.grabAutoPrepEnabled !== false,
    prepMinutes: minutes
  };
}
async function readGrabAutomationConfig(client: ReturnType<typeof createClient>) {
  const { data, error } = await client.from("app_configs")
    .select("id,value")
    .in("id", [PARTNER_AUTOMATION_CONFIG_KEY, PREORDER_WINDOW_CONFIG_KEY]);
  if (error) throw new Error(`grab_automation_config:${error.message}`);
  return {
    ...normalizeGrabAutomationConfig(data?.find((row) => row.id === PARTNER_AUTOMATION_CONFIG_KEY)?.value),
    preorderWindow: normalizePreorderWindowConfig(data?.find((row) => row.id === PREORDER_WINDOW_CONFIG_KEY)?.value)
  };
}
function bangkokMinuteOfDay(date = new Date()) {
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + 7 * 60) % (24 * 60);
}
function isActiveTradingWindow(date = new Date()) {
  const minute = bangkokMinuteOfDay(date);
  return minute >= 10 * 60 && minute < 22 * 60 + 30;
}
function isLateReconciliationWindow(date = new Date()) {
  const minute = bangkokMinuteOfDay(date);
  return minute >= 22 * 60 + 30 && minute < 23 * 60 + 30;
}
function normalizeSource(value: unknown) {
  const key = toText(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (["grab", "grabfood", "grab_food"].includes(key)) return "grabfood";
  if (["shopee", "shopeefood", "shopee_food"].includes(key)) return "shopeefood";
  if (["xanhngon", "xanh_ngon"].includes(key)) return "xanhngon";
  return key || "other";
}
function parseCookie(value: string) {
  return value.match(/(?:^|[,;]\s*)(__token=[^;,\s]+)/i)?.[1] || "";
}
function extractRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const root = getObject(payload);
  const data = root.data;
  if (Array.isArray(data)) return data;
  const nested = getObject(data);
  return getArray(
    root.items || root.orders || root.results || root.rows ||
    nested.items || nested.orders || nested.results || nested.rows || nested.data
  );
}
function extractItems(order: JsonRecord) {
  const detail = getObject(order.detail || order.order_detail || order.data);
  return getArray(order.items || order.dishes || order.order_items || detail.items || detail.dishes);
}
function orderIdentity(order: JsonRecord) {
  return toText(order.id || order._id || order.order_uuid || order.orderId);
}
function orderCode(order: JsonRecord) {
  return toText(order.order_id || order.order_code || order.code || order.display_order_code);
}
function normalizedDisplayCode(source: string, rawCode: string) {
  const digits = rawCode.replace(/\D/g, "");
  if (source === "grabfood") {
    const preorderSuffix = /F$/i.test(rawCode) ? "F" : "";
    return `GF-${digits.padStart(3, "0")}${preorderSuffix}`;
  }
  if (source === "shopeefood") return `SF-${digits.slice(-4).padStart(4, "0")}`;
  if (source === "xanhngon") return `XN-${digits.slice(-4).padStart(4, "0")}`;
  return rawCode;
}
function canonicalOrderCode(source: string, rawCode: string, displayCode: string) {
  return source === "grabfood" ? displayCode : rawCode || displayCode;
}
function normalizePhone(value: unknown) {
  const digits = toText(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("84")) return `0${digits.slice(2)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}
function nonnegative(value: unknown) {
  return Math.max(0, toNumber(value, 0));
}
function statusSnapshot(value: unknown) {
  const status = toText(value).toUpperCase();
  if (["PICK", "READY", "READY_TO_PICKUP", "READY_TO_SHIP"].includes(status)) {
    return { order_status: "ready", kitchen_status: "pending" };
  }
  if (["FINISH", "FINISHED", "COMPLETED", "DONE", "SERVED"].includes(status)) {
    return { order_status: "completed", kitchen_status: "served" };
  }
  if (["CANCEL", "CANCELLED", "CANCELED"].includes(status)) {
    return { order_status: "cancelled", kitchen_status: "cancelled" };
  }
  if (["REFUND", "REFUNDED"].includes(status)) {
    return { order_status: "refunded", kitchen_status: "cancelled" };
  }
  if (["PRE_ORDER", "PREORDER", "SCHEDULED"].includes(status)) {
    return { order_status: "new", kitchen_status: "pending" };
  }
  return { order_status: "preparing", kitchen_status: "pending" };
}
function orderStatus(order: JsonRecord) {
  return toText(order.status || order.order_status || order.state);
}
function orderTime(order: JsonRecord) {
  return toText(order.order_time || order.created_at || order.createdAt || order.create_time) || null;
}
function orderTotal(order: JsonRecord) {
  const finance = getObject(order.finance_data || order.financeData);
  return toNumber(order.total ?? order.total_amount ?? finance.original_price, 0);
}
function financeSnapshot(order: JsonRecord) {
  const finance = getObject(order.finance_data || order.financeData);
  return {
    original_price: toNumber(finance.original_price, 0),
    sell_price: toNumber(finance.sell_price, 0),
    gross_received: toNumber(finance.gross_received, 0),
    net_received: toNumber(finance.real_received ?? finance.net_received, 0),
    total_promotion_price: toNumber(finance.total_promotion_price, 0),
    co_fund_promotion_price: toNumber(finance.co_fund_promotion_price, 0),
    other_promotion_price: toNumber(finance.other_promotion_price, 0),
    commission: toNumber(finance.commission, 0),
    commission_tax: toNumber(finance.commission_tax, 0),
    transaction_fee: toNumber(finance.transaction_fee, 0),
    tax: toNumber(finance.tax, 0),
    other_fee: toNumber(finance.other_fee, 0),
    adjustment_fee: toNumber(finance.adjustment_fee, 0),
    additional_income: toNumber(finance.additional_income, 0),
    shipping_discount: toNumber(finance.shipping_discount, 0),
    shipping_fee: toNumber(finance.shipping_fee ?? order.shipment_fee, 0),
    total_shipment: toNumber(finance.total_shipment ?? order.total_shipment, 0)
  };
}
function promotionSnapshot(order: JsonRecord, items: JsonRecord[], finance: ReturnType<typeof financeSnapshot>) {
  const promotions: JsonRecord[] = [];
  const add = (promotionKey: string, promotionType: string, fundingSource: string, amount: number, rawData: unknown) => {
    if (Math.abs(amount) < 1) return;
    promotions.push({ promotion_key: promotionKey, promotion_type: promotionType, funding_source: fundingSource, discount_amount: amount, raw_data: rawData });
  };
  add("finance:total_promotion", "order", "mixed_or_unknown", finance.total_promotion_price, getObject(order.finance_data));
  add("finance:cofund", "order", "platform_cofund", finance.co_fund_promotion_price, getObject(order.finance_data));
  add("finance:other_promotion", "order", "platform_or_campaign", finance.other_promotion_price, getObject(order.finance_data));
  items.forEach((item, index) => {
    add(`item:${index}:discount`, "item", "unknown", toNumber(item.discount, 0), item);
    add(`item:${index}:platform`, "item", "platform", toNumber(item.platform_discount, 0), item);
    add(`item:${index}:seller`, "item", "merchant", toNumber(item.seller_discount, 0), item);
  });
  return promotions;
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value as JsonRecord).sort().reduce((result, key) => {
      result[key] = stableValue((value as JsonRecord)[key]);
      return result;
    }, {} as JsonRecord);
  }
  return value;
}
async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}
async function readCookie(client: ReturnType<typeof createClient>) {
  const { data } = await client.from("integration_sessions")
    .select("session_value,expires_at").eq("integration_key", SESSION_KEY).maybeSingle();
  const expiresAt = new Date(toText(data?.expires_at)).getTime();
  return data?.session_value && expiresAt > Date.now() + 300000 ? toText(data.session_value) : "";
}
async function login(client: ReturnType<typeof createClient>) {
  const username = toText(Deno.env.get("NEXPOS_USERNAME"));
  const password = toText(Deno.env.get("NEXPOS_PASSWORD"));
  if (!username || !password) throw new Error("missing_nexpos_credentials");
  const result = await fetch(`${BASE_URL}/user-service/v2/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-source": "web" },
    body: JSON.stringify({ email: username, password })
  });
  if (!result.ok) throw new Error(`nexpos_login_${result.status}`);
  const cookie = parseCookie(result.headers.get("set-cookie") || "");
  if (!cookie) throw new Error("nexpos_login_missing_cookie");
  const { error } = await client.from("integration_sessions").upsert({
    integration_key: SESSION_KEY,
    session_value: cookie,
    expires_at: new Date(Date.now() + 29 * 86400000).toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "integration_key" });
  if (error) throw new Error(`session_save_failed:${error.message}`);
  return cookie;
}
async function nexposFetch(client: ReturnType<typeof createClient>, url: string, cookieRef: { value: string }) {
  if (!cookieRef.value) cookieRef.value = await readCookie(client) || await login(client);
  let result = await fetch(url, { headers: { Accept: "application/json", Cookie: cookieRef.value }, signal: AbortSignal.timeout(15000) });
  if (result.status === 401) {
    cookieRef.value = await login(client);
    result = await fetch(url, { headers: { Accept: "application/json", Cookie: cookieRef.value }, signal: AbortSignal.timeout(15000) });
  }
  if (!result.ok) throw new Error(`nexpos_list_${result.status}`);
  return result.json();
}
async function nexposPost(
  client: ReturnType<typeof createClient>,
  url: string,
  body: JsonRecord,
  cookieRef: { value: string }
) {
  if (!cookieRef.value) cookieRef.value = await readCookie(client) || await login(client);
  const send = () => fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookieRef.value
    },
    body: JSON.stringify(body)
  });
  let result = await send();
  if (result.status === 401) {
    cookieRef.value = await login(client);
    result = await send();
  }
  return result;
}
function getGrabPrepMetadata(order: JsonRecord) {
  const detail = getObject(order.detail || order.order_detail || order.data);
  const candidates = [
    getObject(order.mex_opt || order.mexOpt),
    getObject(detail.mex_opt || detail.mexOpt)
  ];
  return candidates.find((candidate) => Object.keys(candidate).length > 0) || {};
}
function shouldAutoAdjustGrabPrep(order: JsonRecord, source: string, prepMinutes: number) {
  if (source !== "grabfood") return false;
  if (!["PENDING", "WAITING_CONFIRM", "DOING"].includes(orderStatus(order).toUpperCase())) return false;

  const metadata = getGrabPrepMetadata(order);
  const submittedSeconds = Number(metadata.submitted_opt_in_sec);
  if (Number.isFinite(submittedSeconds) && submittedSeconds >= prepMinutes * 60) return false;
  if (metadata.source_opt !== undefined && Number(metadata.source_opt) !== 0) return false;
  if (metadata.is_editable === false) return false;

  const editableUntil = new Date(toText(metadata.editable_until)).getTime();
  if (Number.isFinite(editableUntil) && editableUntil <= Date.now()) return false;
  const estimatedDoneAt = new Date(toText(metadata.estimated_done_at)).getTime();
  if (Number.isFinite(estimatedDoneAt) && estimatedDoneAt <= Date.now()) return false;
  return true;
}
async function autoAdjustGrabPrepTime(
  client: ReturnType<typeof createClient>,
  order: JsonRecord,
  source: string,
  identity: string,
  cookieRef: { value: string },
  prepMinutes: number
) {
  if (!shouldAutoAdjustGrabPrep(order, source, prepMinutes)) {
    return { attempted: false, adjusted: false, error: "" };
  }

  const result = await nexposPost(
    client,
    `${BASE_URL}/order-service/site/orders/${encodeURIComponent(identity)}/opt`,
    { opt_in_sec: prepMinutes * 60 },
    cookieRef
  );
  if (result.ok) return { attempted: true, adjusted: true, error: "" };

  const detail = toText(await result.text().catch(() => "")).slice(0, 300);
  return {
    attempted: true,
    adjusted: false,
    error: `auto_grab_prep_${result.status}:${detail || "unknown"}`
  };
}
async function createMissingPartnerOrder(
  client: ReturnType<typeof createClient>,
  order: JsonRecord,
  source: string,
  identity: string,
  displayCode: string,
  items: JsonRecord[],
  finance: ReturnType<typeof financeSnapshot>,
  promotions: JsonRecord[],
  payloadHash: string,
  now: string,
  owner: string,
  generation: number | null,
  idEvent = null
) {
  if (items.length === 0) throw new Error(`dual_write_missing_items:${source}:${identity}`);
  const rawCode = orderCode(order);
  const canonicalCode = canonicalOrderCode(source, rawCode, displayCode);
  const financeRaw = getObject(order.finance_data || order.financeData);
  const rawNetReceived = financeRaw.real_received ?? financeRaw.net_received ?? order.total_for_biz;
  const hasNetReceived = rawNetReceived !== undefined && rawNetReceived !== null && toText(rawNetReceived) !== "";
  const netReceived = hasNetReceived ? nonnegative(rawNetReceived) : null;
  const rawGrossReceived = financeRaw.gross_received;
  const totalAmount = rawGrossReceived !== undefined && rawGrossReceived !== null
    ? nonnegative(rawGrossReceived)
    : nonnegative(order.total);
  const totalPromotion = nonnegative(financeRaw.total_promotion_price);
  const discountAmount = totalPromotion > 0
    ? totalPromotion
    : nonnegative(order.total_discount);
  const customerPhone = normalizePhone(order.customer_phone);
  const sourceStatus = orderStatus(order);
  const statuses = statusSnapshot(sourceStatus);
  const orderRow: JsonRecord = {
    order_code: canonicalCode,
    display_order_code: displayCode,
    partner_source: source,
    branch_id: toText(order.site_id || order.nexpos_site_id),
    branch_name: toText(order.site_name || order.nexpos_site_name),
    customer_name: toText(order.customer_name),
    customer_phone: customerPhone,
    customer_phone_key: customerPhone,
    subtotal: nonnegative(financeRaw.original_price ?? order.total),
    discount_amount: discountAmount,
    shipping_fee: nonnegative(financeRaw.shipping_fee ?? order.shipment_fee),
    total_amount: totalAmount,
    points_base_amount: netReceived === null ? 0 : Math.round(netReceived),
    net_received_amount: netReceived,
    loyalty_hold_reason: netReceived === null ? "missing_partner_net_received" : null,
    order_status: statuses.order_status,
    kitchen_status: statuses.kitchen_status,
    kitchen_work_status: "pending",
    point_status: "pending",
    order_time: orderTime(order),
    synced_at: now,
    raw_data: order,
    nexpos_order_id: identity,
    nexpos_hub_id: toText(order.hub_id || order.nexpos_hub_id),
    nexpos_hub_name: toText(order.hub_name || order.nexpos_hub_name),
    nexpos_site_id: toText(order.site_id || order.nexpos_site_id),
    nexpos_site_name: toText(order.site_name || order.nexpos_site_name),
    nexpos_status: sourceStatus,
    ingested_by: "supabase",
    first_ingested_at: now,
    last_nexpos_observed_at: now,
    payload_version: "nexpos-supabase-v1",
    sync_conflict: false,
    nexpos_original_price: finance.original_price,
    nexpos_sell_price: finance.sell_price,
    nexpos_gross_received: finance.gross_received,
    nexpos_net_received: finance.net_received,
    nexpos_total_promotion: finance.total_promotion_price,
    nexpos_cofund_promotion: finance.co_fund_promotion_price,
    nexpos_other_promotion: finance.other_promotion_price,
    nexpos_commission: finance.commission,
    nexpos_commission_tax: finance.commission_tax,
    nexpos_transaction_fee: finance.transaction_fee,
    nexpos_tax: finance.tax,
    nexpos_other_fee: finance.other_fee,
    nexpos_adjustment_fee: finance.adjustment_fee,
    nexpos_additional_income: finance.additional_income,
    nexpos_shipping_discount: finance.shipping_discount,
    nexpos_finance_data: finance,
    nexpos_promotion_data: promotions,
    nexpos_enrichment_hash: payloadHash
  };
  const itemRows = items.map((item, index) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const originalLineTotal = nonnegative(item.price);
    const discountedLineTotal = nonnegative(item.discount_price ?? item.price);
    const originalUnitPrice = originalLineTotal / quantity;
    const discountedUnitPrice = discountedLineTotal / quantity;
    return {
      order_code: canonicalCode,
      display_order_code: displayCode,
      partner_source: source,
      branch_id: toText(order.site_id || order.nexpos_site_id),
      partner_item_id: toText(item.item_id || item.model_id),
      partner_item_sku: toText(item.code),
      partner_item_name: toText(item.name) || `Món ${index + 1}`,
      web_product_name: "",
      quantity,
      unit_price: originalUnitPrice,
      line_total: discountedLineTotal,
      options: normalizeOptions(item.options),
      note: toText(item.note),
      item_status: "pending",
      kitchen_item_status: "pending",
      nexpos_hub_id: toText(order.hub_id || order.nexpos_hub_id),
      nexpos_site_id: toText(order.site_id || order.nexpos_site_id),
      item_key: `${canonicalCode}-${index}`,
      line_index: index,
      original_unit_price: originalUnitPrice,
      discounted_unit_price: discountedUnitPrice,
      item_discount_amount: nonnegative(item.discount),
      platform_discount_amount: nonnegative(item.platform_discount),
      seller_discount_amount: nonnegative(item.seller_discount),
      promotion_data: {
        discount: nonnegative(item.discount),
        discount_price: nonnegative(item.discount_price),
        platform_discount: nonnegative(item.platform_discount),
        seller_discount: nonnegative(item.seller_discount),
        is_gift: Boolean(item.is_gift)
      }
    };
  });
  const result = await commitOrder(client, {
    p_owner: owner, p_order: orderRow, p_items: itemRows, p_promotions: promotions,
    p_existing_id: null, p_expected_hash: null, p_observed_at: now, p_generation: generation
  }, idEvent);
  const inserted = result.row;
  if (customerPhone) {
    await client.rpc("upsert_customer_stub_profile", {
      p_phone: customerPhone,
      p_name: toText(order.customer_name),
      p_source: source,
      p_source_ref: toText(inserted.id)
    });
  }
  return { row: inserted as JsonRecord, created: result.created };
}
function buildDifferences(shadow: JsonRecord, existing: JsonRecord | undefined) {
  if (!existing) return ["missing_in_n8n"];
  const differences: string[] = [];
  if (toText(existing.display_order_code || existing.order_code) !== toText(shadow.display_order_code)) differences.push("order_code");
  if (toText(existing.nexpos_status).toLowerCase() !== toText(shadow.nexpos_status).toLowerCase()) differences.push("nexpos_status");
  if (toText(existing.nexpos_hub_id) !== toText(shadow.nexpos_hub_id)) differences.push("hub_id");
  if (toText(existing.nexpos_site_id || existing.branch_id) !== toText(shadow.nexpos_site_id)) differences.push("site_id");
  if (Math.abs(toNumber(existing.total_amount) - toNumber(shadow.total_amount)) >= 1) differences.push("total_amount");
  return differences;
}
function buildBusinessDifferences(shadow: JsonRecord, existing: JsonRecord | undefined) {
  if (!existing) return ["missing_in_n8n"];
  const differences: string[] = [];
  if (toText(existing.display_order_code || existing.order_code) !== toText(shadow.normalized_display_order_code)) differences.push("display_order_code");
  if (toText(existing.nexpos_hub_id) !== toText(shadow.nexpos_hub_id)) differences.push("hub_id");
  if (toText(existing.nexpos_site_id || existing.branch_id) !== toText(shadow.nexpos_site_id)) differences.push("site_id");
  return differences;
}

Deno.serve(async (request) => {
  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) return response({ ok: false, error: "missing_supabase_env" }, 500);
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: control } = await client.from("nexpos_shadow_sync_control").select("*").eq("control_key", CONTROL_KEY).maybeSingle();
  const syncMode = toText(control?.mode);
  if (!control || !["compare_only", "dual_write"].includes(syncMode)) {
    return response({ ok: true, skipped: true, reason: "disabled" });
  }
  if (toText(request.headers.get("x-cron-secret")) !== toText(control.cron_secret)) return response({ ok: false }, 401);
  const eventOnly = request.headers.get("x-nexpos-event-wake") === "1";
  const tradingWindow = isActiveTradingWindow();
  const lateReconciliationWindow = isLateReconciliationWindow();
  if (!tradingWindow && !lateReconciliationWindow) {
    return response({ ok: true, skipped: true, reason: "outside_polling_hours" });
  }
  if (control.locked_until && new Date(control.locked_until).getTime() > Date.now()) return response({ ok: true, skipped: true, reason: "locked" });

  const startedAt = new Date().toISOString();
  const lastFullSweepAt = new Date(toText(control.last_full_sweep_at)).getTime();
  const lastRareSweepAt = new Date(toText(control.last_rare_sweep_at)).getTime();
  const fullSweepDue = !Number.isFinite(lastFullSweepAt) || Date.now() - lastFullSweepAt >= 5 * 60 * 1000;
  if (!eventOnly && lateReconciliationWindow && !fullSweepDue) {
    return response({ ok: true, skipped: true, reason: "late_reconciliation_not_due" });
  }
  const isFullStatusSweep = tradingWindow && fullSweepDue;
  const isRareStatusSweep = isFullStatusSweep
    || !Number.isFinite(lastRareSweepAt)
    || Date.now() - lastRareSweepAt >= 60 * 1000;
  const owner = crypto.randomUUID();
  if (!await lease(client, owner, "acquire")) return response({ ok: true, skipped: true, reason: "lock_race" });

  const { data: run } = await client.from("nexpos_shadow_sync_runs").insert({ started_at: startedAt }).select("id").single();
  const runId = toText(run?.id);
  let requestCount = 0;
  try {
    const [{ data: hubRows, error: hubError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
      client.from("nexpos_shadow_hubs").select("nexpos_hub_id").eq("enabled", true),
      client.from("nexpos_event_workers").select("worker_id,hub_ids,id_sync_enabled")
        .eq("enabled", true).eq("sync_enabled", true).gt("expires_at", startedAt)
    ]);
    if (hubError) throw hubError;
    let hubIds = Array.from(new Set((hubRows || []).map((row) => toText(row.nexpos_hub_id)).filter(Boolean)));
    if (enrollmentError) throw enrollmentError;
    const eventAllowed = new Set(syncMode === "dual_write" ? (enrollments || []).flatMap(row => row.hub_ids || []) : []);
    const { data: pending, error: pendingError } = await client.from("nexpos_event_pending")
      .select("hub_id,generation,completed_generation").in("hub_id", hubIds);
    if (pendingError) throw pendingError;
    const work = new Map((pending || []).filter(row => eventAllowed.has(row.hub_id)
      && row.generation > row.completed_generation).map(row => [row.hub_id, row.generation]));
    const idWorkers = new Set((enrollments || []).filter(row => row.id_sync_enabled).map(row => row.worker_id));
    const { data: idPending, error: idPendingError } = await client.from("nexpos_order_event_pending")
      .select("hub_id,order_id,generation,worker_id,received_at").in("hub_id", hubIds)
      .in("worker_id", [...idWorkers]).eq("pending", true).lte("retry_at", startedAt).order("signaled_at").limit(8);
    if (idPendingError) throw idPendingError;
    const idRows = (idPending || []).filter(row => idWorkers.has(row.worker_id) && eventAllowed.has(row.hub_id));
    const idWork = new Map(idRows.map(row => [row.hub_id + ':' + row.order_id, row]));
    const fallbackHubs = new Set();
    const idFailures = new Set();
    if (eventOnly) hubIds = hubIds.filter(id => work.has(id) || idRows.some(row => row.hub_id === id));
    const cookieRef = { value: "" };
    const grabAutomationConfig = await readGrabAutomationConfig(client);
    const observed: JsonRecord[] = [];
    const pollStatuses = lateReconciliationWindow
      ? LATE_RECONCILIATION_STATUSES
      : isFullStatusSweep
        ? FULL_POLL_STATUSES
        : isRareStatusSweep
          ? RARE_POLL_STATUSES
          : FAST_POLL_STATUSES;
    const from = new Date(Date.now() - 6 * 3600000).toISOString();
    const to = new Date(Date.now() + 3600000).toISOString();

    const sourceStartedAt = Date.now();
    const setupMs = sourceStartedAt - new Date(startedAt).getTime();
    for (const target of idRows) {
      await lease(client, owner, "renew");
      try {
        const payload = getObject(await nexposFetch(client,
          `${BASE_URL}/order-service/site/orders/${encodeURIComponent(target.order_id)}`, cookieRef));
        requestCount += 1;
        observed.push(normalizeDetail(getObject(payload.data), target.order_id, target.hub_id));
      } catch {
        idFailures.add(target.hub_id + ':' + target.order_id);
        fallbackHubs.add(target.hub_id);
        // Keep the durable ID pending without preventing polling for other HUBs.
        await client.from("nexpos_order_event_pending").update({ retry_at: new Date(Date.now() + 30000).toISOString() })
          .eq("hub_id", target.hub_id).eq("order_id", target.order_id).eq("generation", target.generation);
      }
    }
    for (const hubId of hubIds) {
      if (eventOnly && !work.has(hubId) && !fallbackHubs.has(hubId)) continue;
      const statuses = work.has(hubId) || fallbackHubs.has(hubId) ? EVENT_STATUSES : pollStatuses;
      for (const status of statuses) {
        for (let page = 1; page <= MAX_PAGES_PER_HUB; page += 1) {
          const queryWindow = getPreorderQueryWindow({
            status, hubId, config: grabAutomationConfig.preorderWindow, fallback: { from, to }
          });
          const params = new URLSearchParams({
            status, from: queryWindow.from, to: queryWindow.to, filter_type: "hub", hub_ids: hubId,
            "table[page]": String(page), "table[items_per_page]": String(PAGE_SIZE)
          });
          await lease(client, owner, "renew");
          const payload = await nexposFetch(client, `${BASE_URL}/order-service/site/orders?${params}`, cookieRef);
          requestCount += 1;
          const rows = extractRows(payload).map(getObject).filter((row) => orderIdentity(row));
          observed.push(...scopedRows(rows, hubId));
          if (work.has(hubId) && rows.length === PAGE_SIZE && page === MAX_PAGES_PER_HUB) throw new Error("sync_page_limit");
          if (rows.length < PAGE_SIZE) break;
        }
      }
    }

    if (work.size) {
      // A scheduled order can move to CANCEL/PICK outside the old list time window.
      // Recheck known preorders by stable source ID, using the verified detail GET.
      const { data: tracked, error: trackedError } = await client.from("partner_orders")
        .select("nexpos_order_id,nexpos_hub_id").in("nexpos_hub_id", [...work.keys()])
        .eq("nexpos_status", "PRE_ORDER").limit(21);
      if (trackedError) throw trackedError;
      if ((tracked || []).length > 20) throw new Error("sync_tracked_preorder_limit");
      const seen = new Set(observed.map(orderIdentity));
      for (const prior of tracked || []) {
        if (seen.has(prior.nexpos_order_id)) continue;
        await lease(client, owner, "renew");
        const payload = getObject(await nexposFetch(client,
          `${BASE_URL}/order-service/site/orders/${encodeURIComponent(prior.nexpos_order_id)}`, cookieRef));
        requestCount += 1;
        const detail = normalizeDetail(getObject(payload.data), prior.nexpos_order_id, prior.nexpos_hub_id);
        observed.push(detail);
      }
    }

    const sourceFetchMs = Date.now() - sourceStartedAt;
    const snapshotStartedAt = Date.now();
    const uniqueObserved = [...new Map(observed.map(order => [
      toText(order.hub_id || order.nexpos_hub_id) + ':' + orderIdentity(order), order
    ])).values()];
    const identities = uniqueObserved.map(orderIdentity);
    const [existingResult, shadowResult] = identities.length ? await Promise.all([client.from("partner_orders")
      .select("id,partner_source,nexpos_order_id,order_code,display_order_code,nexpos_status,nexpos_hub_id,nexpos_site_id,branch_id,total_amount,ingested_by,payload_version,nexpos_enrichment_hash")
      .in("nexpos_order_id", identities), client.from("nexpos_shadow_orders")
      .select("partner_source,nexpos_order_id,payload_hash,comparison_status,comparison_differences,business_comparison_status,business_comparison_differences,matched_partner_order_id,last_seen_at,raw_data")
      .in("nexpos_order_id", identities)]) : [{ data: [], error: null }, { data: [], error: null }];
    if (existingResult.error || shadowResult.error) throw new Error("sync_snapshot_read_failed");
    const existingRows = existingResult.data;
    const shadowRows = shadowResult.data;
    const existingMap = new Map((existingRows || []).map((row) => [`${toText(row.partner_source)}:${toText(row.nexpos_order_id)}`, row]));
    const shadowMap = new Map((shadowRows || []).map((row) => [
      `${toText(row.partner_source)}:${toText(row.nexpos_order_id)}`,
      row
    ]));

    const snapshotReadMs = Date.now() - snapshotStartedAt;
    const processingStartedAt = Date.now();
    const autoBill = { claimed: 0, enqueued: 0, failed: 0 };
    const drainAutoBills = async () => {
      try {
        const result = await dispatchPartnerAutoBills(client, owner);
        autoBill.claimed += result.claimed;
        autoBill.enqueued += result.enqueued;
        autoBill.failed += result.failed;
      } catch { autoBill.failed += 1; }
    };
    let matchedCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;
    let createdCount = 0;
    let shadowWriteSkippedCount = 0;
    let autoPrepAttemptCount = 0;
    let autoPrepAdjustedCount = 0;
    const autoPrepErrors: string[] = [];
    const autoPrepAttemptedOrderIds = new Set<string>();
    const now = startedAt;
    for (const order of uniqueObserved) {
      await lease(client, owner, "renew");
      const source = normalizeSource(order.source || order.partner_source || order.platform);
      const identity = orderIdentity(order);
      const idEvent = idWork.get(toText(order.hub_id || order.nexpos_hub_id) + ":" + identity) || null;
      const previousShadowRow = shadowMap.get(`${source}:${identity}`);
      const previousShadow = getObject(previousShadowRow?.raw_data);
      const previouslyAppliedMinutes = toNumber(previousShadow.__ghr_auto_prep_minutes, 0);
      if (previouslyAppliedMinutes > 0) {
        order.__ghr_auto_prep_minutes = previouslyAppliedMinutes;
        order.__ghr_auto_prep_applied_at = previousShadow.__ghr_auto_prep_applied_at || "";
      }
      if (!autoPrepAttemptedOrderIds.has(identity) && previouslyAppliedMinutes !== grabAutomationConfig.prepMinutes) {
        autoPrepAttemptedOrderIds.add(identity);
        const autoPrepResult = grabAutomationConfig.enabled
          ? await autoAdjustGrabPrepTime(
              client,
              order,
              source,
              identity,
              cookieRef,
              grabAutomationConfig.prepMinutes
            )
          : { attempted: false, adjusted: false, error: "" };
        if (autoPrepResult.attempted) autoPrepAttemptCount += 1;
        if (autoPrepResult.adjusted) {
          autoPrepAdjustedCount += 1;
          order.__ghr_auto_prep_minutes = grabAutomationConfig.prepMinutes;
          order.__ghr_auto_prep_applied_at = now;
        }
        if (autoPrepResult.error) autoPrepErrors.push(`${identity}:${autoPrepResult.error}`);
      }
      const items = extractItems(order);
      const finance = financeSnapshot(order);
      const promotions = promotionSnapshot(order, items.map(getObject), finance);
      const normalizedCode = normalizedDisplayCode(source, orderCode(order));
      const payloadHash = await sha256(order);
      const shadow: JsonRecord = {
        partner_source: source,
        nexpos_order_id: identity,
        display_order_code: orderCode(order),
        normalized_display_order_code: normalizedCode,
        nexpos_status: orderStatus(order),
        nexpos_hub_id: toText(order.hub_id || order.nexpos_hub_id),
        nexpos_site_id: toText(order.site_id || order.nexpos_site_id),
        order_time: orderTime(order),
        total_amount: orderTotal(order),
        item_count: items.length,
        payload_hash: payloadHash,
        raw_data: order,
        normalized_data: { finance, promotions, items },
        last_seen_at: now,
        updated_at: now
      };
      const existing = existingMap.get(`${source}:${identity}`);
      const differences = buildDifferences(shadow, existing);
      const comparisonStatus = !existing ? "missing_in_n8n" : differences.length ? "mismatch" : "matched";
      const businessDifferences = buildBusinessDifferences(shadow, existing);
      const businessComparisonStatus = !existing ? "missing_in_n8n" : businessDifferences.length ? "mismatch" : "matched";
      if (comparisonStatus === "matched") matchedCount += 1;
      else if (comparisonStatus === "mismatch") mismatchCount += 1;
      else missingCount += 1;
      Object.assign(shadow, {
        comparison_status: comparisonStatus,
        comparison_differences: differences,
        business_comparison_status: businessComparisonStatus,
        business_comparison_differences: businessDifferences,
        matched_partner_order_id: existing?.id || null,
        last_compared_at: now
      });
      let effectiveExisting = existing;
      let createdThisOrder = false;
      if (!existing && syncMode === "dual_write") {
        const ingestResult = await createMissingPartnerOrder(
          client, order, source, identity, normalizedCode, items.map(getObject),
          finance, promotions, payloadHash, now, owner, work.get(toText(order.hub_id || order.nexpos_hub_id)) ?? null, idEvent
        );
        effectiveExisting = ingestResult.row;
        createdThisOrder = ingestResult.created;
        existingMap.set(`${source}:${identity}`, ingestResult.row);
        shadow.matched_partner_order_id = ingestResult.row.id;
        if (ingestResult.created) createdCount += 1;
      }
      const previousSeenAt = new Date(toText(previousShadowRow?.last_seen_at)).getTime();
      const shadowContentUnchanged = Boolean(previousShadowRow)
        && toText(previousShadowRow.payload_hash) === payloadHash
        && toText(previousShadowRow.comparison_status) === comparisonStatus
        && toText(previousShadowRow.business_comparison_status) === businessComparisonStatus
        && toText(previousShadowRow.matched_partner_order_id) === toText(shadow.matched_partner_order_id)
        && sameJson(previousShadowRow.comparison_differences, differences)
        && sameJson(previousShadowRow.business_comparison_differences, businessDifferences);
      const shadowHeartbeatDue = !Number.isFinite(previousSeenAt)
        || Date.now() - previousSeenAt >= SHADOW_HEARTBEAT_MS;

      if (!shadowContentUnchanged) {
        const { error } = await client.from("nexpos_shadow_orders").upsert(shadow, {
          onConflict: "partner_source,nexpos_order_id"
        });
        if (error) throw error;
      } else if (shadowHeartbeatDue) {
        const { error } = await client.from("nexpos_shadow_orders").update({
          last_seen_at: now,
          last_compared_at: now,
          updated_at: now
        }).eq("partner_source", source).eq("nexpos_order_id", identity);
        if (error) throw error;
      } else {
        shadowWriteSkippedCount += 1;
      }

      if (effectiveExisting?.id && toText(effectiveExisting.nexpos_enrichment_hash) !== payloadHash) {
        const enrichmentUpdate: JsonRecord = {
          last_nexpos_observed_at: now,
          payload_version: toText(effectiveExisting.ingested_by) === "supabase"
            ? "nexpos-supabase-v1"
            : "n8n-v1+nexpos-shadow-v2",
          sync_conflict: businessComparisonStatus === "mismatch",
          nexpos_original_price: finance.original_price,
          nexpos_sell_price: finance.sell_price,
          nexpos_gross_received: finance.gross_received,
          nexpos_net_received: finance.net_received,
          nexpos_total_promotion: finance.total_promotion_price,
          nexpos_cofund_promotion: finance.co_fund_promotion_price,
          nexpos_other_promotion: finance.other_promotion_price,
          nexpos_commission: finance.commission,
          nexpos_commission_tax: finance.commission_tax,
          nexpos_transaction_fee: finance.transaction_fee,
          nexpos_tax: finance.tax,
          nexpos_other_fee: finance.other_fee,
          nexpos_adjustment_fee: finance.adjustment_fee,
          nexpos_additional_income: finance.additional_income,
          nexpos_shipping_discount: finance.shipping_discount,
          nexpos_finance_data: finance,
          nexpos_promotion_data: promotions
        };
        if (syncMode === "dual_write") {
          const statuses = statusSnapshot(orderStatus(order));
          Object.assign(enrichmentUpdate, {
            nexpos_status: orderStatus(order),
            order_status: statuses.order_status,
            kitchen_status: statuses.kitchen_status,
            raw_data: order,
            synced_at: now
          });
        }
        const { data: partnerItems, error: partnerItemsError } = await client.from("partner_order_items")
          .select("id,line_index").eq("partner_order_id", effectiveExisting.id);
        if (partnerItemsError) throw partnerItemsError;
        if (items.length > 0 && (partnerItems || []).length < items.length) throw new Error("sync_item_count_mismatch");

        const itemPatches: JsonRecord[] = [];
        const itemRowByIndex = new Map((partnerItems || []).map((item) => [toNumber(item.line_index, -1), item]));
        for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
          const item = getObject(items[itemIndex]);
          const partnerItem = itemRowByIndex.get(itemIndex);
          if (!partnerItem?.id) throw new Error("sync_item_index_missing");
          const quantity = Math.max(1, toNumber(item.quantity, 1));
          const originalLineTotal = nonnegative(item.price);
          const discountedLineTotal = nonnegative(item.discount_price ?? item.price);
          const originalUnitPrice = originalLineTotal / quantity;
          const discountedUnitPrice = discountedLineTotal / quantity;
          itemPatches.push({
            id: partnerItem.id,
            quantity,
            unit_price: originalUnitPrice,
            line_total: discountedLineTotal,
            original_unit_price: originalUnitPrice,
            discounted_unit_price: discountedUnitPrice,
            item_discount_amount: toNumber(item.discount, 0),
            platform_discount_amount: toNumber(item.platform_discount, 0),
            seller_discount_amount: toNumber(item.seller_discount, 0),
            promotion_data: {
              discount: toNumber(item.discount, 0),
              discount_price: toNumber(item.discount_price, 0),
              platform_discount: toNumber(item.platform_discount, 0),
              seller_discount: toNumber(item.seller_discount, 0),
              is_gift: Boolean(item.is_gift)
            }
          });
        }

        await commitOrder(client, {
          p_owner: owner, p_order: { ...enrichmentUpdate, nexpos_enrichment_hash: payloadHash },
          p_items: itemPatches, p_promotions: promotions, p_existing_id: effectiveExisting.id,
          p_expected_hash: effectiveExisting.nexpos_enrichment_hash || null, p_observed_at: startedAt,
          p_generation: work.get(toText(order.hub_id || order.nexpos_hub_id)) ?? null
        }, idEvent);
      } else if (!createdThisOrder && effectiveExisting?.id && (idEvent || work.has(toText(order.hub_id || order.nexpos_hub_id)))) {
        // Record a verified unchanged REST snapshot without rewriting business fields.
        await commitOrder(client, {
          p_owner: owner, p_order: { nexpos_enrichment_hash: payloadHash }, p_items: [], p_promotions: [],
          p_existing_id: effectiveExisting.id, p_expected_hash: payloadHash, p_observed_at: startedAt,
          p_generation: work.get(toText(order.hub_id || order.nexpos_hub_id)) ?? null
        }, idEvent);
      }
      // New eligible orders do not wait for the rest of the HUB batch to finish.
      if (createdThisOrder || (effectiveExisting?.nexpos_status === "PRE_ORDER"
        && ["DOING", "PICK"].includes(orderStatus(order)))) await drainAutoBills();
    }

    await lease(client, owner, "renew");
    for (const [hubId, generation] of work) {
      const { error: ackError } = await client.from("nexpos_event_pending").update({
        completed_generation: generation, completed_at: new Date().toISOString(), last_run_id: runId
      }).eq("hub_id", hubId).lt("completed_generation", generation);
      if (ackError) throw ackError;
    }
    for (const target of idRows) {
      if (!uniqueObserved.some(order => orderIdentity(order) === target.order_id
        && toText(order.hub_id || order.nexpos_hub_id) === target.hub_id)) continue;
      const { error: idAckError } = await client.from("nexpos_order_event_pending").update({
        completed_generation: target.generation, pending: false, completed_at: new Date().toISOString()
      }).eq("hub_id", target.hub_id).eq("order_id", target.order_id).eq("generation", target.generation);
      if (idAckError) throw idAckError;
    }
    // Printing failures never roll back accepted orders or block source polling.
    await drainAutoBills();
    const finishedAt = new Date().toISOString();
    await client.from("nexpos_shadow_sync_runs").update({
      finished_at: finishedAt, status: "success", hub_count: hubIds.length,
      request_count: requestCount, observed_count: observed.length,
      matched_count: matchedCount, mismatch_count: mismatchCount, missing_count: missingCount,
      metadata: {
        auto_bill: autoBill,
        timings_ms: { setup: setupMs, source_fetch: sourceFetchMs, snapshot_read: snapshotReadMs,
          processing_and_ack: Date.now() - processingStartedAt },
        id_event_count: idRows.length,
        id_fetch_failure_count: idFailures.size,
        id_only: eventOnly && work.size === 0 && fallbackHubs.size === 0,
        event_generations: Object.fromEntries(work),
        trigger: eventOnly ? "wss" : "polling",
        poll_type: lateReconciliationWindow
          ? "late_reconciliation"
          : isFullStatusSweep
            ? "full"
            : isRareStatusSweep
              ? "rare"
              : "fast",
        statuses: pollStatuses,
        sync_mode: syncMode,
        created_count: createdCount,
        shadow_write_skipped_count: shadowWriteSkippedCount,
        auto_grab_prep_enabled: grabAutomationConfig.enabled,
        auto_grab_prep_minutes: grabAutomationConfig.prepMinutes,
        auto_prep_attempt_count: autoPrepAttemptCount,
        auto_prep_adjusted_count: autoPrepAdjustedCount,
        auto_prep_errors: autoPrepErrors.slice(0, 20)
      }
    }).eq("id", runId);
    const controlUpdate: JsonRecord = {
      last_finished_at: finishedAt, last_success_at: finishedAt,
      consecutive_failures: 0, last_error: null, updated_at: finishedAt
    };
    if (!eventOnly && (isFullStatusSweep || lateReconciliationWindow)) controlUpdate.last_full_sweep_at = finishedAt;
    if (!eventOnly && isRareStatusSweep) controlUpdate.last_rare_sweep_at = finishedAt;
    await client.from("nexpos_shadow_sync_control").update(controlUpdate).eq("control_key", CONTROL_KEY).eq("lock_owner", owner);
    return response({
      ok: true, observed: observed.length, matched: matchedCount,
      mismatch: mismatchCount, missing: missingCount, created: createdCount,
      shadow_write_skipped: shadowWriteSkippedCount,
      auto_prep_attempted: autoPrepAttemptCount,
      auto_prep_adjusted: autoPrepAdjustedCount
    });
  } catch (error) {
    const message = toText(error instanceof Error ? error.message : error).slice(0, 500);
    const finishedAt = new Date().toISOString();
    await client.from("nexpos_shadow_sync_runs").update({
      finished_at: finishedAt, status: "failed", request_count: requestCount, error_message: message
    }).eq("id", runId);
    await client.from("nexpos_shadow_sync_control").update({
      last_finished_at: finishedAt,
      consecutive_failures: toNumber(control.consecutive_failures) + 1,
      last_error: message, updated_at: finishedAt
    }).eq("control_key", CONTROL_KEY).eq("lock_owner", owner);
    return response({ ok: false, error: message }, 500);
  } finally {
    await lease(client, owner, "release").catch(() => {});
  }
});
