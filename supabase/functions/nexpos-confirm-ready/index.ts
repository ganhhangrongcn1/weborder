import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const NEXPOS_BASE_URL = "https://saas-api.nexpos.io/v1";
const SESSION_KEY = "nexpos_master_account";
const ALLOWED_ROLES = new Set(["admin", "staff", "kitchen"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function sanitizeError(value: unknown) {
  return toText(value).slice(0, 500) || "Không xác nhận được đơn với NexPOS.";
}

function parseCookie(setCookie: string) {
  const match = setCookie.match(/(?:^|[,;]\s*)(__token=[^;,\s]+)/i);
  return match?.[1] || "";
}

async function requireKitchenAccess(request: Request, serviceClient: ReturnType<typeof createClient>) {
  const token = toText(request.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return { profile: null, error: "Phiên đăng nhập Kitchen không hợp lệ." };

  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  const authUserId = toText(authData?.user?.id);
  if (authError || !authUserId) return { profile: null, error: "Phiên đăng nhập Kitchen đã hết hạn." };

  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id,role,status,branch_uuid")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !profile) return { profile: null, error: "Không tìm thấy tài khoản Kitchen." };
  if (toText(profile.status).toLowerCase() !== "active") return { profile: null, error: "Tài khoản Kitchen đang bị khóa." };
  if (!ALLOWED_ROLES.has(toText(profile.role).toLowerCase())) return { profile: null, error: "Tài khoản không có quyền cập nhật đơn." };
  return { profile, error: "" };
}

async function readCachedCookie(serviceClient: ReturnType<typeof createClient>) {
  const { data } = await serviceClient
    .from("integration_sessions")
    .select("session_value,expires_at")
    .eq("integration_key", SESSION_KEY)
    .maybeSingle();

  if (!data?.session_value) return "";
  const expiresAt = new Date(toText(data.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5 * 60 * 1000) return "";
  return toText(data.session_value);
}

async function loginNexpos(serviceClient: ReturnType<typeof createClient>) {
  const username = toText(Deno.env.get("NEXPOS_USERNAME"));
  const password = toText(Deno.env.get("NEXPOS_PASSWORD"));
  if (!username || !password) throw new Error("Chưa cấu hình tài khoản tổng NexPOS trong Supabase Secrets.");

  const loginResponse = await fetch(`${NEXPOS_BASE_URL}/user-service/v2/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-source": "web"
    },
    body: JSON.stringify({ email: username, password })
  });

  if (!loginResponse.ok) throw new Error(`NexPOS từ chối đăng nhập (${loginResponse.status}).`);
  const cookie = parseCookie(loginResponse.headers.get("set-cookie") || "");
  if (!cookie) throw new Error("NexPOS không trả về phiên đăng nhập hợp lệ.");

  const expiresAt = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await serviceClient.from("integration_sessions").upsert({
    integration_key: SESSION_KEY,
    session_value: cookie,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }, { onConflict: "integration_key" });
  if (error) throw new Error("Không lưu được phiên đăng nhập NexPOS.");
  return cookie;
}

async function confirmReady(nexposOrderId: string, cookie: string) {
  return fetch(`${NEXPOS_BASE_URL}/order-service/site/orders/${encodeURIComponent(nexposOrderId)}/confirm`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({})
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ ok: false, message: "Method không được hỗ trợ." }, 405);

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) return response({ ok: false, message: "Thiếu cấu hình máy chủ Supabase." }, 500);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const access = await requireKitchenAccess(request, serviceClient);
  if (!access.profile) return response({ ok: false, message: access.error }, 403);

  const body = getObject(await request.json().catch(() => ({})));
  const partnerOrderId = toText(body.partner_order_id || body.partnerOrderId);
  if (!partnerOrderId) return response({ ok: false, message: "Thiếu mã đơn đối tác." }, 400);

  const { data: order, error: orderError } = await serviceClient
    .from("partner_orders")
    .select("id,partner_source,nexpos_order_id,nexpos_status,branch_uuid,kitchen_work_status,nexpos_ready_sync_status,nexpos_ready_sync_attempts")
    .eq("id", partnerOrderId)
    .maybeSingle();
  if (orderError || !order) return response({ ok: false, message: "Không tìm thấy đơn đối tác." }, 404);

  const profileBranchUuid = toText(access.profile.branch_uuid);
  if (profileBranchUuid && profileBranchUuid !== toText(order.branch_uuid)) {
    return response({ ok: false, message: "Đơn không thuộc chi nhánh của tài khoản Kitchen." }, 403);
  }

  const nexposOrderId = toText(order.nexpos_order_id);
  if (!nexposOrderId) return response({ ok: false, message: "Đơn chưa có mã nội bộ NexPOS." }, 422);

  const partnerSource = toText(order.partner_source).toLowerCase();
  if (!["grab", "grabfood"].includes(partnerSource)) {
    const completedAt = new Date().toISOString();
    const { error: localDoneError } = await serviceClient.from("partner_orders").update({
      kitchen_work_status: "done",
      kitchen_done_at: completedAt,
      updated_at: completedAt
    }).eq("id", partnerOrderId);

    if (localDoneError) return response({ ok: false, message: "Không cập nhật được trạng thái Kitchen." }, 500);
    return response({ ok: true, synced: false, message: "Kitchen đã ghi nhận xong đơn đối tác." });
  }

  if (toText(order.nexpos_ready_sync_status) === "success") {
    return response({ ok: true, already_synced: true, message: "Đơn đã được báo sẵn sàng sang NexPOS trước đó." });
  }

  const now = new Date().toISOString();
  const { error: pendingError } = await serviceClient.from("partner_orders").update({
    kitchen_work_status: "done",
    kitchen_done_at: now,
    nexpos_ready_sync_status: "pending",
    nexpos_ready_sync_error: null,
    nexpos_ready_sync_attempts: Number(getObject(order).nexpos_ready_sync_attempts || 0) + 1,
    updated_at: now
  }).eq("id", partnerOrderId);
  if (pendingError) return response({ ok: false, message: "Không cập nhật được trạng thái Kitchen." }, 500);

  try {
    let cookie = await readCachedCookie(serviceClient);
    if (!cookie) cookie = await loginNexpos(serviceClient);
    let nexposResponse = await confirmReady(nexposOrderId, cookie);

    if (nexposResponse.status === 401) {
      cookie = await loginNexpos(serviceClient);
      nexposResponse = await confirmReady(nexposOrderId, cookie);
    }

    if (!nexposResponse.ok) {
      const responseText = sanitizeError(await nexposResponse.text().catch(() => ""));
      const isAlreadyReady = nexposResponse.status === 400
        && responseText.includes("order_not_confirmable")
        && toText(order.nexpos_status).toUpperCase() === "PICK";

      if (isAlreadyReady) {
        const syncedAt = new Date().toISOString();
        await serviceClient.from("partner_orders").update({
          nexpos_ready_sync_status: "success",
          nexpos_ready_synced_at: syncedAt,
          nexpos_ready_sync_error: null,
          updated_at: syncedAt
        }).eq("id", partnerOrderId);

        return response({
          ok: true,
          already_synced: true,
          message: "Đơn đã ở trạng thái sẵn sàng trên NexPOS/Grab."
        });
      }

      throw new Error(`NexPOS trả về ${nexposResponse.status}: ${responseText}`);
    }

    await serviceClient.from("partner_orders").update({
      nexpos_ready_sync_status: "success",
      nexpos_ready_synced_at: new Date().toISOString(),
      nexpos_ready_sync_error: null,
      updated_at: new Date().toISOString()
    }).eq("id", partnerOrderId);

    return response({ ok: true, synced: true, message: "Đã báo đơn sẵn sàng sang NexPOS/Grab." });
  } catch (error) {
    const message = sanitizeError(error instanceof Error ? error.message : error);
    await serviceClient.from("partner_orders").update({
      nexpos_ready_sync_status: "failed",
      nexpos_ready_sync_error: message,
      updated_at: new Date().toISOString()
    }).eq("id", partnerOrderId);

    return response({
      ok: true,
      synced: false,
      warning: `Kitchen đã ghi nhận xong đơn nhưng chưa báo được sang NexPOS: ${message}`,
      message: "Kitchen đã ghi nhận xong đơn."
    });
  }
});
