import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function toMoney(value: unknown = 0) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function jsonResponse(body: JsonRecord, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signHmacSha256(rawData: string, secretKey: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(rawData)));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyMomoSignature(body: JsonRecord, accessKey: string, secretKey: string) {
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${toText(body.amount)}`,
    `extraData=${toText(body.extraData)}`,
    `message=${toText(body.message)}`,
    `orderId=${toText(body.orderId)}`,
    `orderInfo=${toText(body.orderInfo)}`,
    `orderType=${toText(body.orderType)}`,
    `partnerCode=${toText(body.partnerCode)}`,
    `payType=${toText(body.payType)}`,
    `requestId=${toText(body.requestId)}`,
    `responseTime=${toText(body.responseTime)}`,
    `resultCode=${toText(body.resultCode)}`,
    `transId=${toText(body.transId)}`
  ].join("&");
  const expected = await signHmacSha256(rawSignature, secretKey);
  return safeEqual(expected.toLowerCase(), toText(body.signature).toLowerCase());
}

async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  body: JsonRecord,
  processedResult: string,
  sessionId = "",
  orderId = ""
) {
  const { error } = await supabase.from("momo_webhook_logs").insert({
    momo_order_id: toText(body.orderId),
    request_id: toText(body.requestId),
    transaction_id: toText(body.transId) || null,
    result_code: Number(body.resultCode ?? -1),
    amount: toMoney(body.amount),
    payment_option: toText(body.paymentOption),
    raw_payload: body,
    matched_payment_session_id: sessionId || null,
    matched_order_id: orderId || null,
    processed_result: processedResult
  });
  if (error) console.error("[momo-payment-webhook] log failed", error.message);
}

function formatReceiptMoney(value: unknown) {
  return `${toMoney(value).toLocaleString("vi-VN")}d`;
}

function buildReceiptText(order: JsonRecord) {
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:HOA DON BAN HANG",
    `@@BIG:${toText(order.displayOrderCode || order.orderCode || order.id || "GHR")}`,
    "------------------------------------------",
    `Chi nhanh: ${toText(order.branchName) || "Ganh Hang Rong"}`,
    "Thu ngan: QR tai quay",
    "@@SPACE",
    "Thanh toan: Vi MoMo - DA THANH TOAN",
    "------------------------------------------"
  ];
  for (const item of items) {
    const safeItem = getObject(item);
    const quantity = Math.max(1, Math.floor(Number(safeItem.quantity || 1)));
    lines.push(`@@BOLDROW:${quantity} x ${toText(safeItem.name || safeItem.productName || "Mon")}\t`);
    const options = Array.isArray(safeItem.options) ? safeItem.options : [];
    for (const option of options) {
      const optionText = typeof option === "string" ? option : toText(getObject(option).name);
      if (optionText) lines.push(`  + ${optionText}`);
    }
    if (toText(safeItem.note)) lines.push(`  Ghi chu: ${toText(safeItem.note)}`);
  }
  lines.push("------------------------------------------");
  lines.push(`@@ROW:TONG DON\t${formatReceiptMoney(order.totalAmount)}`);
  lines.push(`@@BOLDROW:DA THANH TOAN MOMO\t${formatReceiptMoney(order.totalAmount)}`);
  lines.push("@@BOLDROW:CON PHAI THU\t0d");
  lines.push("@@CENTER:*** KHONG THU THEM TIEN ***");
  lines.push(`Ma TT: ${toText(order.paymentReference)}`);
  lines.push("------------------------------------------");
  return lines.join("\n");
}

function buildPreparationTicketText(order: JsonRecord) {
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:PHIẾU LÀM MÓN",
    `@@BIG:${toText(order.displayOrderCode || order.orderCode || order.id || "GHR")}`,
    "------------------------------------------",
    `Chi nhanh: ${toText(order.branchName) || "Ganh Hang Rong"}`,
    "Nguon: Website - MoMo",
    "------------------------------------------"
  ];
  for (const item of items) {
    const safeItem = getObject(item);
    const quantity = Math.max(1, Math.floor(Number(safeItem.quantity || 1)));
    lines.push(`@@BOLDROW:${quantity} x ${toText(safeItem.name || safeItem.productName || "Mon")}\t`);
    const options = Array.isArray(safeItem.options) ? safeItem.options : [];
    for (const option of options) {
      const optionText = typeof option === "string" ? option : toText(getObject(option).name);
      if (optionText) lines.push(`  + ${optionText}`);
    }
    if (toText(safeItem.note)) lines.push(`  Ghi chu: ${toText(safeItem.note)}`);
    lines.push("@@SPACE");
  }
  if (toText(order.note || order.orderNote)) {
    lines.push("------------------------------------------");
    lines.push(`Ghi chu don: ${toText(order.note || order.orderNote)}`);
  }
  lines.push("------------------------------------------");
  lines.push("@@CENTER:KIEM TRA DU MON - TOPPING - GHI CHU");
  return lines.join("\n");
}

async function ensurePrintJob(supabase: ReturnType<typeof createClient>, order: JsonRecord) {
  const orderId = toText(order.id);
  const orderCode = toText(order.order_code || order.id);
  if (!orderId || !orderCode) return;

  const metadata = getObject(order.metadata);
  const now = new Date().toISOString();
  const printOrder = {
    ...metadata,
    id: orderId,
    orderCode,
    displayOrderCode: toText(metadata.displayOrderCode || metadata.display_order_code || orderCode),
    customerName: toText(order.customer_name || metadata.customerName),
    customerPhone: toText(order.customer_phone || metadata.customerPhone),
    branchName: toText(order.branch_name || order.pickup_branch_name || metadata.branchName),
    totalAmount: toMoney(order.total_amount || metadata.totalAmount),
    paymentMethod: "momo",
    paymentReference: toText(metadata.paymentReference || metadata.payment_reference),
    paidAt: toText(metadata.paidAt || metadata.paid_at)
  };

  const branchUuid = toText(order.pickup_branch_uuid || order.branch_uuid) || null;
  const sourceType = "qr_order_bundle";
  const { data: existing } = await supabase
    .from("print_jobs")
    .select("id")
    .eq("job_type", "customer_bill")
    .eq("order_id", orderId)
    .eq("source_type", sourceType)
    .in("status", ["pending", "printing", "printed"])
    .limit(1);
  if (Array.isArray(existing) && existing[0]?.id) return;

  const { error } = await supabase.from("print_jobs").insert({
    branch_uuid: branchUuid,
    printer_key: "cashier-80mm",
    job_type: "customer_bill",
    status: "pending",
    order_id: orderId,
    order_code: printOrder.displayOrderCode,
    source_type: sourceType,
    payload: {
      type: sourceType,
      sourceType,
      text: buildPreparationTicketText(printOrder),
      secondaryText: buildReceiptText(printOrder),
      order: printOrder
    },
    requested_by: "momo_webhook",
    requested_at: now,
    created_at: now,
    updated_at: now
  });
  if (error) console.error("[momo-payment-webhook] bundled print job failed", error.message);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed." }, 405);

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const partnerCode = toText(Deno.env.get("MOMO_PARTNER_CODE"));
  const accessKey = toText(Deno.env.get("MOMO_ACCESS_KEY"));
  const secretKey = toText(Deno.env.get("MOMO_SECRET_KEY"));
  if (!supabaseUrl || !serviceRoleKey || !partnerCode || !accessKey || !secretKey) {
    return jsonResponse({ ok: false, message: "Thiếu cấu hình máy chủ." }, 500);
  }

  const body = getObject(await request.json().catch(() => ({})));
  if (!toText(body.orderId) || !toText(body.signature) || toText(body.partnerCode) !== partnerCode) {
    return jsonResponse({ ok: false, message: "Thông báo MoMo không hợp lệ." }, 400);
  }
  if (!(await verifyMomoSignature(body, accessKey, secretKey))) {
    return jsonResponse({ ok: false, message: "Chữ ký MoMo không hợp lệ." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: session, error: sessionError } = await supabase
    .from("pos_payment_sessions")
    .select("*")
    .eq("provider", "momo")
    .eq("payment_reference", toText(body.orderId))
    .maybeSingle();
  if (sessionError || !session) {
    await logWebhook(supabase, body, "session_not_found");
    return jsonResponse({ ok: false, message: "Không tìm thấy phiên thanh toán." }, 404);
  }

  const sessionId = toText(session.id);
  const orderId = toText(session.order_id);
  const expectedAmount = toMoney(session.amount_expected);
  const paidAmount = toMoney(body.amount);
  const safeIpnResult = {
    transactionId: toText(body.transId),
    resultCode: Number(body.resultCode ?? -1),
    message: toText(body.message),
    paymentOption: toText(body.paymentOption),
    payType: toText(body.payType),
    responseTime: Number(body.responseTime || 0)
  };
  if (expectedAmount !== paidAmount) {
    await logWebhook(supabase, body, "amount_mismatch", sessionId, orderId);
    return jsonResponse({ ok: false, message: "Số tiền thanh toán không khớp." }, 409);
  }

  if (Number(body.resultCode) !== 0) {
    const now = new Date().toISOString();
    await supabase.from("pos_payment_sessions").update({
      status: "failed",
      failure_reason: toText(body.message) || `MoMo resultCode ${toText(body.resultCode)}`,
      provider_payload: { ...getObject(session.provider_payload), lastResult: safeIpnResult },
      cancelled_at: now,
      updated_at: now
    }).eq("id", sessionId).neq("status", "converted");
    if (orderId) {
      const { data: failedOrder } = await supabase
        .from("orders")
        .select("id,metadata")
        .eq("id", orderId)
        .maybeSingle();
      const failedMetadata = getObject(failedOrder?.metadata);
      if (failedOrder && toText(failedMetadata.paymentStatus || failedMetadata.payment_status).toLowerCase() !== "paid") {
        await supabase.from("orders").update({
          status: "cancelled",
          kitchen_status: "pending",
          payment_method: "momo",
          metadata: {
            ...failedMetadata,
            status: "cancelled",
            orderStatus: "cancelled",
            kitchenStatus: "cancelled",
            paymentMethod: "momo",
            paymentStatus: "failed",
            cancelReason: "momo_payment_failed",
            cancelledBy: "momo_webhook",
            paymentFailureMessage: toText(body.message),
            paymentFailedAt: now
          },
          updated_at: now
        }).eq("id", orderId);
      }
    }
    await logWebhook(supabase, body, "payment_failed", sessionId, orderId);
    return new Response(null, { status: 204 });
  }

  const now = new Date().toISOString();
  const paidAt = Number(body.responseTime) > 0
    ? new Date(Number(body.responseTime)).toISOString()
    : now;
  const providerTransactionId = toText(body.transId);
  const { data: paidSession, error: paidSessionError } = await supabase.from("pos_payment_sessions").update({
    status: "paid",
    amount_paid: paidAmount,
    provider_transaction_id: providerTransactionId || null,
    provider_payload: { ...getObject(session.provider_payload), lastResult: safeIpnResult },
    paid_at: paidAt,
    failure_reason: "",
    updated_at: now
  }).eq("id", sessionId)
    .in("status", ["pending_payment", "paid", "converting", "converted"])
    .select("id,status")
    .maybeSingle();
  if (paidSessionError) {
    await logWebhook(supabase, body, "session_update_failed", sessionId, orderId);
    return jsonResponse({ ok: false, message: paidSessionError.message }, 500);
  }
  if (!paidSession) {
    const latePaymentMetadata = {
      receivedAfterCancellation: true,
      amount: paidAmount,
      transactionId: providerTransactionId,
      receivedAt: paidAt,
      provider: "momo"
    };
    await supabase.from("pos_payment_sessions").update({
      amount_paid: paidAmount,
      provider_transaction_id: providerTransactionId || null,
      paid_at: paidAt,
      failure_reason: "payment_received_after_cancel",
      provider_payload: {
        ...getObject(session.provider_payload),
        lastResult: safeIpnResult,
        latePayment: latePaymentMetadata
      },
      updated_at: now
    }).eq("id", sessionId).in("status", ["cancelled", "expired"]);

    if (orderId) {
      const { data: cancelledOrder } = await supabase
        .from("orders")
        .select("id,metadata")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelledOrder) {
        await supabase.from("orders").update({
          metadata: {
            ...getObject(cancelledOrder.metadata),
            paymentStatus: "paid_after_cancel",
            refundStatus: "manual_review",
            latePayment: latePaymentMetadata
          },
          updated_at: now
        }).eq("id", orderId).eq("status", "cancelled");
      }
    }

    await logWebhook(supabase, body, "payment_received_after_cancel", sessionId, orderId);
    return new Response(null, { status: 204 });
  }

  if (toText(session.source).toLowerCase() === "pos" && !orderId) {
    await logWebhook(supabase, body, "payment_session_paid", sessionId, "");
    return new Response(null, { status: 204 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) {
    await logWebhook(supabase, body, "order_not_found", sessionId, orderId);
    return jsonResponse({ ok: false, message: orderError?.message || "Không tìm thấy đơn hàng." }, 500);
  }

  const metadata = getObject(order.metadata);
  const alreadyPaid = toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";
  if (!alreadyPaid) {
    const nextMetadata = {
      ...metadata,
      status: "preparing",
      orderStatus: "preparing",
      kitchenStatus: "pending",
      paymentMethod: "momo",
      paymentStatus: "paid",
      paymentAmount: paidAmount,
      paymentReference: toText(session.payment_reference),
      paymentProvider: "momo",
      qrPaymentSessionId: sessionId,
      paidAt,
      momoTransactionId: providerTransactionId,
      momoPaymentOption: toText(body.paymentOption || "momo")
    };
    const { error: updateOrderError } = await supabase.from("orders").update({
      status: "preparing",
      kitchen_status: "pending",
      payment_method: "momo",
      metadata: nextMetadata,
      updated_at: now
    }).eq("id", orderId);
    if (updateOrderError) {
      await logWebhook(supabase, body, "order_update_failed", sessionId, orderId);
      return jsonResponse({ ok: false, message: updateOrderError.message }, 500);
    }
    order.status = "preparing";
    order.kitchen_status = "pending";
    order.payment_method = "momo";
    order.metadata = nextMetadata;
  }

  await ensurePrintJob(supabase, order);
  await supabase.from("pos_payment_sessions").update({
    status: "converted",
    converted_at: now,
    updated_at: now
  }).eq("id", sessionId).in("status", ["paid", "converting", "converted"]);
  await logWebhook(supabase, body, alreadyPaid ? "already_paid" : "paid_and_sent_to_kitchen", sessionId, orderId);
  return new Response(null, { status: 204 });
});
