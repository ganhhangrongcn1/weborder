import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyWebsiteOrder } from "../_shared/webOrderPaidNotification.ts";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed." }, 405);

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, message: "Thiếu cấu hình Supabase Function." }, 500);
  }

  const payload = getObject(await request.json().catch(() => ({})));
  const orderId = toText(payload.order_id || payload.orderId);
  const event = toText(payload.event);
  if (!orderId) return jsonResponse({ ok: false, message: "Thiếu mã đơn website." }, 400);
  if (event !== "web_order_created") {
    return jsonResponse({ ok: false, message: "Loại thông báo không hợp lệ." }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const result = await notifyWebsiteOrder(serviceClient, { id: orderId }, {
      event: "web_order_created"
    });
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được thông báo đơn website.";
    console.error("[web-order-notification-api] notification failed", message);
    return jsonResponse({ ok: false, message }, 502);
  }
});
