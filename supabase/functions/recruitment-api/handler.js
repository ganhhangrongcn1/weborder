/* global Response, TextEncoder, TextDecoder */
import { validateConfiguredApplication } from "../_shared/recruitmentForm.js";
import { readRecruitmentSettings, requireRecruitmentAdmin, handleRecruitmentAdmin } from "./admin.js";
import { drainRecruitmentNotifications, recruitmentZaloMessage } from "./notifications.js";

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readPayload(request) {
  // Bound streamed bodies too; Content-Length alone is not reliable.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_JSON");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32768) { await reader.cancel(); throw new Error("PAYLOAD_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function createRecruitmentHandler({ getClient, env, fetchImpl = fetch, onSaved = () => {} }) {
  return async function handle(request) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (env("RECRUITMENT_ALLOWED_ORIGINS") || "https://ganhhangrong.vn").split(",").map((value) => value.trim());
    const originAllowed = !origin || allowedOrigins.includes(origin);
    const headers = {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization"
    };
    if (origin && originAllowed) headers["Access-Control-Allow-Origin"] = origin;
    const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!originAllowed) return respond({ ok: false, message: "Nguồn gửi không hợp lệ." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return respond({ ok: false, message: "Method not allowed." }, 405);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return respond({ ok: false, message: "Định dạng gửi không hợp lệ." }, 415);
    }
    let payload;
    try { payload = await readPayload(request); }
    catch (error) { return respond({ ok: false, message: "Nội dung gửi không hợp lệ." }, error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return respond({ ok: false }, 400);
    if (payload.action === "claim_delivery") {
      const token = env("RECRUITMENT_N8N_WEBHOOK_SECRET");
      if (!token || request.headers.get("authorization") !== `Bearer ${token}`) return respond({ ok: false }, 401);
      if (!/^[0-9a-f-]{36}$/i.test(payload.applicationId || "") || !/^[0-9a-f-]{36}$/i.test(payload.lease || "")) return respond({ ok: false }, 400);
      try {
        const { data, error } = await getClient().rpc("authorize_recruitment_delivery", { p_id: payload.applicationId, p_lease: payload.lease });
        if (error || !data) throw new Error("DELIVERY_GATE_FAILED");
        return respond({ ok: true, applicationId: payload.applicationId, allowed: data.allowed === true,
          sent: data.sent === true, ...(data.allowed ? { message: recruitmentZaloMessage(data.row) } : {}) });
      } catch { return respond({ ok: false, code: "DELIVERY_GATE_FAILED" }, 503); }
    }
    if (payload.action === "get_form") {
      try { return respond({ ok: true, ...await readRecruitmentSettings(getClient()) }); }
      catch { return respond({ ok: false, message: "Chưa tải được form tuyển dụng. Bạn thử lại sau nha." }, 503); }
    }
    if (String(payload.action || "").startsWith("admin_")) {
      try {
        const client = getClient();
        if (!await requireRecruitmentAdmin(request, client)) return respond({ ok: false, message: "Tài khoản chưa có quyền quản trị tuyển dụng." }, 403);
        return respond(await handleRecruitmentAdmin(payload, client));
      } catch (error) { return respond({ ok: false, message: error.message || "Chưa xử lý được yêu cầu." }, 400); }
    }
    if (payload.action === "retry_notifications") {
      const secret = env("RECRUITMENT_DISPATCH_SECRET");
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return respond({ ok: false }, 401);
      try {
        return respond({ ok: true, ...await drainRecruitmentNotifications({ client: getClient(), env, fetchImpl }) });
      } catch { return respond({ ok: false, code: "DISPATCH_FAILED" }, 503); }
    }
    if (payload.action !== "submit") return respond({ ok: false }, 400);
    if (env("RECRUITMENT_INTAKE_ENABLED") !== "true") {
      return respond({ ok: false, message: "Hệ thống nhận hồ sơ đang tạm chưa sẵn sàng. Bạn thử lại sau nha." }, 503);
    }
    if (payload.application?.website) return respond({ ok: false, message: "Chưa gửi được hồ sơ." }, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.requestId || "")) {
      return respond({ ok: false, message: "Mã gửi không hợp lệ. Bạn tải lại trang giúp Gánh nha." }, 400);
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    let settings;
    try { settings = await readRecruitmentSettings(getClient()); }
    catch { return respond({ ok: false, message: "Chưa tải được cấu hình nhận hồ sơ." }, 503); }
    if (payload.formVersion !== settings.revision) return respond({ ok: false, message: "Form đã được cập nhật. Bạn tải lại trang và kiểm tra câu hỏi mới nha." }, 409);
    if (!settings.config.accepting) return respond({ ok: false, message: "Gánh đang tạm ngưng nhận hồ sơ." }, 503);
    const { data, valid, errors } = validateConfiguredApplication(payload.application, settings.config, today);
    if (!valid) return respond({ ok: false, message: "Bạn kiểm tra các mục được đánh dấu nha.", fields: errors }, 400);
    const salt = env("RECRUITMENT_HASH_SECRET");
    if (!salt) return respond({ ok: false, message: "Hệ thống đang tạm chưa sẵn sàng." }, 503);
    try {
      const fingerprint = await digest(`${salt}:${settings.revision}:${JSON.stringify(data)}`);
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const ipHash = await digest(`${salt}:${ip}`);
      const { data: saved, error } = await getClient().rpc("submit_recruitment_application", {
        p_request_id: payload.requestId, p_fingerprint: fingerprint, p_ip_hash: ipHash, p_application: data,
        p_snapshot: settings.config, p_version: settings.revision
      });
      if (error) {
        if (error.message?.includes("RATE_LIMITED")) return respond({ ok: false, message: "Bạn đã gửi nhiều hồ sơ trong thời gian ngắn. Bạn thử lại sau nha." }, 429);
        if (error.message?.includes("REQUEST_CONFLICT")) return respond({ ok: false, message: "Mã gửi đã được sử dụng cho nội dung khác. Bạn tải lại trang nha." }, 409);
        if (error.message?.includes("FORM_CHANGED")) return respond({ ok: false, message: "Form vừa được cập nhật. Bạn tải lại trang nha." }, 409);
        throw new Error("SAVE_FAILED");
      }
      if (!saved?.applicationId) throw new Error("SAVE_UNCONFIRMED");
      // SQL insert and pending outbox are one durable transaction. Never report notification success here.
      try { onSaved(); } catch { /* A scheduling error must not change an already committed receipt. */ }
      return respond({ ok: true, applicationId: saved.applicationId, duplicate: saved.duplicate === true });
    } catch {
      return respond({ ok: false, message: "Chưa lưu được hồ sơ. Bạn thử gửi lại nha; nội dung vẫn được giữ ở đây." }, 503);
    }
  };
}
