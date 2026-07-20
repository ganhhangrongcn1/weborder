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

const QR_ORDER_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

const SESSION_COLUMNS = [
  "id",
  "payment_reference",
  "provider",
  "source",
  "status",
  "branch_uuid",
  "pos_shift_id",
  "branch_name",
  "customer_name",
  "customer_phone",
  "currency",
  "amount_expected",
  "amount_paid",
  "checkout_snapshot",
  "provider_payload",
  "order_id",
  "failure_reason",
  "expires_at",
  "paid_at",
  "cancelled_at",
  "created_at",
  "updated_at"
].join(",");

const ORDER_COLUMNS = [
  "id",
  "order_code",
  "customer_phone",
  "customer_name",
  "payment_method",
  "status",
  "total_amount",
  "branch_uuid",
  "branch_name",
  "pickup_branch_uuid",
  "pickup_branch_name",
  "pos_shift_id",
  "metadata",
  "created_at",
  "updated_at",
  "kitchen_status"
].join(",");

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function toMoney(value: unknown = 0) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
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

function normalizePaymentReference(value: unknown = "") {
  return toText(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 80);
}

function isExpiredTime(value: unknown = "", now = Date.now()) {
  const expiresAt = new Date(toText(value)).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function isPaidMetadata(metadata: JsonRecord) {
  return toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";
}

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function getOrderIdCandidates(body: JsonRecord) {
  return Array.from(new Set([
    toText(body.order_id),
    toText(body.order_code),
    toText(body.orderId),
    toText(body.orderCode)
  ].filter(Boolean)));
}

async function readOrder(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const candidates = getOrderIdCandidates(body);
  for (const candidate of candidates) {
    const { data, error } = await serviceClient
      .from("orders")
      .select(ORDER_COLUMNS)
      .or(`id.eq.${candidate},order_code.eq.${candidate}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data;
  }
  return null;
}

async function findActivePosShift(serviceClient: ReturnType<typeof createClient>, branchUuid = "") {
  const safeBranchUuid = toText(branchUuid);
  if (!safeBranchUuid) return null;

  const { data, error } = await serviceClient
    .from("pos_shifts")
    .select("id,branch_uuid,status,opened_at")
    .eq("branch_uuid", safeBranchUuid)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[qr-payment-session-api] active shift lookup failed", error.message);
    return null;
  }

  return data || null;
}

function buildPaymentReference(order: JsonRecord, body: JsonRecord, provider = "sepay") {
  if (provider === "momo") {
    const orderCode = normalizePaymentReference(order.order_code || order.id).replace(/-/g, "").slice(0, 20);
    return normalizePaymentReference(`MM${orderCode}${Date.now().toString(36).toUpperCase()}`);
  }
  const explicit = normalizePaymentReference(body.payment_reference || body.paymentReference);
  if (explicit && /^[A-Z0-9-]{6,80}$/.test(explicit)) return explicit;

  const orderCode = normalizePaymentReference(order.order_code || order.id);
  if (orderCode) return orderCode;
  return normalizePaymentReference(`GHR-${Date.now().toString().slice(-8)}`);
}

function isQrPayableOrder(order: JsonRecord) {
  const metadata = getObject(order.metadata);
  const paymentMethod = toText(order.payment_method || metadata.paymentMethod || metadata.payment_method).toLowerCase();
  const source = toText(metadata.orderSource || metadata.source || metadata.channel).toLowerCase();
  return source === "qr_counter" && ["bank_qr", "momo"].includes(paymentMethod);
}

function getPaymentProvider(order: JsonRecord, body: JsonRecord) {
  const metadata = getObject(order.metadata);
  const paymentMethod = toText(order.payment_method || metadata.paymentMethod || metadata.payment_method).toLowerCase();
  const requestedProvider = toText(body.provider).toLowerCase();
  if (paymentMethod === "momo" && requestedProvider === "momo") return "momo";
  return "sepay";
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

async function createMomoPayment(
  serviceClient: ReturnType<typeof createClient>,
  session: JsonRecord,
  order: JsonRecord,
  supabaseUrl: string
) {
  const partnerCode = toText(Deno.env.get("MOMO_PARTNER_CODE"));
  const accessKey = toText(Deno.env.get("MOMO_ACCESS_KEY"));
  const secretKey = toText(Deno.env.get("MOMO_SECRET_KEY"));
  const apiEndpoint = toText(Deno.env.get("MOMO_API_ENDPOINT"));
  const redirectUrl = toText(Deno.env.get("MOMO_REDIRECT_URL"));
  if (!partnerCode || !accessKey || !secretKey || !apiEndpoint || !redirectUrl) {
    throw new Error("MoMo chưa được cấu hình đầy đủ trên Supabase.");
  }
  if (!["https://test-payment.momo.vn/v2/gateway/api/create", "https://payment.momo.vn/v2/gateway/api/create"].includes(apiEndpoint)) {
    throw new Error("MOMO_API_ENDPOINT không hợp lệ.");
  }

  const amount = toMoney(session.amount_expected);
  const orderId = toText(session.payment_reference);
  const requestId = orderId;
  const requestType = "captureWallet";
  const ipnUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/momo-payment-webhook`;
  const orderInfo = `Thanh toan don ${toText(order.order_code || order.id)} tai Ganh Hang Rong`;
  const extraData = btoa(JSON.stringify({ orderId: toText(order.id), source: "qr_order" }));
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`
  ].join("&");
  const signature = await signHmacSha256(rawSignature, secretKey);

  const momoResponse = getObject(await fetch(apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      partnerCode,
      partnerName: "Ganh Hang Rong",
      storeId: toText(session.branch_uuid || session.branch_name || "GHR"),
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      autoCapture: true,
      extraData,
      signature
    })
  }).then(async (result) => {
    const payload = getObject(await result.json().catch(() => ({})));
    if (!result.ok) throw new Error(toText(payload.message) || `MoMo HTTP ${result.status}`);
    return payload;
  }));

  if (Number(momoResponse.resultCode) !== 0 || !toText(momoResponse.payUrl)) {
    throw new Error(toText(momoResponse.message) || "MoMo không tạo được giao dịch.");
  }

  const providerPayload = {
    momoOrderId: orderId,
    requestId,
    resultCode: Number(momoResponse.resultCode),
    message: toText(momoResponse.message),
    payUrl: toText(momoResponse.payUrl),
    deeplink: toText(momoResponse.deeplink),
    qrCodeUrl: toText(momoResponse.qrCodeUrl),
    responseTime: Number(momoResponse.responseTime || 0)
  };
  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .update({ provider_payload: providerPayload, updated_at: new Date().toISOString() })
    .eq("id", toText(session.id))
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function findSession(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const sessionId = toText(body.session_id || body.sessionId);
  if (sessionId) {
    const { data } = await serviceClient
      .from("pos_payment_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();
    if (data) return data;
  }

  const orderId = getOrderIdCandidates(body)[0];
  if (orderId) {
    const { data } = await serviceClient
      .from("pos_payment_sessions")
      .select(SESSION_COLUMNS)
      .eq("source", "qr_order")
      .eq("order_id", orderId)
      .in("status", ["pending_payment", "paid", "converting", "converted", "expired", "cancelled", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const paymentReference = normalizePaymentReference(body.payment_reference || body.paymentReference);
  if (!paymentReference) return null;
  const { data } = await serviceClient
    .from("pos_payment_sessions")
    .select(SESSION_COLUMNS)
    .eq("source", "qr_order")
    .eq("payment_reference", paymentReference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function cancelExpiredQrOrder(
  serviceClient: ReturnType<typeof createClient>,
  orderId = "",
  session: JsonRecord,
  now: string,
  options: JsonRecord = {}
) {
  const safeOrderId = toText(orderId);
  if (!safeOrderId) return;

  const { data: order } = await serviceClient
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", safeOrderId)
    .maybeSingle();

  if (!order) return;

  const metadata = getObject(order.metadata);
  if (isPaidMetadata(metadata)) return;
  const cancelReason = toText(options.cancelReason) || "payment_timeout";
  const cancelledBy = toText(options.cancelledBy) || "qr_payment_timeout";
  const paymentStatus = toText(options.paymentStatus) || "expired";

  const nextMetadata = {
    ...metadata,
    status: "cancelled",
    orderStatus: "cancelled",
    kitchenStatus: "cancelled",
    paymentMethod: toText(order.payment_method || metadata.paymentMethod) || "bank_qr",
    paymentStatus,
    paymentExpiredAt: now,
    cancelReason,
    cancelledBy,
    qrPaymentSessionId: toText(session.id) || metadata.qrPaymentSessionId,
    paymentReference: toText(session.payment_reference) || metadata.paymentReference || metadata.payment_reference
  };

  await serviceClient
    .from("orders")
    .update({
      status: "cancelled",
      kitchen_status: "cancelled",
      payment_method: toText(order.payment_method || metadata.paymentMethod) || "bank_qr",
      metadata: nextMetadata,
      updated_at: now
    })
    .eq("id", safeOrderId);
}

async function expireQrOrderSessionIfNeeded(
  serviceClient: ReturnType<typeof createClient>,
  session: JsonRecord | null
) {
  if (!session) return null;
  const source = toText(session.source).toLowerCase();
  const status = toText(session.status).toLowerCase();
  if (source !== "qr_order" || status !== "pending_payment" || !isExpiredTime(session.expires_at)) {
    return session;
  }

  const now = new Date().toISOString();
  const { data: expiredSession } = await serviceClient
    .from("pos_payment_sessions")
    .update({
      status: "expired",
      failure_reason: "Đơn QR quá hạn thanh toán sau 10 phút",
      cancelled_at: now,
      updated_at: now
    })
    .eq("id", toText(session.id))
    .eq("status", "pending_payment")
    .select(SESSION_COLUMNS)
    .maybeSingle();

  const nextSession = expiredSession || session;
  if (expiredSession) {
    await cancelExpiredQrOrder(serviceClient, toText(expiredSession.order_id || session.order_id), expiredSession, now);
  }
  return nextSession;
}

async function createSession(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const order = await readOrder(serviceClient, body);
  if (!order) return response({ ok: false, message: "Không tìm thấy đơn QR để tạo thanh toán." }, 404);
  if (!isQrPayableOrder(order)) {
    return response({ ok: false, message: "Đơn này không phải đơn thanh toán QR." }, 400);
  }

  const metadata = getObject(order.metadata);
  const paymentMethod = toText(order.payment_method || metadata.paymentMethod || metadata.payment_method).toLowerCase();
  const provider = getPaymentProvider(order, body);
  const branchUuid = toText(order.pickup_branch_uuid || order.branch_uuid) || null;
  const branchName = toText(order.pickup_branch_name || order.branch_name);
  const activeShift = await findActivePosShift(serviceClient, branchUuid || "");
  const posShiftId = toText(order.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id || activeShift?.id);

  const existing = await findSession(serviceClient, {
    ...body,
    order_id: toText(order.id)
  });
  if (existing) {
    let nextSession = await expireQrOrderSessionIfNeeded(serviceClient, existing);
    if (toText(nextSession?.status).toLowerCase() === "expired") {
      return response({
        ok: false,
        message: "Đơn đã quá hạn thanh toán sau 10 phút. Anh/chị vui lòng đặt lại đơn mới.",
        session: nextSession
      }, 409);
    }
    if (posShiftId && toText(existing.pos_shift_id) !== posShiftId) {
      const { data: patchedSession } = await serviceClient
        .from("pos_payment_sessions")
        .update({
          pos_shift_id: posShiftId,
          updated_at: new Date().toISOString()
        })
        .eq("id", toText(existing.id))
        .select(SESSION_COLUMNS)
        .maybeSingle();
      if (patchedSession) nextSession = patchedSession;
    }
    if (posShiftId && (
      toText(order.pos_shift_id) !== posShiftId ||
      toText(metadata.posShiftId || metadata.pos_shift_id) !== posShiftId
    )) {
      await serviceClient
        .from("orders")
        .update({
          pos_shift_id: posShiftId,
          metadata: {
            ...metadata,
            posShiftId,
            pos_shift_id: posShiftId
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", toText(order.id));
    }
    if (
      provider === "momo" &&
      toText(nextSession?.status).toLowerCase() === "pending_payment" &&
      !toText(getObject(nextSession?.provider_payload).payUrl)
    ) {
      try {
        nextSession = await createMomoPayment(serviceClient, nextSession as JsonRecord, order, toText(Deno.env.get("SUPABASE_URL")));
      } catch (error) {
        return response({ ok: false, message: error instanceof Error ? error.message : "Không tạo được giao dịch MoMo.", session: nextSession }, 502);
      }
    }
    return response({ ok: true, session: nextSession, reused: true });
  }

  const amountExpected = toMoney(order.total_amount || getObject(order.metadata).totalAmount);
  if (!amountExpected) {
    return response({ ok: false, message: "Đơn chưa có số tiền thanh toán hợp lệ." }, 400);
  }

  const paymentReference = buildPaymentReference(order, body, provider);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QR_ORDER_PAYMENT_TIMEOUT_MS).toISOString();

  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .insert({
      payment_reference: paymentReference,
      provider,
      source: "qr_order",
      status: "pending_payment",
      branch_uuid: branchUuid,
      pos_shift_id: posShiftId || null,
      branch_name: branchName,
      cashier_name: "",
      customer_name: toText(order.customer_name || metadata.customerName),
      customer_phone: normalizePhone(order.customer_phone || metadata.customerPhone) || null,
      currency: "VND",
      amount_expected: amountExpected,
      amount_paid: 0,
      cart_snapshot: Array.isArray(metadata.items) ? metadata.items : [],
      checkout_snapshot: {
        posShiftId: posShiftId || "",
        orderIdentity: {
          orderId: toText(order.id),
          orderCode: toText(order.order_code),
          paymentReference
        }
      },
      provider_payload: {},
      order_id: toText(order.id),
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    return response({ ok: false, message: error.message || "Không tạo được phiên thanh toán QR." }, 500);
  }

  const nextMetadata = {
    ...metadata,
    paymentMethod,
    paymentStatus: "unpaid",
    paymentAmount: amountExpected,
    paymentReference,
    qrPaymentSessionId: data.id,
    ...(posShiftId ? {
      posShiftId,
      pos_shift_id: posShiftId
    } : {})
  };
  const orderPatch: JsonRecord = {
    payment_method: paymentMethod,
    metadata: nextMetadata,
    updated_at: now.toISOString()
  };
  if (posShiftId) orderPatch.pos_shift_id = posShiftId;

  await serviceClient
    .from("orders")
    .update(orderPatch)
    .eq("id", toText(order.id));

  if (provider === "momo") {
    try {
      const momoSession = await createMomoPayment(serviceClient, data, order, toText(Deno.env.get("SUPABASE_URL")));
      return response({ ok: true, session: momoSession, reused: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không tạo được giao dịch MoMo.";
      const failedAt = new Date().toISOString();
      const { data: failedSession } = await serviceClient
        .from("pos_payment_sessions")
        .update({ status: "failed", failure_reason: message, cancelled_at: failedAt, updated_at: failedAt })
        .eq("id", toText(data.id))
        .select(SESSION_COLUMNS)
        .maybeSingle();
      await cancelExpiredQrOrder(serviceClient, toText(order.id), failedSession || data, failedAt, {
        cancelReason: "momo_create_failed",
        cancelledBy: "momo_payment_create",
        paymentStatus: "failed"
      });
      return response({ ok: false, message, session: failedSession || data }, 502);
    }
  }

  return response({ ok: true, session: data, reused: false });
}

async function readSession(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const session = await expireQrOrderSessionIfNeeded(serviceClient, await findSession(serviceClient, body));
  if (!session) return response({ ok: false, message: "Chưa có phiên thanh toán cho đơn này." }, 404);
  return response({ ok: true, session });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ ok: false, message: "Method not allowed." }, 405);

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ ok: false, message: "Thiếu cấu hình Supabase Function." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const payload = getObject(await request.json().catch(() => ({})));
  const action = toText(payload.action).toLowerCase();

  if (action === "create") return createSession(serviceClient, payload);
  if (action === "read") return readSession(serviceClient, payload);
  return response({ ok: false, message: "Thao tác không được hỗ trợ." }, 400);
});
