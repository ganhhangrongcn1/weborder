import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function toNumber(value: unknown = 0) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function normalizePhone(value: unknown = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return digits;
}

function normalizeIsoDate(value: unknown = "") {
  const raw = toText(value);
  if (!raw) return new Date().toISOString();

  const normalized = raw.includes("T")
    ? raw
    : raw.replace(" ", "T");

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function normalizeReferenceKey(value: unknown = "") {
  return toText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function addReferenceCandidate(candidates: Set<string>, value: unknown = "") {
  const raw = toText(value);
  if (!raw) return;

  const normalized = raw.toUpperCase();
  candidates.add(normalized);

  const compact = normalizeReferenceKey(normalized);
  if (compact) candidates.add(compact);

  const compactPosMatch = compact.match(/POS(\d{8})(\d{6})/);
  if (compactPosMatch) {
    candidates.add(`POS-${compactPosMatch[1]}-${compactPosMatch[2]}`);
  }

  const compactGhrMatch = compact.match(/GHR(\d{4,})/);
  if (compactGhrMatch) {
    candidates.add(`GHR-${compactGhrMatch[1]}`);
  }

  const compactPickupQrMatch = compact.match(/GHR(\d{4,})QR(\d{4,})/);
  if (compactPickupQrMatch) {
    candidates.add(`GHR-${compactPickupQrMatch[1]}-QR-${compactPickupQrMatch[2]}`);
  }
}

function extractCandidateReferences(payload: JsonRecord) {
  const values = [
    toText(payload.content),
    toText(payload.code),
    toText(payload.referenceCode)
  ].filter(Boolean);

  const candidates = new Set<string>();

  values.forEach((value) => {
    addReferenceCandidate(candidates, value);

    const shortMatches = value.match(/GHR-\d{4,}/gi) || [];
    shortMatches.forEach((match) => addReferenceCandidate(candidates, match));

    const compactShortMatches = value.match(/GHR\d{4,}/gi) || [];
    compactShortMatches.forEach((match) => addReferenceCandidate(candidates, match));

    const pickupMatches = value.match(/GHR-\d{4,}-QR-\d{4,}/gi) || [];
    pickupMatches.forEach((match) => addReferenceCandidate(candidates, match));

    const compactPickupMatches = value.match(/GHR\d{4,}QR\d{4,}/gi) || [];
    compactPickupMatches.forEach((match) => addReferenceCandidate(candidates, match));

    const fullMatches = value.match(/POS-\d{8}-\d{6}/gi) || [];
    fullMatches.forEach((match) => addReferenceCandidate(candidates, match));

    const compactFullMatches = value.match(/POS\d{14}/gi) || [];
    compactFullMatches.forEach((match) => addReferenceCandidate(candidates, match));
  });

  return Array.from(candidates).filter(Boolean);
}

function matchesPaymentSessionReference(session: JsonRecord, reference: string) {
  const checkoutSnapshot = getObject(session.checkout_snapshot);
  const orderIdentity = getObject(checkoutSnapshot.orderIdentity);
  const safeReference = toText(reference).toUpperCase();
  const safeReferenceKey = normalizeReferenceKey(reference);

  const directCandidates = [
    toText(session.payment_reference),
    toText(session.order_id),
    toText(orderIdentity.orderCode),
    toText(orderIdentity.displayOrderCode),
    toText(orderIdentity.paymentReference),
    toText(orderIdentity.payment_reference)
  ]
    .filter(Boolean)
    .map((value) => value.toUpperCase());

  if (directCandidates.some((candidate) => candidate === safeReference)) {
    return true;
  }

  const normalizedCandidates = directCandidates
    .map((candidate) => normalizeReferenceKey(candidate))
    .filter(Boolean);

  return normalizedCandidates.some((candidate) => candidate === safeReferenceKey);
}

function isPosQrOrder(order: JsonRecord) {
  const metadata = getObject(order.metadata);
  const source = toText(
    order.source ||
    order.order_source ||
    metadata.source ||
    metadata.orderSource ||
    metadata.channel
  ).toLowerCase();
  const paymentMethod = toText(
    order.payment_method ||
    metadata.paymentMethod
  ).toLowerCase();

  const paymentReference = toText(metadata.paymentReference || metadata.payment_reference);
  const displayOrderCode = toText(metadata.displayOrderCode || metadata.display_order_code);
  const hasPosReference = normalizeReferenceKey(paymentReference).includes("POS") ||
    normalizeReferenceKey(order.order_code).includes("POS") ||
    normalizeReferenceKey(displayOrderCode).includes("GHR");

  return paymentMethod === "bank_qr" && (source === "pos" || hasPosReference);
}

async function tryInsertWebhookLog(supabase: ReturnType<typeof createClient>, row: JsonRecord) {
  const safeRow = {
    webhook_code: row.webhook_code,
    transfer_type: row.transfer_type,
    transfer_amount: row.transfer_amount,
    matched_order_id: row.matched_order_id,
    matched_payment_session_id: row.matched_payment_session_id,
    processed_result: row.processed_result,
    raw_payload: row.raw_payload,
    created_at: row.created_at
  };
  try {
    let { error } = await supabase.from("sepay_webhook_logs").insert(safeRow);
    if (
      error &&
      (
        toText(error.code).toUpperCase() === "PGRST204" ||
        toText(error.message).toLowerCase().includes("matched_payment_session_id")
      )
    ) {
      const {
        matched_payment_session_id: _matchedPaymentSessionId,
        ...legacySafeRow
      } = safeRow;
      const retry = await supabase.from("sepay_webhook_logs").insert(legacySafeRow);
      error = retry.error;
    }
    if (error) {
      console.error("[sepay-pos-webhook] insert log failed", JSON.stringify(error));
    }
  } catch (error) {
    console.error("[sepay-pos-webhook] insert log failed", error);
  }
}

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
  "branch_address",
  "metadata",
  "created_at",
  "updated_at",
  "kitchen_status"
].join(",");

function matchesReference(order: JsonRecord, reference: string) {
  const metadata = getObject(order.metadata);
  const candidates = [
    toText(order.order_code),
    toText(metadata.displayOrderCode),
    toText(metadata.display_order_code),
    toText(metadata.paymentReference),
    toText(metadata.payment_reference)
  ]
    .filter(Boolean)
    .map((value) => value.toUpperCase());

  const safeReference = toText(reference).toUpperCase();
  const safeReferenceKey = normalizeReferenceKey(reference);

  return candidates.some((candidate) => (
    candidate === safeReference ||
    normalizeReferenceKey(candidate) === safeReferenceKey
  ));
}

async function findOrderByReference(supabase: ReturnType<typeof createClient>, reference: string) {
  const safeReference = toText(reference);
  if (!safeReference) return null;

  const { data: directMatch, error: directError } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_code", safeReference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!directError && directMatch && isPosQrOrder(directMatch)) {
    return directMatch;
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !Array.isArray(data)) return null;

  return data.find((order) => isPosQrOrder(order) && matchesReference(order, safeReference)) || null;
}

