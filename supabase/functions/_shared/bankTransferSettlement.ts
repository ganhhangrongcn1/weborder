import { createClient } from "npm:@supabase/supabase-js@2";
import { type JsonRecord, toText, toNumber, getObject } from "./bankTransferUtils.ts";
import { ensureCustomerBillPrintJob } from "./bankTransferPrint.ts";

const ORDER_COLUMNS = [
  "id",
  "order_code",
  "customer_phone",
  "customer_name",
  "fulfillment_type",
  "payment_method",
  "status",
  "subtotal",
  "shipping_fee",
  "promo_discount",
  "promo_code",
  "points_discount",
  "shipping_support_discount",
  "total_amount",
  "branch_uuid",
  "branch_name",
  "pickup_branch_uuid",
  "pos_shift_id",
  "branch_address",
  "metadata",
  "created_at",
  "updated_at",
  "kitchen_status"
].join(",");

async function findActivePosShift(
  supabase: ReturnType<typeof createClient>,
  branchUuid = ""
) {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return null;

  const { data, error } = await supabase
    .from("pos_shifts")
    .select("id,branch_uuid,status,opened_at")
    .eq("branch_uuid", safeBranchUuid)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[sepay-pos-webhook] active shift lookup failed", error.message);
    return null;
  }

  return data || null;
}

export async function markOrderPaidFromPaymentSession(
  supabase: ReturnType<typeof createClient>,
  session: JsonRecord,
  options: {
    transferAmount: number;
    transactionTime: string;
    providerTransactionId: string;
    payload: JsonRecord;
    provider?: string;
  }
) {
  const orderId = toText(session.order_id);
  if (!orderId) {
    return { ok: true, updated: false, reason: "session_without_order" };
  }

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();

  if (readError || !order) {
    return {
      ok: false,
      updated: false,
      reason: readError?.message || "order_not_found"
    };
  }

  const metadata = getObject(order.metadata);
  if (metadata.deviceMode === "phone") {
    if (["cancelled", "canceled", "expired"].includes(toText(order.status).toLowerCase())) return { ok: false, updated: false, reason: "phone_order_cancelled" };
    if (toText(order.branch_uuid) !== toText(session.branch_uuid) || toNumber(order.total_amount) !== options.transferAmount) return { ok: false, updated: false, reason: "phone_order_payment_mismatch" };
    if (toText(metadata.paymentStatus).toLowerCase() === "paid" && (toText(order.payment_method) !== "bank_qr" || toText(metadata.paymentReference) !== toText(session.payment_reference))) return { ok: false, updated: false, reason: "phone_order_already_collected" };
  }
  const alreadyPaid = toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";
  const branchUuid = toText(session.branch_uuid || order.pickup_branch_uuid || order.branch_uuid);
  const activeShift = await findActivePosShift(supabase, branchUuid);
  const posShiftId = toText(
    session.pos_shift_id ||
    order.pos_shift_id ||
    metadata.posShiftId ||
    metadata.pos_shift_id ||
    activeShift?.id
  );
  const paymentReference = toText(session.payment_reference);
  const shiftMetadata = posShiftId
    ? {
        posShiftId,
        pos_shift_id: posShiftId
      }
    : {};

  if (posShiftId && toText(session.pos_shift_id) !== posShiftId) {
    await supabase
      .from("pos_payment_sessions")
      .update({
        pos_shift_id: posShiftId,
        updated_at: new Date().toISOString()
      })
      .eq("id", toText(session.id));
    session.pos_shift_id = posShiftId;
  }

  if (!alreadyPaid) {
    const nextMetadata = {
      ...metadata,
      ...shiftMetadata,
      status: "preparing",
      orderStatus: "preparing",
      kitchenStatus: "pending",
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: options.transferAmount,
      paymentReference,
      qrPaymentSessionId: toText(session.id),
      paidAt: options.transactionTime,
      paymentProvider: options.provider || "sepay",
      [options.provider === "pay2s" ? "pay2sWebhook" : "sepayWebhook"]: {
        id: options.payload.id ?? null,
        gateway: toText(options.payload.gateway),
        accountNumber: toText(options.payload.accountNumber),
        transactionDate: options.transactionTime,
        code: toText(options.payload.code),
        content: toText(options.payload.content),
        referenceCode: toText(options.payload.referenceCode),
        transferAmount: options.transferAmount,
        providerTransactionId: options.providerTransactionId
      }
    };
    const orderPatch: JsonRecord = {
      status: "preparing",
      kitchen_status: "pending",
      payment_method: "bank_qr",
      updated_at: new Date().toISOString(),
      metadata: nextMetadata
    };
    if (posShiftId) orderPatch.pos_shift_id = posShiftId;

    const { error: updateError } = await supabase
      .from("orders")
      .update(orderPatch)
      .eq("id", orderId);

    if (updateError) {
      return {
        ok: false,
        updated: false,
        reason: updateError.message || "order_update_failed"
      };
    }

    order.status = "preparing";
    order.kitchen_status = "pending";
    order.payment_method = "bank_qr";
    order.metadata = nextMetadata;
    if (posShiftId) order.pos_shift_id = posShiftId;
  } else if (posShiftId && (
    toText(order.pos_shift_id) !== posShiftId ||
    toText(metadata.posShiftId || metadata.pos_shift_id) !== posShiftId
  )) {
    const nextMetadata = {
      ...metadata,
      ...shiftMetadata,
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: options.transferAmount || metadata.paymentAmount || metadata.payment_amount,
      paymentReference: paymentReference || metadata.paymentReference || metadata.payment_reference,
      qrPaymentSessionId: toText(session.id) || metadata.qrPaymentSessionId,
      paidAt: options.transactionTime || metadata.paidAt || metadata.paid_at,
      paymentProvider: metadata.paymentProvider || options.provider || "sepay"
    };
    const { error: backfillError } = await supabase
      .from("orders")
      .update({
        pos_shift_id: posShiftId,
        metadata: nextMetadata,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (backfillError) {
      return {
        ok: false,
        updated: false,
        reason: backfillError.message || "order_shift_backfill_failed"
      };
    }

    order.pos_shift_id = posShiftId;
    order.metadata = nextMetadata;
  }

  const printJob = await ensureCustomerBillPrintJob(supabase, order);
  const now = new Date().toISOString();
  const sessionPatch: JsonRecord = {
    status: "converted",
    order_id: orderId,
    converted_at: now,
    updated_at: now
  };
  if (posShiftId) sessionPatch.pos_shift_id = posShiftId;
  await supabase
    .from("pos_payment_sessions")
    .update(sessionPatch)
    .eq("id", toText(session.id))
    .in("status", ["paid", "converting", "converted"]);

  return {
    ok: true,
    updated: !alreadyPaid,
    reason: alreadyPaid
      ? posShiftId
        ? "already_paid_shift_synced"
        : "already_paid"
      : "paid_and_sent_to_kitchen",
    printJob
  };
}

