import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8"
};

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

async function requireStaff(
  request: Request,
  serviceClient: ReturnType<typeof createClient>
) {
  const authorization = toText(request.headers.get("Authorization"));
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "missing_access_token", profile: null };

  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  const authUserId = toText(authData?.user?.id);
  if (authError || !authUserId) {
    return { error: "invalid_access_token", profile: null };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id,auth_user_id,email,role,status,branch_uuid")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "profile_not_found", profile: null };
  }

  const role = toText(profile.role).toLowerCase();
  const status = toText(profile.status).toLowerCase();
  if (status !== "active") {
    return { error: "profile_not_active", profile: null };
  }
  if (!["admin", "staff", "kitchen"].includes(role)) {
    return { error: "staff_access_required", profile: null };
  }

  return { error: "", profile };
}

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ ok: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ ok: false, message: "Missing Supabase env." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const access = await requireStaff(request, serviceClient);
  if (access.error || !access.profile) {
    return response({ ok: false, message: "Unauthorized." }, 401);
  }

  const body = getObject(await request.json().catch(() => ({})));
  const limit = Math.max(1, Math.min(30, Number(body.limit || 10) || 10));
  const contains = toText(body.contains).toUpperCase();

  const { data, error } = await serviceClient
    .from("sepay_webhook_logs")
    .select("webhook_code,transfer_amount,matched_order_id,matched_payment_session_id,processed_result,raw_payload,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return response({ ok: false, message: error.message || "Cannot read logs." }, 500);
  }

  const rows = (Array.isArray(data) ? data : []).map((row) => {
    const payload = getObject(row.raw_payload);
    return {
      webhookCode: toText(row.webhook_code),
      transferAmount: row.transfer_amount,
      matchedOrderId: toText(row.matched_order_id),
      matchedPaymentSessionId: toText(row.matched_payment_session_id),
      processedResult: toText(row.processed_result),
      createdAt: toText(row.created_at),
      content: toText(payload.content),
      description: toText(payload.description),
      referenceCode: toText(payload.referenceCode),
      accountNumber: toText(payload.accountNumber)
    };
  });

  const filtered = contains
    ? rows.filter((row) =>
        [
          row.webhookCode,
          row.matchedOrderId,
          row.matchedPaymentSessionId,
          row.processedResult,
          row.content,
          row.description,
          row.referenceCode
        ].some((value) => toText(value).toUpperCase().includes(contains))
      )
    : rows;

  return response({
    ok: true,
    profile: access.profile,
    rows: filtered
  });
});
