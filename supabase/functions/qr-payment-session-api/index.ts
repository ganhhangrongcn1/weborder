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

const SESSION_COLUMNS = [
  "id",
  "payment_reference",
  "provider",
  "source",
  "status",
  "branch_uuid",
  "branch_name",
  "customer_name",
  "customer_phone",
  "currency",
  "amount_expected",
  "amount_paid",
  "checkout_snapshot",
  "order_id",
  "failure_reason",
  "expires_at",
  "paid_at",
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
  "metadata",
  "created_at"
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

function buildPaymentReference(order: JsonRecord, body: JsonRecord) {
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
  return paymentMethod === "bank_qr" || source === "qr_counter";
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
      .in("status", ["pending_payment", "paid", "converting", "converted"])
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

async function createSession(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const order = await readOrder(serviceClient, body);
  if (!order) return response({ ok: false, message: "Không tìm thấy đơn QR để tạo thanh toán." }, 404);
  if (!isQrPayableOrder(order)) {
    return response({ ok: false, message: "Đơn này không phải đơn thanh toán QR." }, 400);
  }

  const existing = await findSession(serviceClient, {
    ...body,
    order_id: toText(order.id)
  });
  if (existing) return response({ ok: true, session: existing, reused: true });

  const amountExpected = toMoney(order.total_amount || getObject(order.metadata).totalAmount);
  if (!amountExpected) {
    return response({ ok: false, message: "Đơn chưa có số tiền thanh toán hợp lệ." }, 400);
  }

  const paymentReference = buildPaymentReference(order, body);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const metadata = getObject(order.metadata);
  const branchUuid = toText(order.pickup_branch_uuid || order.branch_uuid) || null;
  const branchName = toText(order.pickup_branch_name || order.branch_name);

  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .insert({
      payment_reference: paymentReference,
      provider: "sepay",
      source: "qr_order",
      status: "pending_payment",
      branch_uuid: branchUuid,
      branch_name: branchName,
      cashier_name: "",
      customer_name: toText(order.customer_name || metadata.customerName),
      customer_phone: normalizePhone(order.customer_phone || metadata.customerPhone) || null,
      currency: "VND",
      amount_expected: amountExpected,
      amount_paid: 0,
      cart_snapshot: Array.isArray(metadata.items) ? metadata.items : [],
      checkout_snapshot: {
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

  await serviceClient
    .from("orders")
    .update({
      payment_method: "bank_qr",
      metadata: {
        ...metadata,
        paymentMethod: "bank_qr",
        paymentStatus: "unpaid",
        paymentAmount: amountExpected,
        paymentReference,
        qrPaymentSessionId: data.id
      },
      updated_at: now.toISOString()
    })
    .eq("id", toText(order.id));

  return response({ ok: true, session: data, reused: false });
}

async function readSession(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const session = await findSession(serviceClient, body);
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
