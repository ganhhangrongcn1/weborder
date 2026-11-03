import { createClient } from "npm:@supabase/supabase-js@2";
import { parsePay2sTransaction, verifyPay2sToken } from "../_shared/pay2sPayload.js";
import { markOrderPaidFromPaymentSession } from "../_shared/bankTransferSettlement.ts";
import { settlePaidPosOrderLoyalty } from "../_shared/posPaidOrderLoyalty.ts";
import { notifyPaidWebsiteOrder } from "../_shared/webOrderPaidNotification.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8" }
});

export async function handlePay2sWebhook(request: Request) {
  if (request.method !== "POST") return json({ success: false, reason: "method_not_allowed" }, 405);
  const token = Deno.env.get("PAY2S_WEBHOOK_TOKEN");
  if (!token) return json({ success: false, reason: "pay2s_not_configured" }, 503);
  if (!await verifyPay2sToken(request.headers.get("Authorization"), token)) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.transactions) || !body.transactions.length || body.transactions.length > 100) {
    return json({ success: false, reason: "invalid_transactions" }, 400);
  }
  let transactions;
  try {
    transactions = body.transactions.map(parsePay2sTransaction);
  } catch {
    return json({ success: false, reason: "invalid_transaction" }, 400);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ success: false, reason: "missing_server_configuration" }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const results = [];
  for (const transaction of transactions) {
    try {
      const { data, error } = await client.rpc("receive_pay2s_transaction", { p_transaction: transaction });
      if (error) throw error;
      if (data.reason === "transaction_conflict") throw new Error("transaction_conflict");
      if (data.session && !data.complete) {
        const session = data.session;
        if (data.syncOrder && session.order_id) {
          const result = await markOrderPaidFromPaymentSession(client, session, {
            provider: "pay2s", transferAmount: transaction.amount,
            transactionTime: transaction.transactionDate, providerTransactionId: transaction.id,
            payload: transaction.raw
          });
          if (!result.ok || !["created", "already_exists"].includes(String(result.printJob?.reason))) {
            throw new Error(result.reason || "print_job_not_persisted");
          }
          const orderResult = await client.from("orders").select("id,customer_phone,promo_code,metadata").eq("id", session.order_id).single();
          if (orderResult.error) throw orderResult.error;
          await settlePaidPosOrderLoyalty(client, orderResult.data);
          if (["web", "online", "website", "qr_order"].includes(String(session.source).toLowerCase())) {
            try {
              await notifyPaidWebsiteOrder(client, { id: session.order_id }, {
                paymentConfirmed: true, messageOnly: true
              });
            } catch {
              // Notification ledger records the failure; never undo a durable payment.
              console.error("[pay2s-payment-webhook] website Zalo notification failed", session.order_id);
            }
          }
        }
        const { error: completeError } = await client.from("pay2s_webhook_receipts")
          .update({ completed_at: new Date().toISOString(), result: "processed" }).eq("transaction_id", transaction.id);
        if (completeError) throw completeError;
      }
      results.push({ id: transaction.id, reason: data.reason, complete: true });
    } catch (error) {
      // Never ACK an unpersisted payment or failed downstream work; Pay2S can retry the batch.
      console.error("[pay2s-payment-webhook] processing failed", transaction.id, error instanceof Error ? error.message : "database_error");
      return json({ success: false, reason: "processing_failed", transactionId: transaction.id }, 500);
    }
  }
  return json({ success: true, results });
}

Deno.serve(handlePay2sWebhook);