const PAYMENT_SESSION_COLUMNS = [
  "id",
  "payment_reference",
  "provider",
  "provider_transaction_id",
  "source",
  "status",
  "branch_uuid",
  "amount_expected",
  "amount_paid",
  "order_id",
  "expires_at",
  "paid_at",
  "provider_payload",
  "created_at",
  "updated_at"
].join(",");

async function findPaymentSessionByReference(
  supabase: ReturnType<typeof createClient>,
  reference: string
) {
  const safeReference = toText(reference);
  if (!safeReference) return null;

  const { data, error } = await supabase
    .from("pos_payment_sessions")
    .select(PAYMENT_SESSION_COLUMNS)
    .eq("payment_reference", safeReference.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const errorCode = toText(error.code).toUpperCase();
    const errorMessage = toText(error.message).toLowerCase();
    const tableUnavailable =
      errorCode === "42P01" ||
      errorCode === "PGRST205" ||
      errorMessage.includes("pos_payment_sessions");

    if (!tableUnavailable) {
      console.error("[sepay-pos-webhook] payment session lookup failed", JSON.stringify(error));
    }
    return null;
  }

  if (data) return data;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("pos_payment_sessions")
    .select(PAYMENT_SESSION_COLUMNS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (fallbackError || !Array.isArray(fallbackRows)) {
    return null;
  }

  const safeReferenceKey = normalizeReferenceKey(safeReference);
  return fallbackRows.find((row) => {
    if (normalizeReferenceKey(toText(row.payment_reference)) === safeReferenceKey) {
      return true;
    }
    return matchesPaymentSessionReference(row, safeReference);
  }) || null;
}

function isPayablePaymentSession(session: JsonRecord) {
  const status = toText(session.status).toLowerCase();
  if (status === "pending_payment") {
    const expiresAt = new Date(toText(session.expires_at)).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false;
  }
  return ["pending_payment", "paid", "converting", "converted"].includes(status);
}

async function markPaymentSessionPaid(
  supabase: ReturnType<typeof createClient>,
  session: JsonRecord,
  options: {
    transferAmount: number;
    transactionTime: string;
    providerTransactionId: string;
    payload: JsonRecord;
  }
) {
  const status = toText(session.status).toLowerCase();
  if (["paid", "converting", "converted"].includes(status)) {
    return {
      ok: true,
      alreadyPaid: true,
      session
    };
  }

  const now = new Date().toISOString();
  const providerPayload = {
    ...getObject(session.provider_payload),
    sepayWebhook: options.payload
  };

  const { data, error } = await supabase
    .from("pos_payment_sessions")
    .update({
      status: "paid",
      amount_paid: options.transferAmount,
      provider_transaction_id: options.providerTransactionId || null,
      provider_payload: providerPayload,
      paid_at: options.transactionTime,
      updated_at: now
    })
    .eq("id", toText(session.id))
    .in("status", ["draft", "pending_payment"])
    .select(PAYMENT_SESSION_COLUMNS)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      alreadyPaid: false,
      message: error.message || "Failed to update payment session.",
      session
    };
  }

  if (!data) {
    const { data: latest } = await supabase
      .from("pos_payment_sessions")
      .select(PAYMENT_SESSION_COLUMNS)
      .eq("id", toText(session.id))
      .maybeSingle();

    const latestStatus = toText(latest?.status).toLowerCase();
    if (["paid", "converting", "converted"].includes(latestStatus)) {
      return {
        ok: true,
        alreadyPaid: true,
        session: latest
      };
    }
  }

  return {
    ok: Boolean(data),
    alreadyPaid: false,
    message: data ? "" : "Payment session is no longer payable.",
    session: data || session
  };
}

