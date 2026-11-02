import { loadBankTransferRoute } from "./bankTransferRouting.js";
type Json = Record<string, any>;

export async function createPosQrCheckout({ payload, profile, serviceClient, reply, resolveRoute = loadBankTransferRoute }: Json) {
  const started = performance.now();
  const input = payload.session || {};
  const pending = payload.pending_order || {};
  const order = pending.order || {};
  if (input.source !== "pos" || !["sepay", "pay2s"].includes(input.provider)
    || input.bank_account_snapshot !== true || order.id !== input.payment_reference
    || order.branch_uuid !== input.branch_uuid || order.total_amount !== input.amount_expected
    || order.status !== "pending_payment" || !Array.isArray(pending.items) || !pending.items.length) {
    return reply({ ok: false, message: "Dữ liệu đơn và phiên QR không khớp." }, 400);
  }
  let route;
  try { route = await resolveRoute(serviceClient, input.branch_uuid, input.customer_phone, input.provider); }
  catch { return reply({ ok: false, message: "Chưa đọc được cấu hình nhận tiền. Giữ bill và thử lại." }, 503); }
  const routeMs = Math.round(performance.now() - started);
  const saved = await serviceClient.rpc("create_pos_bank_checkout", {
    p_actor: profile.auth_user_id,
    p_session: { ...input, provider: route.provider, provider_payload: route.providerPayload },
    p_order: order, p_items: pending.items
  }).catch(() => ({ error: { message: "Kết nối bị gián đoạn khi lưu đơn QR." } }));
  if (saved.error || !saved.data?.session?.id) {
    console.warn("[pos-qr-checkout] atomic save failed", { code: saved.error?.code || "no_response" });
    return reply({ ok: false, message: saved.error?.message || "Chưa lưu được đơn QR. Giữ bill và thử lại." },
      /^[0-9A-Z]{5}$/.test(String(saved.error?.code || "")) ? 409 : 503);
  }
  const totalMs = Math.round(performance.now() - started);
  console.log("[pos-qr-checkout] timing", { routeMs, transactionMs: totalMs - routeMs, totalMs });
  return reply({ ok: true, session: saved.data.session, reused: saved.data.reused,
    timing: { route_ms: routeMs, transaction_ms: totalMs - routeMs, total_ms: totalMs } });
}
