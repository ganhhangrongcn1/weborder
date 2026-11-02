type Json = Record<string, any>;

// Keep create/read/cancel contracts for older APKs. Only the new cashier action
// saves items and attaches the order inside one authenticated DB transaction.
export async function createPosQrCheckout({ payload, createSession, userClient, serviceClient, reply }: Json) {
  const started = performance.now();
  const input = payload.session || {};
  const pending = payload.pending_order || {};
  const order = pending.order || {};
  if (input.source !== "pos" || !["sepay", "pay2s"].includes(input.provider)
    || order.id !== input.payment_reference || order.branch_uuid !== input.branch_uuid
    || order.total_amount !== input.amount_expected || order.status !== "pending_payment"
    || !Array.isArray(pending.items) || !pending.items.length) {
    return reply({ ok: false, message: "Dữ liệu đơn và phiên QR không khớp." }, 400);
  }
  const createdResponse = await createSession(input);
  const created = await createdResponse.json();
  if (!createdResponse.ok || !created.ok) return reply(created, createdResponse.status);
  const sessionMs = Math.round(performance.now() - started);
  const saved = await userClient.rpc("save_pos_qr_checkout", {
    p_session_id: created.session.id, p_order: order, p_items: pending.items
  }).catch(() => ({ error: { message: "Kết nối bị gián đoạn khi lưu đơn QR." } }));
  if (saved.error || !saved.data?.id) {
    // A returned SQL error rolls back order/items/attach together. Do not cancel
    // after an ambiguous network response: a retry may find a committed order.
    const definitiveSqlError = /^[0-9A-Z]{5}$/.test(String(saved.error?.code || ""));
    if (definitiveSqlError && !created.reused) {
      await serviceClient.from("pos_payment_sessions").update({ status: "cancelled",
        cancelled_at: new Date().toISOString(), failure_reason: "Không lưu được đơn QR" })
        .eq("id", created.session.id).eq("source", "pos").eq("status", "pending_payment");
    }
    console.warn("[pos-qr-checkout] save failed", { code: saved.error?.code || "no_response" });
    return reply({ ok: false, message: saved.error?.message || "Chưa lưu được đơn QR. Giữ bill và thử lại." }, definitiveSqlError ? 409 : 503);
  }
  const totalMs = Math.round(performance.now() - started);
  console.log("[pos-qr-checkout] timing", { sessionMs, saveMs: totalMs - sessionMs, totalMs });
  return reply({ ok: true, session: saved.data, reused: created.reused,
    timing: { session_ms: sessionMs, save_ms: totalMs - sessionMs, total_ms: totalMs } });
}
