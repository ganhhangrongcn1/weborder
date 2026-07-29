import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function text(value: unknown = "") { return String(value ?? "").trim(); }
function json(body: JsonRecord, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }); }
function uuid(value: unknown) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)); }
function phone(value: unknown) { const digits = text(value).replace(/\D/g, ""); return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits; }
function branches(value: unknown) { return Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter(uuid))); }

async function requireAdmin(request: Request, client: ReturnType<typeof createClient>) {
  const token = text(request.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await client.auth.getUser(token);
  if (!data?.user?.id) return false;
  const { data: profile } = await client.from("profiles").select("role,status").eq("auth_user_id", data.user.id).maybeSingle();
  return text(profile?.role).toLowerCase() === "admin" && text(profile?.status).toLowerCase() === "active";
}

async function listAccounts(client: ReturnType<typeof createClient>) {
  const { data: accessRows, error } = await client.from("checklist_user_access").select("auth_user_id,branch_uuid,is_active,created_at").eq("role", "supervisor").order("created_at", { ascending: false });
  if (error) return json({ ok: false, message: "Không tải được danh sách tài khoản giám sát." }, 500);
  const userIds = Array.from(new Set((accessRows || []).map((row: JsonRecord) => text(row.auth_user_id)).filter(Boolean)));
  if (!userIds.length) return json({ ok: true, accounts: [] });
  const [{ data: profiles }, { data: branchRows }] = await Promise.all([
    client.from("profiles").select("auth_user_id,name,email,phone,status,created_at").in("auth_user_id", userIds),
    client.from("branches").select("branch_uuid,name,branch_code")
  ]);
  const profileMap = new Map((profiles || []).map((row: JsonRecord) => [text(row.auth_user_id), row]));
  const branchMap = new Map((branchRows || []).map((row: JsonRecord) => [text(row.branch_uuid), row]));
  const accounts = userIds.map((authUserId) => {
    const profile = profileMap.get(authUserId) || {};
    const grants = (accessRows || []).filter((row: JsonRecord) => text(row.auth_user_id) === authUserId);
    const branchUuids = grants.filter((row: JsonRecord) => row.is_active && row.branch_uuid).map((row: JsonRecord) => text(row.branch_uuid));
    return { auth_user_id: authUserId, name: text(profile.name), email: text(profile.email), phone: text(profile.phone), status: text(profile.status || "inactive"), created_at: text(profile.created_at), branch_uuids: branchUuids, branch_names: branchUuids.map((id) => text(branchMap.get(id)?.name)).filter(Boolean) };
  });
  return json({ ok: true, accounts });
}

async function replaceAccess(client: ReturnType<typeof createClient>, authUserId: string, branchUuids: string[], active: boolean) {
  const { error: disableError } = await client.from("checklist_user_access").update({ is_active: false, updated_at: new Date().toISOString() }).eq("auth_user_id", authUserId).eq("role", "supervisor");
  if (disableError) throw disableError;
  if (!active || !branchUuids.length) return;
  const { error } = await client.from("checklist_user_access").upsert(branchUuids.map((branchUuid) => ({ auth_user_id: authUserId, branch_uuid: branchUuid, role: "supervisor", is_active: true })), { onConflict: "auth_user_id,branch_uuid,role" });
  if (error) throw error;
}

async function createAccount(client: ReturnType<typeof createClient>, body: JsonRecord) {
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const normalizedPhone = phone(body.phone);
  const password = String(body.password ?? "");
  const branchUuids = branches(body.branch_uuids);
  if (!name) return json({ ok: false, message: "Vui lòng nhập họ tên giám sát." }, 400);
  if (!email.includes("@")) return json({ ok: false, message: "Email đăng nhập chưa hợp lệ." }, 400);
  if (normalizedPhone.length < 9) return json({ ok: false, message: "Số điện thoại chưa hợp lệ." }, 400);
  if (password.length < 8) return json({ ok: false, message: "Mật khẩu tạm phải có ít nhất 8 ký tự." }, 400);
  if (!branchUuids.length) return json({ ok: false, message: "Hãy phân ít nhất một chi nhánh." }, 400);
  const { data: auth, error: authError } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone: normalizedPhone } });
  const authUserId = text(auth?.user?.id);
  if (authError || !authUserId) return json({ ok: false, message: "Không tạo được tài khoản. Email có thể đã tồn tại." }, 409);
  const { error: profileError } = await client.from("profiles").upsert({ phone: normalizedPhone, name, email, auth_user_id: authUserId, role: "supervisor", status: "active", registered: true, branch_uuid: branchUuids[0], metadata: { checklist_role: "supervisor" }, updated_at: new Date().toISOString() }, { onConflict: "phone" });
  if (profileError) { await client.auth.admin.deleteUser(authUserId); return json({ ok: false, message: "Đã hủy tài khoản vì không lưu được hồ sơ giám sát." }, 500); }
  try { await replaceAccess(client, authUserId, branchUuids, true); }
  catch { await client.from("profiles").delete().eq("auth_user_id", authUserId); await client.auth.admin.deleteUser(authUserId); return json({ ok: false, message: "Đã hủy tài khoản vì không lưu được phạm vi chi nhánh." }, 500); }
  return json({ ok: true, message: "Đã tạo tài khoản giám sát." });
}

async function updateAccount(client: ReturnType<typeof createClient>, body: JsonRecord) {
  const authUserId = text(body.auth_user_id);
  const branchUuids = branches(body.branch_uuids);
  const active = body.is_active === true;
  if (!uuid(authUserId)) return json({ ok: false, message: "Tài khoản giám sát không hợp lệ." }, 400);
  if (active && !branchUuids.length) return json({ ok: false, message: "Tài khoản hoạt động cần ít nhất một chi nhánh." }, 400);
  const { error: profileError } = await client.from("profiles").update({ status: active ? "active" : "inactive", branch_uuid: branchUuids[0] || null, updated_at: new Date().toISOString() }).eq("auth_user_id", authUserId);
  if (profileError) return json({ ok: false, message: "Không cập nhật được trạng thái tài khoản." }, 500);
  try { await replaceAccess(client, authUserId, branchUuids, active); }
  catch { return json({ ok: false, message: "Không cập nhật được phạm vi chi nhánh." }, 500); }
  return json({ ok: true, message: active ? "Đã cập nhật quyền giám sát." : "Đã khóa quyền truy cập giám sát." });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, message: "Method không được hỗ trợ." }, 405);
  const url = text(Deno.env.get("SUPABASE_URL"));
  const secret = text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !secret) return json({ ok: false, message: "Thiếu cấu hình dịch vụ Supabase." }, 500);
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!await requireAdmin(request, client)) return json({ ok: false, message: "Chỉ Admin đang hoạt động mới được quản lý tài khoản giám sát." }, 403);
  let body: JsonRecord = {};
  try { body = await request.json(); } catch { return json({ ok: false, message: "Dữ liệu gửi lên không hợp lệ." }, 400); }
  const action = text(body.action);
  if (action === "list") return listAccounts(client);
  if (action === "create") return createAccount(client, body);
  if (action === "update") return updateAccount(client, body);
  return json({ ok: false, message: "Thao tác không được hỗ trợ." }, 400);
});
