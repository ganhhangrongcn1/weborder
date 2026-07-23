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

const POS_PAYMENT_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

const SESSION_COLUMNS = [
  "id",
  "payment_reference",
  "request_key",
  "provider",
  "source",
  "status",
  "branch_uuid",
  "pos_shift_id",
  "branch_name",
  "cashier_name",
  "customer_name",
  "customer_phone",
  "pager_number",
  "currency",
  "amount_expected",
  "amount_paid",
  "cart_snapshot",
  "checkout_snapshot",
  "provider_payload",
  "order_id",
  "failure_reason",
  "expires_at",
  "paid_at",
  "cancelled_at",
  "converted_at",
  "created_at",
  "updated_at"
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

function isPaidMetadata(metadata: JsonRecord) {
  return toText(metadata.paymentStatus || metadata.payment_status).toLowerCase() === "paid";
}

function normalizePhone(value: unknown = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return digits;
}

function isUuid(value: unknown = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(toText(value));
}

function isSupportedSource(value: string) {
  return ["pos", "web", "qr_order"].includes(value);
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
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawData)));
  return Array.from(signature).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createMomoPayment(
  serviceClient: ReturnType<typeof createClient>,
  session: JsonRecord,
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
  const orderInfo = `Thanh toan bill ${orderId} tai Ganh Hang Rong`;
  const extraData = btoa(JSON.stringify({ sessionId: toText(session.id), source: "pos" }));
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
  const result = await fetch(apiEndpoint, {
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
  });
  const momoResponse = getObject(await result.json().catch(() => ({})));
  if (!result.ok || Number(momoResponse.resultCode) !== 0 || !toText(momoResponse.payUrl)) {
    throw new Error(toText(momoResponse.message) || `MoMo HTTP ${result.status}`);
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

const POS_MANAGED_SESSION_SOURCES = ["pos", "web", "qr_order"];

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

async function requireStaff(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceClient: ReturnType<typeof createClient>
) {
  const authorization = toText(request.headers.get("Authorization"));
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "missing_access_token", profile: null };

  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  const authUserId = toText(authData?.user?.id);
  if (authError || !authUserId) {
    return { error: "invalid_access_token", profile: null };
  }

  let { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError) {
    console.error("[pos-payment-session-api] profile lookup failed", {
      code: toText(profileError.code),
      message: toText(profileError.message),
      details: toText(profileError.details),
      hint: toText(profileError.hint)
    });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    const fallback = await userClient
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    profile = fallback.data;
    profileError = fallback.error;

    if (profileError) {
      console.error("[pos-payment-session-api] user-scoped profile lookup failed", {
        code: toText(profileError.code),
        message: toText(profileError.message),
        details: toText(profileError.details),
        hint: toText(profileError.hint)
      });
      return {
        error: "profile_lookup_failed",
        profile: null,
        debugCode: toText(profileError.code)
      };
    }
  }

  if (!profile) {
    return { error: "profile_not_found", profile: null };
  }
  const role = toText(profile.role).toLowerCase();
  const status = toText(profile.status).toLowerCase();
  if (status !== "active") {
    return { error: "profile_not_active", profile };
  }
  if (!["admin", "staff", "kitchen"].includes(role)) {
    return { error: "staff_access_required", profile };
  }

  return { error: "", profile };
}

function getAccessErrorMessage(reason: string) {
  if (reason === "missing_access_token") {
    return "POS chưa gửi phiên đăng nhập. Vui lòng đăng nhập lại.";
  }
  if (reason === "invalid_access_token") {
    return "Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (reason === "profile_not_found") {
    return "Không tìm thấy profile vận hành đã liên kết với tài khoản Auth.";
  }
  if (reason === "profile_lookup_failed") {
    return "Không đọc được profile nhân viên từ Supabase.";
  }
  if (reason === "profile_not_active") {
    return "Profile nhân viên hiện không ở trạng thái hoạt động.";
  }
  if (reason === "staff_access_required") {
    return "Tài khoản chưa có quyền vận hành POS.";
  }
  return "Phiên đăng nhập POS không hợp lệ.";
}

function canAccessBranch(profile: JsonRecord, branchUuid: string) {
  const role = toText(profile.role).toLowerCase();
  const profileBranchUuid = toText(profile.branch_uuid);
  if (role === "admin" && !profileBranchUuid) return true;
  return Boolean(branchUuid && profileBranchUuid === branchUuid);
}

async function readSession(
  serviceClient: ReturnType<typeof createClient>,
  sessionId: string
) {
  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();
  return { data, error };
}

async function createSession(
  serviceClient: ReturnType<typeof createClient>,
  profile: JsonRecord,
  body: JsonRecord
) {
  const paymentReference = toText(body.payment_reference).toUpperCase();
  const requestKey = toText(body.request_key);
  const source = toText(body.source).toLowerCase() || "pos";
  const branchUuid = toText(body.branch_uuid);
  const posShiftId = toText(body.pos_shift_id);
  const pagerNumber = toText(body.pager_number);
  const amountExpected = toMoney(body.amount_expected);
  const cartSnapshot = Array.isArray(body.cart_snapshot) ? body.cart_snapshot : [];
  const checkoutSnapshot = getObject(body.checkout_snapshot);
  const orderId = toText(body.order_id);
  const isPosSource = source === "pos";

  if (!paymentReference) {
    return response({ ok: false, message: "Thiếu mã thanh toán hoặc khóa yêu cầu." }, 400);
  }
  if (!isSupportedSource(source)) {
    return response({ ok: false, message: "Nguồn thanh toán không hợp lệ." }, 400);
  }
  if (!/^[A-Z0-9-]{6,80}$/.test(paymentReference)) {
    return response({ ok: false, message: "Mã thanh toán không hợp lệ." }, 400);
  }
  if (requestKey && !/^[A-Za-z0-9:_-]{6,120}$/.test(requestKey)) {
    return response({ ok: false, message: "Khóa yêu cầu không hợp lệ." }, 400);
  }
  if (!isUuid(branchUuid) || !canAccessBranch(profile, branchUuid)) {
    return response({ ok: false, message: "Tài khoản không có quyền tại chi nhánh này." }, 403);
  }
  if (posShiftId && !isUuid(posShiftId)) {
    return response({ ok: false, message: "Ca POS không hợp lệ." }, 400);
  }
  if (posShiftId) {
    const { data: shift, error: shiftError } = await serviceClient
      .from("pos_shifts")
      .select("id,branch_uuid,status")
      .eq("id", posShiftId)
      .eq("branch_uuid", branchUuid)
      .eq("status", "open")
      .maybeSingle();

    if (shiftError || !shift) {
      return response({ ok: false, message: "Ca POS không còn mở hoặc không thuộc chi nhánh này." }, 409);
    }
  }
  if (isPosSource && (!requestKey || !pagerNumber || !amountExpected || !cartSnapshot.length)) {
    return response({ ok: false, message: "Bill chưa đủ món, thẻ rung hoặc số tiền." }, 400);
  }
  if (!isPosSource && (!amountExpected || !orderId)) {
    return response({ ok: false, message: "Đơn pickup chưa đủ mã đơn hoặc số tiền để tạo QR." }, 400);
  }

  if (!isPosSource) {
    const { data: existingOrderSession } = await serviceClient
      .from("pos_payment_sessions")
      .select(SESSION_COLUMNS)
      .eq("branch_uuid", branchUuid)
      .eq("source", source)
      .eq("order_id", orderId)
      .in("status", ["draft", "pending_payment", "paid", "converting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOrderSession) {
      return response({ ok: true, session: existingOrderSession, reused: true });
    }
  }

  if (requestKey) {
    const { data: existing } = await serviceClient
      .from("pos_payment_sessions")
      .select(SESSION_COLUMNS)
      .or(`request_key.eq.${requestKey},payment_reference.eq.${paymentReference}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const sameBill =
        toText(existing.branch_uuid) === branchUuid &&
        toMoney(existing.amount_expected) === amountExpected;
      if (sameBill && ["draft", "pending_payment", "paid", "converting"].includes(toText(existing.status))) {
        return response({ ok: true, session: existing, reused: true });
      }
      return response({ ok: false, message: "Mã thanh toán đã được dùng cho bill khác." }, 409);
    }
  }

  const { data: referenceSession } = await serviceClient
    .from("pos_payment_sessions")
    .select(SESSION_COLUMNS)
    .eq("payment_reference", paymentReference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (referenceSession) {
    return response({ ok: false, message: "Mã thanh toán đã được dùng cho bill khác." }, 409);
  }

  const { data: pagerSession } = isPosSource
    ? await serviceClient
        .from("pos_payment_sessions")
        .select("id,payment_reference,status,pager_number")
        .eq("branch_uuid", branchUuid)
        .eq("pager_number", pagerNumber)
        .in("status", ["draft", "pending_payment", "paid", "converting"])
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (isPosSource && pagerSession) {
    return response({
      ok: false,
      code: "pager_in_use",
      message: `Thẻ rung ${pagerNumber} đang có bill chờ thanh toán.`
    }, 409);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + POS_PAYMENT_SESSION_TIMEOUT_MS).toISOString();
  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .insert({
      payment_reference: paymentReference,
      request_key: requestKey || null,
      provider: toText(body.provider).toLowerCase() || "sepay",
      source,
      status: "pending_payment",
      branch_uuid: branchUuid,
      pos_shift_id: posShiftId || null,
      branch_name: toText(body.branch_name),
      cashier_name: toText(profile.name || profile.email || body.cashier_name),
      customer_name: toText(body.customer_name),
      customer_phone: normalizePhone(body.customer_phone) || null,
      pager_number: pagerNumber,
      currency: "VND",
      amount_expected: amountExpected,
      amount_paid: 0,
      cart_snapshot: cartSnapshot,
      checkout_snapshot: checkoutSnapshot,
      provider_payload: {},
      order_id: orderId || null,
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    return response({ ok: false, message: error.message || "Không tạo được phiên thanh toán." }, 500);
  }

  if (toText(data.provider).toLowerCase() === "momo") {
    try {
      const momoSession = await createMomoPayment(serviceClient, data, toText(Deno.env.get("SUPABASE_URL")));
      return response({ ok: true, session: momoSession, reused: false });
    } catch (error) {
      await serviceClient.from("pos_payment_sessions").update({
        status: "failed",
        failure_reason: error instanceof Error ? error.message : "Không tạo được giao dịch MoMo.",
        updated_at: new Date().toISOString()
      }).eq("id", toText(data.id));
      return response({ ok: false, message: error instanceof Error ? error.message : "Không tạo được giao dịch MoMo." }, 502);
    }
  }

  return response({ ok: true, session: data, reused: false });
}

async function updateSession(
  serviceClient: ReturnType<typeof createClient>,
  profile: JsonRecord,
  body: JsonRecord,
  action: string
) {
  const sessionId = toText(body.session_id);
  if (!isUuid(sessionId)) {
    return response({ ok: false, message: "Mã phiên thanh toán không hợp lệ." }, 400);
  }

  const current = await readSession(serviceClient, sessionId);
  if (current.error || !current.data) {
    return response({ ok: false, message: "Không tìm thấy phiên thanh toán." }, 404);
  }
  if (!canAccessBranch(profile, toText(current.data.branch_uuid))) {
    return response({ ok: false, message: "Tài khoản không có quyền tại chi nhánh này." }, 403);
  }

  const now = new Date().toISOString();
  let patch: JsonRecord = { updated_at: now };
  let allowedStatuses: string[] = [];

  if (action === "cancel") {
    patch = {
      ...patch,
      status: "cancelled",
      cancelled_at: now,
      failure_reason: toText(body.reason) || "Nhân viên hủy trước khi thanh toán"
    };
    allowedStatuses = ["draft", "pending_payment"];
  } else if (action === "confirm_paid") {
    patch = {
      ...patch,
      status: "paid",
      amount_paid: toMoney(current.data.amount_expected),
      paid_at: now,
      provider_payload: {
        ...getObject(current.data.provider_payload),
        manualConfirmation: {
          confirmedAt: now,
          confirmedBy: toText(profile.name || profile.email || profile.id)
        }
      }
    };
    allowedStatuses = ["pending_payment"];
  } else if (action === "convert") {
    const orderId = toText(body.order_id);
    if (!orderId) {
      return response({ ok: false, message: "Thiếu mã đơn sau thanh toán." }, 400);
    }
    patch = {
      ...patch,
      status: "converted",
      order_id: orderId,
      converted_at: now
    };
    allowedStatuses = ["paid", "converting", "converted"];
  } else {
    return response({ ok: false, message: "Thao tác không hợp lệ." }, 400);
  }

  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .update(patch)
    .eq("id", sessionId)
    .in("status", allowedStatuses)
    .select(SESSION_COLUMNS)
    .maybeSingle();

  if (error) {
    return response({ ok: false, message: error.message || "Không cập nhật được phiên thanh toán." }, 500);
  }
  if (!data) {
    return response({
      ok: false,
      message: action === "cancel"
        ? "Phiên đã nhận tiền nên không thể hủy."
        : "Trạng thái phiên thanh toán đã thay đổi."
    }, 409);
  }

  return response({ ok: true, session: data });
}

async function getSession(
  serviceClient: ReturnType<typeof createClient>,
  profile: JsonRecord,
  body: JsonRecord
) {
  const sessionId = toText(body.session_id);
  if (!isUuid(sessionId)) {
    return response({ ok: false, message: "Mã phiên thanh toán không hợp lệ." }, 400);
  }

  const current = await readSession(serviceClient, sessionId);
  if (current.error || !current.data) {
    return response({ ok: false, message: "Không tìm thấy phiên thanh toán." }, 404);
  }
  if (!canAccessBranch(profile, toText(current.data.branch_uuid))) {
    return response({ ok: false, message: "Tài khoản không có quyền tại chi nhánh này." }, 403);
  }

  return response({ ok: true, session: current.data });
}

async function cancelExpiredQrOrderSessions(
  serviceClient: ReturnType<typeof createClient>,
  expiredSessions: JsonRecord[],
  now: string
) {
  for (const session of expiredSessions) {
    const orderId = toText(session.order_id);
    if (!orderId) continue;

    const { data: order } = await serviceClient
      .from("orders")
      .select("id,status,kitchen_status,payment_method,metadata")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) continue;

    const metadata = getObject(order.metadata);
    if (isPaidMetadata(metadata)) continue;

    const nextMetadata = {
      ...metadata,
      status: "cancelled",
      orderStatus: "cancelled",
      kitchenStatus: "cancelled",
      paymentMethod: "bank_qr",
      paymentStatus: "expired",
      paymentExpiredAt: now,
      cancelReason: "payment_timeout",
      cancelledBy: "qr_payment_timeout",
      qrPaymentSessionId: toText(session.id) || metadata.qrPaymentSessionId,
      paymentReference: toText(session.payment_reference) || metadata.paymentReference || metadata.payment_reference
    };

    await serviceClient
      .from("orders")
      .update({
        status: "cancelled",
        kitchen_status: "cancelled",
        payment_method: "bank_qr",
        metadata: nextMetadata,
        updated_at: now
      })
      .eq("id", orderId);
  }
}

async function listSessions(
  serviceClient: ReturnType<typeof createClient>,
  profile: JsonRecord,
  body: JsonRecord
) {
  const branchUuid = toText(body.branch_uuid);
  if (!isUuid(branchUuid) || !canAccessBranch(profile, branchUuid)) {
    return response({ ok: false, message: "Tài khoản không có quyền tại chi nhánh này." }, 403);
  }

  const now = new Date().toISOString();
  const { data: expiredQrOrderSessions } = await serviceClient
    .from("pos_payment_sessions")
    .select("id,order_id,payment_reference")
    .eq("branch_uuid", branchUuid)
    .eq("source", "qr_order")
    .eq("status", "pending_payment")
    .lt("expires_at", now);

  const { error: expireError } = await serviceClient
    .from("pos_payment_sessions")
    .update({
      status: "expired",
      failure_reason: "Phiên QR hết hạn thanh toán",
      cancelled_at: now,
      updated_at: now
    })
    .eq("branch_uuid", branchUuid)
    .in("source", POS_MANAGED_SESSION_SOURCES)
    .eq("status", "pending_payment")
    .lt("expires_at", now);

  if (expireError) {
    console.warn("[pos-payment-session-api] expire sessions failed", {
      branchUuid,
      message: toText(expireError.message)
    });
  } else if (Array.isArray(expiredQrOrderSessions) && expiredQrOrderSessions.length) {
    await cancelExpiredQrOrderSessions(serviceClient, expiredQrOrderSessions, now);
  }

  const { data, error } = await serviceClient
    .from("pos_payment_sessions")
    .select(SESSION_COLUMNS)
    .eq("branch_uuid", branchUuid)
    .in("source", POS_MANAGED_SESSION_SOURCES)
    .in("status", ["draft", "pending_payment", "paid", "converting"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return response({
      ok: false,
      message: error.message || "Không tải được các phiên QR đang xử lý."
    }, 500);
  }

  return response({ ok: true, sessions: data || [] });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ ok: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const anonKey = toText(Deno.env.get("SUPABASE_ANON_KEY"));
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return response({ ok: false, message: "Thiếu cấu hình Supabase Function." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const access = await requireStaff(request, supabaseUrl, anonKey, serviceClient);
  if (access.error || !access.profile) {
    const debugCode = toText((access as JsonRecord).debugCode);
    console.warn("[pos-payment-session-api] access denied", {
      reason: access.error
    });
    return response({
      ok: false,
      code: access.error,
      message: debugCode
        ? `${getAccessErrorMessage(access.error)} (${debugCode})`
        : getAccessErrorMessage(access.error)
    }, 401);
  }

  const payload = getObject(await request.json().catch(() => ({})));
  const action = toText(payload.action).toLowerCase();
  console.log("[pos-payment-session-api] request", {
    action,
    profileId: toText(access.profile.id),
    role: toText(access.profile.role),
    profileBranchUuid: toText(access.profile.branch_uuid),
    requestedBranchUuid: toText(getObject(payload.session).branch_uuid)
  });
  if (action === "create") {
    return createSession(serviceClient, access.profile, getObject(payload.session));
  }
  if (action === "read") {
    return getSession(serviceClient, access.profile, payload);
  }
  if (action === "list") {
    return listSessions(serviceClient, access.profile, payload);
  }
  if (["cancel", "confirm_paid", "convert"].includes(action)) {
    if (
      action === "confirm_paid" &&
      !["admin", "staff"].includes(toText(access.profile.role).toLowerCase())
    ) {
      return response({
        ok: false,
        message: "Chỉ admin được xác nhận thanh toán QR bằng tay."
      }, 403);
    }
    return updateSession(serviceClient, access.profile, payload, action);
  }

  return response({ ok: false, message: "Thao tác không được hỗ trợ." }, 400);
});
