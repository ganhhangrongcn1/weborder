import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const BASE_URL = "https://saas-api.nexpos.io/v1";
const CONTROL_KEY = "nexpos_partner_orders";
const SESSION_KEY = "nexpos_master_account";
const PAGE_SIZE = 20;
const MAX_PAGES_PER_HUB = 5;
const LOCK_SECONDS = 55;
const FAST_POLL_STATUSES = ["PRE_ORDER", "DOING", "CANCEL"];
const FULL_POLL_STATUSES = ["PRE_ORDER", "DOING", "PICK", "FINISH", "CANCEL"];
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
function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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
  if (source === "grabfood") return `GF-${digits.slice(-3).padStart(3, "0")}`;
  if (source === "shopeefood") return `SF-${digits.slice(-4).padStart(4, "0")}`;
  if (source === "xanhngon") return `XN-${digits.slice(-4).padStart(4, "0")}`;
  return rawCode;
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
  let result = await fetch(url, { headers: { Accept: "application/json", Cookie: cookieRef.value } });
  if (result.status === 401) {
    cookieRef.value = await login(client);
    result = await fetch(url, { headers: { Accept: "application/json", Cookie: cookieRef.value } });
  }
  if (!result.ok) throw new Error(`nexpos_list_${result.status}`);
  return result.json();
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
  if (!control || toText(control.mode) !== "compare_only") return response({ ok: true, skipped: true, reason: "disabled" });
  if (toText(request.headers.get("x-cron-secret")) !== toText(control.cron_secret)) return response({ ok: false }, 401);
  if (control.locked_until && new Date(control.locked_until).getTime() > Date.now()) return response({ ok: true, skipped: true, reason: "locked" });

  const startedAt = new Date().toISOString();
  const { data: locked } = await client.from("nexpos_shadow_sync_control").update({
    locked_until: new Date(Date.now() + LOCK_SECONDS * 1000).toISOString(),
    last_started_at: startedAt,
    updated_at: startedAt
  }).eq("control_key", CONTROL_KEY).or(`locked_until.is.null,locked_until.lt.${startedAt}`).select("control_key").maybeSingle();
  if (!locked) return response({ ok: true, skipped: true, reason: "lock_race" });

  const { data: run } = await client.from("nexpos_shadow_sync_runs").insert({ started_at: startedAt }).select("id").single();
  const runId = toText(run?.id);
  let requestCount = 0;
  try {
    const { data: hubRows, error: hubError } = await client.from("nexpos_shadow_hubs")
      .select("nexpos_hub_id").eq("enabled", true);
    if (hubError) throw hubError;
    const hubIds = Array.from(new Set((hubRows || []).map((row) => toText(row.nexpos_hub_id)).filter(Boolean)));
    const cookieRef = { value: "" };
    const observed: JsonRecord[] = [];
    const isFullStatusSweep = new Date().getUTCMinutes() % 5 === 0;
    const pollStatuses = isFullStatusSweep ? FULL_POLL_STATUSES : FAST_POLL_STATUSES;
    const from = new Date(Date.now() - 6 * 3600000).toISOString();
    const to = new Date(Date.now() + 3600000).toISOString();

    for (const hubId of hubIds) {
      for (const status of pollStatuses) {
        for (let page = 1; page <= MAX_PAGES_PER_HUB; page += 1) {
          const params = new URLSearchParams({
            status, from, to, filter_type: "hub", hub_ids: hubId,
            "table[page]": String(page), "table[items_per_page]": String(PAGE_SIZE)
          });
          const payload = await nexposFetch(client, `${BASE_URL}/order-service/site/orders?${params}`, cookieRef);
          requestCount += 1;
          const rows = extractRows(payload).map(getObject).filter((row) => orderIdentity(row));
          observed.push(...rows);
          if (rows.length < PAGE_SIZE) break;
        }
      }
    }

    const identities = observed.map(orderIdentity);
    const { data: existingRows } = identities.length ? await client.from("partner_orders")
      .select("id,partner_source,nexpos_order_id,order_code,display_order_code,nexpos_status,nexpos_hub_id,nexpos_site_id,branch_id,total_amount,payload_version,nexpos_enrichment_hash")
      .in("nexpos_order_id", identities) : { data: [] };
    const existingMap = new Map((existingRows || []).map((row) => [`${toText(row.partner_source)}:${toText(row.nexpos_order_id)}`, row]));

    let matchedCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;
    const now = new Date().toISOString();
    for (const order of observed) {
      const source = normalizeSource(order.source || order.partner_source || order.platform);
      const identity = orderIdentity(order);
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
      const { error } = await client.from("nexpos_shadow_orders").upsert(shadow, {
        onConflict: "partner_source,nexpos_order_id"
      });
      if (error) throw error;

      if (existing?.id && toText(existing.nexpos_enrichment_hash) !== payloadHash) {
        const { error: enrichmentError } = await client.from("partner_orders").update({
          last_nexpos_observed_at: now,
          payload_version: "n8n-v1+nexpos-shadow-v2",
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
        }).eq("id", existing.id);
        if (enrichmentError) throw enrichmentError;

        for (const promotion of promotions) {
          const { error: promotionError } = await client.from("partner_order_promotions").upsert({
            partner_order_id: existing.id,
            ...promotion,
            updated_at: now
          }, { onConflict: "partner_order_id,promotion_key" });
          if (promotionError) throw promotionError;
        }

        const { data: partnerItems, error: partnerItemsError } = await client.from("partner_order_items")
          .select("id,line_index").eq("partner_order_id", existing.id);
        if (partnerItemsError) throw partnerItemsError;
        if (items.length > 0 && (partnerItems || []).length < items.length) continue;

        const itemRowByIndex = new Map((partnerItems || []).map((item) => [toNumber(item.line_index, -1), item]));
        for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
          const item = getObject(items[itemIndex]);
          const partnerItem = itemRowByIndex.get(itemIndex);
          if (!partnerItem?.id) continue;
          const { error: itemError } = await client.from("partner_order_items").update({
            original_unit_price: toNumber(item.price, 0),
            discounted_unit_price: toNumber(item.discount_price, 0),
            item_discount_amount: toNumber(item.discount, 0),
            platform_discount_amount: toNumber(item.platform_discount, 0),
            seller_discount_amount: toNumber(item.seller_discount, 0),
            promotion_data: {
              discount: toNumber(item.discount, 0),
              discount_price: toNumber(item.discount_price, 0),
              platform_discount: toNumber(item.platform_discount, 0),
              seller_discount: toNumber(item.seller_discount, 0),
              is_gift: Boolean(item.is_gift)
            },
            updated_at: now
          }).eq("id", partnerItem.id);
          if (itemError) throw itemError;
        }

        const { error: hashError } = await client.from("partner_orders").update({
          nexpos_enrichment_hash: payloadHash
        }).eq("id", existing.id);
        if (hashError) throw hashError;
      }
    }

    const finishedAt = new Date().toISOString();
    await client.from("nexpos_shadow_sync_runs").update({
      finished_at: finishedAt, status: "success", hub_count: hubIds.length,
      request_count: requestCount, observed_count: observed.length,
      matched_count: matchedCount, mismatch_count: mismatchCount, missing_count: missingCount
    }).eq("id", runId);
    await client.from("nexpos_shadow_sync_control").update({
      locked_until: null, last_finished_at: finishedAt, last_success_at: finishedAt,
      consecutive_failures: 0, last_error: null, updated_at: finishedAt
    }).eq("control_key", CONTROL_KEY);
    return response({ ok: true, observed: observed.length, matched: matchedCount, mismatch: mismatchCount, missing: missingCount });
  } catch (error) {
    const message = toText(error instanceof Error ? error.message : error).slice(0, 500);
    const finishedAt = new Date().toISOString();
    await client.from("nexpos_shadow_sync_runs").update({
      finished_at: finishedAt, status: "failed", request_count: requestCount, error_message: message
    }).eq("id", runId);
    await client.from("nexpos_shadow_sync_control").update({
      locked_until: null, last_finished_at: finishedAt,
      consecutive_failures: toNumber(control.consecutive_failures) + 1,
      last_error: message, updated_at: finishedAt
    }).eq("control_key", CONTROL_KEY);
    return response({ ok: false, error: message }, 500);
  }
});