async function readOrderItems(supabase: ReturnType<typeof createClient>, orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,product_id,product_name,quantity,unit_price,line_total,note,toppings,option_groups,spice,metadata")
    .eq("order_id", orderId);

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

async function hasExistingPrintJob(supabase: ReturnType<typeof createClient>, orderId: string, orderCode: string) {
  const comparableKeys = [
    { column: "order_id", value: orderId },
    { column: "order_code", value: orderCode }
  ].filter((item) => item.value);

  for (const item of comparableKeys) {
    const { data, error } = await supabase
      .from("print_jobs")
      .select("id,status")
      .eq("job_type", "customer_bill")
      .eq(item.column, item.value)
      .in("status", ["pending", "printing", "printed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data[0]?.id) return true;
  }

  return false;
}

function buildPrintOrder(order: JsonRecord, items: JsonRecord[]) {
  const metadata = getObject(order.metadata);
  return {
    id: toText(order.id),
    orderCode: toText(order.order_code || order.id),
    displayOrderCode: toText(metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id),
    platform: "POS",
    sourceType: "website",
    source: "pickup",
    channel: "pos",
    orderSource: "pos",
    branchUuid: toText(order.branch_uuid || metadata.branchUuid),
    branchName: toText(order.branch_name || metadata.branchName),
    branchAddress: toText(order.branch_address || metadata.branchAddress),
    branchPhone: toText(metadata.branchPhone),
    customerName: toText(order.customer_name),
    customerPhone: normalizePhone(order.customer_phone),
    paymentMethod: "Chuyển khoản QR",
    fulfillmentType: toText(order.fulfillment_type || "pickup"),
    note: toText(metadata.orderNote || metadata.note),
    promoCode: toText(order.promo_code || metadata.promoCode),
    createdAt: normalizeIsoDate(order.updated_at || order.created_at),
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shipping_fee),
    discount:
      toNumber(order.promo_discount) +
      toNumber(order.points_discount) +
      toNumber(order.shipping_support_discount),
    totalAmount: toNumber(metadata.paymentAmount || metadata.payment_amount || order.total_amount),
    items: (Array.isArray(items) ? items : []).map((item) => ({
      id: toText(item.id),
      name: toText(item.product_name),
      quantity: Math.max(1, Math.floor(toNumber(item.quantity, 1))),
      price: toNumber(item.unit_price),
      total: toNumber(item.line_total),
      note: toText(item.note),
      options: [
        ...((Array.isArray(item.toppings) ? item.toppings : []).map((entry) => toText(getObject(entry).name || getObject(entry).label || getObject(entry).value))),
        ...((Array.isArray(item.option_groups) ? item.option_groups : []).flatMap((group) => {
          const groupObject = getObject(group);
          const groupName = toText(groupObject.name || groupObject.label);
          const options = Array.isArray(groupObject.options) ? groupObject.options : [];
          return options.map((option) => {
            const optionObject = getObject(option);
            const optionName = toText(optionObject.name || optionObject.label || optionObject.value);
            return groupName && optionName ? `${groupName}: ${optionName}` : optionName;
          });
        }))
      ].filter(Boolean)
    }))
  };
}

async function ensureCustomerBillPrintJob(
  supabase: ReturnType<typeof createClient>,
  order: JsonRecord
) {
  const orderId = toText(order.id);
  const orderCode = toText(order.order_code || order.id);

  if (!orderId || !orderCode) {
    return { created: false, reason: "missing_order_id" };
  }

  const exists = await hasExistingPrintJob(supabase, orderId, orderCode);
  if (exists) {
    return { created: false, reason: "already_exists" };
  }

  const items = await readOrderItems(supabase, orderId);
  const now = new Date().toISOString();
  const metadata = getObject(order.metadata);

  const { error } = await supabase
    .from("print_jobs")
    .insert({
      branch_uuid: toText(order.branch_uuid),
      printer_key: "cashier-80mm",
      job_type: "customer_bill",
      status: "pending",
      order_id: orderId,
      order_code: toText(metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id),
      source_type: "pos",
      payload: {
        printerName: "Xprinter",
        receiptWidthMm: 80,
        order: buildPrintOrder(order, items)
      },
      requested_by: "sepay_webhook",
      requested_at: now,
      created_at: now,
      updated_at: now
    });

  return {
    created: !error,
    reason: error ? (error.message || "insert_failed") : "created"
  };
}

async function markOrderPaidFromPaymentSession(
  supabase: ReturnType<typeof createClient>,
  session: JsonRecord,
  options: {
    transferAmount: number;
    transactionTime: string;
    providerTransactionId: string;
    payload: JsonRecord;
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
  const alreadyPaid = toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";
  if (!alreadyPaid) {
    const paymentReference = toText(session.payment_reference);
    const nextMetadata = {
      ...metadata,
      status: "pending_zalo",
      kitchenStatus: "pending",
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: options.transferAmount,
      paymentReference,
      qrPaymentSessionId: toText(session.id),
      paidAt: options.transactionTime,
      paymentProvider: "sepay",
      sepayWebhook: {
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

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "pending_zalo",
        kitchen_status: "pending",
        payment_method: "bank_qr",
        updated_at: new Date().toISOString(),
        metadata: nextMetadata
      })
      .eq("id", orderId);

    if (updateError) {
      return {
        ok: false,
        updated: false,
        reason: updateError.message || "order_update_failed"
      };
    }

    order.status = "pending_zalo";
    order.kitchen_status = "pending";
    order.payment_method = "bank_qr";
    order.metadata = nextMetadata;
  }

  const printJob = await ensureCustomerBillPrintJob(supabase, order);
  return {
    ok: true,
    updated: !alreadyPaid,
    reason: alreadyPaid ? "already_paid" : "paid_and_sent_to_kitchen",
    printJob
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed."
      }),
      {
        status: 405,
        headers: jsonHeaders
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = toText(Deno.env.get("SEPAY_WEBHOOK_SECRET"));

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Missing Supabase env."
      }),
      {
        status: 500,
        headers: jsonHeaders
      }
    );
  }

  if (webhookSecret) {
    const url = new URL(request.url);
    const requestSecret = toText(url.searchParams.get("secret"));
    if (!requestSecret || requestSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid webhook secret."
        }),
        {
          status: 401,
          headers: jsonHeaders
        }
      );
    }
  }

  const payload = await request.json().catch(() => ({}));
  const body = getObject(payload);
  console.log("[sepay-pos-webhook] received payload", JSON.stringify(body));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const transferType = toText(body.transferType).toLowerCase();
  const transferAmount = Math.max(0, Math.floor(toNumber(body.transferAmount)));
  const transactionTime = normalizeIsoDate(body.transactionDate);
  const webhookCode = toText(body.code || body.referenceCode);
  const candidateReferences = extractCandidateReferences(body);
  console.log("[sepay-pos-webhook] parsed payload", JSON.stringify({
    transferType,
    transferAmount,
    transactionTime,
    webhookCode,
    candidateReferences
  }));

  await tryInsertWebhookLog(supabase, {
    provider: "sepay",
    webhook_code: webhookCode,
    transfer_type: transferType,
    transfer_amount: transferAmount,
    account_number: toText(body.accountNumber),
    gateway: toText(body.gateway),
    raw_payload: body,
    matched_order_id: null,
    processed_result: "received",
    created_at: new Date().toISOString()
  });

  if (transferType !== "in") {
    return new Response(
      JSON.stringify({
        success: true,
        ignored: true,
        reason: "transfer_type_not_in"
      }),
      {
        status: 200,
        headers: jsonHeaders
      }
    );
  }

  let matchedOrder: JsonRecord | null = null;
  let matchedPaymentSession: JsonRecord | null = null;
  let matchedReference = "";

  for (const reference of candidateReferences) {
    const session = await findPaymentSessionByReference(supabase, reference);
    if (!session || !isPayablePaymentSession(session)) continue;
    matchedPaymentSession = session;
    matchedReference = reference;
    break;
  }

  if (matchedPaymentSession) {
    const expectedAmount = Math.max(
      0,
      Math.floor(toNumber(matchedPaymentSession.amount_expected))
    );

    if (!expectedAmount || expectedAmount !== transferAmount) {
      await tryInsertWebhookLog(supabase, {
        webhook_code: webhookCode,
        transfer_type: transferType,
        transfer_amount: transferAmount,
        matched_order_id: null,
        matched_payment_session_id: toText(matchedPaymentSession.id),
        processed_result: "payment_session_amount_mismatch",
        raw_payload: body,
        created_at: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          matchedType: "payment_session",
          updated: false,
          reason: "amount_mismatch",
          expectedAmount,
          transferAmount
        }),
        {
          status: 200,
          headers: jsonHeaders
        }
      );
    }

    const paymentResult = await markPaymentSessionPaid(
      supabase,
      matchedPaymentSession,
      {
        transferAmount,
        transactionTime,
        providerTransactionId: toText(body.id || body.referenceCode || body.code),
        payload: body
      }
    );

    if (!paymentResult.ok) {
      console.error(
        "[sepay-pos-webhook] update payment session failed",
        paymentResult.message
      );
      return new Response(
        JSON.stringify({
          success: false,
          matched: true,
          matchedType: "payment_session",
          updated: false,
          message: paymentResult.message
        }),
        {
          status: 500,
          headers: jsonHeaders
        }
      );
    }

    const paidSession = getObject(paymentResult.session);
    const paidSessionSource = toText(paidSession.source).toLowerCase();
    const shouldSyncQrOrder = paidSessionSource === "qr_order";
    const orderPaymentResult = shouldSyncQrOrder
      ? await markOrderPaidFromPaymentSession(
          supabase,
          paidSession,
          {
            transferAmount,
            transactionTime,
            providerTransactionId: toText(body.id || body.referenceCode || body.code),
            payload: body
          }
        )
      : { ok: true, updated: false, reason: "", printJob: {} };

    if (shouldSyncQrOrder && !orderPaymentResult.ok) {
      console.error("[sepay-pos-webhook] update order from payment session failed", orderPaymentResult.reason);
    }

    await tryInsertWebhookLog(supabase, {
      webhook_code: webhookCode,
      transfer_type: transferType,
      transfer_amount: transferAmount,
      matched_order_id: shouldSyncQrOrder ? toText(paidSession.order_id) || null : null,
      matched_payment_session_id: toText(paidSession.id),
      processed_result: shouldSyncQrOrder
        ? orderPaymentResult.ok
          ? toText(orderPaymentResult.reason) || "payment_session_paid"
          : "payment_session_paid_order_update_failed"
        : paymentResult.alreadyPaid
          ? "payment_session_already_paid"
          : "payment_session_paid",
      raw_payload: body,
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        matched: true,
        matchedType: "payment_session",
        updated: !paymentResult.alreadyPaid,
        orderUpdated: Boolean(shouldSyncQrOrder && orderPaymentResult.ok && orderPaymentResult.updated),
        paymentSessionId: toText(paidSession.id),
        paymentReference: toText(paidSession.payment_reference),
        orderId: shouldSyncQrOrder ? toText(paidSession.order_id) || null : null,
        status: toText(paidSession.status),
        printJob: shouldSyncQrOrder ? getObject(orderPaymentResult.printJob) : {}
      }),
      {
        status: 200,
        headers: jsonHeaders
      }
    );
  }

  for (const reference of candidateReferences) {
    const order = await findOrderByReference(supabase, reference);
    if (!order || !isPosQrOrder(order)) continue;
    matchedOrder = order;
    matchedReference = reference;
    break;
  }
  console.log("[sepay-pos-webhook] matching result", JSON.stringify({
    matchedReference,
    matchedPaymentSessionId: toText(matchedPaymentSession?.id),
    matchedOrderId: toText(matchedOrder?.id),
    matchedOrderCode: toText(matchedOrder?.order_code)
  }));

  if (!matchedOrder) {
    return new Response(
      JSON.stringify({
        success: true,
        matched: false,
        reason: "order_not_found",
        references: candidateReferences
      }),
      {
        status: 200,
        headers: jsonHeaders
      }
    );
  }

  const expectedAmount = Math.max(
    0,
    Math.floor(
      toNumber(
        getObject(matchedOrder.metadata).paymentAmount ||
        getObject(matchedOrder.metadata).payment_amount ||
        matchedOrder.total_amount
      )
    )
  );

  if (!expectedAmount || expectedAmount !== transferAmount) {
    console.warn("[sepay-pos-webhook] amount mismatch", JSON.stringify({
      expectedAmount,
      transferAmount,
      orderId: toText(matchedOrder.id),
      orderCode: toText(matchedOrder.order_code)
    }));
    await tryInsertWebhookLog(supabase, {
      provider: "sepay",
      webhook_code: webhookCode,
      transfer_type: transferType,
      transfer_amount: transferAmount,
      account_number: toText(body.accountNumber),
      gateway: toText(body.gateway),
      raw_payload: body,
      matched_order_id: toText(matchedOrder.id),
      processed_result: "amount_mismatch",
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        matched: true,
        updated: false,
        reason: "amount_mismatch",
        expectedAmount,
        transferAmount
      }),
      {
        status: 200,
        headers: jsonHeaders
      }
    );
  }

  const metadata = getObject(matchedOrder.metadata);
  const alreadyPaid = toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";

  if (!alreadyPaid) {
    const nextMetadata = {
      ...metadata,
      status: "pending_zalo",
      kitchenStatus: "pending",
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: transferAmount,
      paymentReference: matchedReference || toText(matchedOrder.payment_reference),
      paidAt: transactionTime,
      paymentProvider: "sepay",
      sepayWebhook: {
        id: body.id ?? null,
        gateway: toText(body.gateway),
        accountNumber: toText(body.accountNumber),
        transactionDate: transactionTime,
        code: webhookCode,
        content: toText(body.content),
        referenceCode: toText(body.referenceCode),
        transferAmount
      }
    };

    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending_zalo",
        kitchen_status: "pending",
        payment_method: "bank_qr",
        updated_at: new Date().toISOString(),
        metadata: nextMetadata
      })
      .eq("id", toText(matchedOrder.id));

    if (error) {
      console.error("[sepay-pos-webhook] update order failed", error);
      return new Response(
        JSON.stringify({
          success: false,
          matched: true,
          updated: false,
          message: error.message || "Failed to update order."
        }),
        {
          status: 500,
          headers: jsonHeaders
        }
      );
    }

    matchedOrder = {
      ...matchedOrder,
      status: "pending_zalo",
      kitchen_status: "pending",
      payment_method: "bank_qr",
      metadata: nextMetadata
    };
  }
  console.log("[sepay-pos-webhook] order updated", JSON.stringify({
    orderId: toText(matchedOrder.id),
    orderCode: toText(matchedOrder.order_code),
    alreadyPaid
  }));

  const printJob = await ensureCustomerBillPrintJob(supabase, matchedOrder);
  console.log("[sepay-pos-webhook] print job result", JSON.stringify(printJob));

  await tryInsertWebhookLog(supabase, {
    provider: "sepay",
    webhook_code: webhookCode,
    transfer_type: transferType,
    transfer_amount: transferAmount,
    account_number: toText(body.accountNumber),
    gateway: toText(body.gateway),
    raw_payload: body,
    matched_order_id: toText(matchedOrder.id),
    processed_result: alreadyPaid ? "already_paid" : "paid_and_sent_to_kitchen",
    created_at: new Date().toISOString()
  });

  return new Response(
    JSON.stringify({
      success: true,
      matched: true,
      updated: !alreadyPaid,
      orderId: toText(matchedOrder.id),
      orderCode: toText(
        getObject(matchedOrder.metadata).displayOrderCode ||
        getObject(matchedOrder.metadata).display_order_code ||
        matchedOrder.order_code ||
        matchedOrder.id
      ),
      printJob
    }),
    {
      status: 200,
      headers: jsonHeaders
    }
  );
});
