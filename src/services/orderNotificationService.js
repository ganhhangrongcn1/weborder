import { initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

export async function notifyWebOrderWebhook({ order } = {}) {
  const orderId = String(order?.id || order?.orderCode || "").trim();
  if (!orderId) return { ok: false, skipped: true, reason: "missing_order_id" };

  const client = await initSupabaseRuntimeClient();
  if (!client?.functions?.invoke) {
    return { ok: false, skipped: true, reason: "supabase_unavailable" };
  }

  const { data, error } = await client.functions.invoke("web-order-notification-api", {
    body: {
      event: "web_order_created",
      order_id: orderId
    }
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || "Không gửi được thông báo đơn website.");
  return data;
}

export default {
  notifyWebOrderWebhook
};
