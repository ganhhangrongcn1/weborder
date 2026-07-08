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

const OPERATIONAL_ROLES = new Set(["admin", "staff", "kitchen"]);

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown = "") {
  return toText(value).toLowerCase();
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

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function mapProfile(profile: JsonRecord, branchName = "") {
  return {
    id: toText(profile.id),
    auth_user_id: toText(profile.auth_user_id),
    phone: toText(profile.phone),
    name: toText(profile.name),
    email: toText(profile.email),
    role: toText(profile.role),
    status: toText(profile.status || "active"),
    branch_uuid: toText(profile.branch_uuid),
    branch_name: branchName,
    created_at: toText(profile.created_at),
    updated_at: toText(profile.updated_at)
  };
}

async function requireAdmin(
  request: Request,
  serviceClient: ReturnType<typeof createClient>
) {
  const authorization = toText(request.headers.get("Authorization"));
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "missing_access_token", profile: null as JsonRecord | null };

  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  const authUserId = toText(authData?.user?.id);
  if (authError || !authUserId) {
    return { error: "invalid_access_token", profile: null as JsonRecord | null };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError) {
    console.error("[branch-account-api] admin profile lookup failed", profileError);
    return { error: "profile_lookup_failed", profile: null as JsonRecord | null };
  }
  if (!profile) return { error: "profile_not_found", profile: null as JsonRecord | null };

  const role = toText(profile.role).toLowerCase();
  const status = toText(profile.status).toLowerCase();
  if (status !== "active") return { error: "profile_not_active", profile };
  if (role !== "admin") return { error: "admin_access_required", profile };

  return { error: "", profile };
}

function accessMessage(reason: string) {
  if (reason === "missing_access_token") return "Admin chưa gửi phiên đăng nhập. Vui lòng đăng nhập lại.";
  if (reason === "invalid_access_token") return "Phiên đăng nhập admin đã hết hạn. Vui lòng đăng nhập lại.";
  if (reason === "profile_not_found") return "Không tìm thấy profile admin liên kết với tài khoản Auth.";
  if (reason === "profile_lookup_failed") return "Không đọc được profile admin từ Supabase.";
  if (reason === "profile_not_active") return "Profile admin hiện không ở trạng thái hoạt động.";
  if (reason === "admin_access_required") return "Chỉ tài khoản admin mới được tạo tài khoản chi nhánh.";
  return "Phiên đăng nhập admin không hợp lệ.";
}

function canManageBranch(adminProfile: JsonRecord, branchUuid: string) {
  const adminBranchUuid = toText(adminProfile.branch_uuid);
  return !adminBranchUuid || adminBranchUuid === branchUuid;
}

async function readBranch(
  serviceClient: ReturnType<typeof createClient>,
  branchUuid: string
) {
  const { data, error } = await serviceClient
    .from("branches")
    .select("branch_uuid,name,branch_code")
    .eq("branch_uuid", branchUuid)
    .maybeSingle();
  return { data, error };
}

async function listAccounts(
  serviceClient: ReturnType<typeof createClient>,
  adminProfile: JsonRecord
) {
  let query = serviceClient
    .from("profiles")
    .select("id,auth_user_id,phone,name,email,role,status,branch_uuid,created_at,updated_at")
    .in("role", ["admin", "staff", "kitchen"])
    .order("updated_at", { ascending: false });

  const adminBranchUuid = toText(adminProfile.branch_uuid);
  if (adminBranchUuid) query = query.eq("branch_uuid", adminBranchUuid);

  const { data, error } = await query;
  if (error) {
    console.error("[branch-account-api] list profiles failed", error);
    return response({ ok: false, message: "Không tải được danh sách tài khoản chi nhánh." }, 500);
  }

  const branchUuids = Array.from(new Set((data || []).map((item: JsonRecord) => toText(item.branch_uuid)).filter(Boolean)));
  const branchNameByUuid = new Map<string, string>();
  if (branchUuids.length) {
    const { data: branches } = await serviceClient
      .from("branches")
      .select("branch_uuid,name,branch_code")
      .in("branch_uuid", branchUuids);
    (branches || []).forEach((branch: JsonRecord) => {
      const code = toText(branch.branch_code);
      const name = toText(branch.name);
      branchNameByUuid.set(toText(branch.branch_uuid), code ? `${code} - ${name}` : name);
    });
  }

  return response({
    ok: true,
    accounts: (data || []).map((profile: JsonRecord) => mapProfile(profile, branchNameByUuid.get(toText(profile.branch_uuid)) || ""))
  });
}

async function createAccount(
  serviceClient: ReturnType<typeof createClient>,
  adminProfile: JsonRecord,
  body: JsonRecord
) {
  const phone = normalizePhone(body.phone);
  const name = toText(body.name);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const role = toText(body.role).toLowerCase() || "staff";
  const status = toText(body.status).toLowerCase() || "active";
  const branchUuid = toText(body.branch_uuid || body.branchUuid);

  if (!phone || phone.length < 9) {
    return response({ ok: false, message: "Số điện thoại tài khoản chưa hợp lệ." }, 400);
  }
  if (!email || !email.includes("@")) {
    return response({ ok: false, message: "Email đăng nhập chưa hợp lệ." }, 400);
  }
  if (password.length < 8) {
    return response({ ok: false, message: "Mật khẩu tạm phải có ít nhất 8 ký tự." }, 400);
  }
  if (!OPERATIONAL_ROLES.has(role)) {
    return response({ ok: false, message: "Quyền tài khoản chỉ hỗ trợ admin, staff hoặc kitchen." }, 400);
  }
  if (!["active", "inactive"].includes(status)) {
    return response({ ok: false, message: "Trạng thái tài khoản không hợp lệ." }, 400);
  }
  if (!isUuid(branchUuid)) {
    return response({ ok: false, message: "Vui lòng chọn chi nhánh hợp lệ cho tài khoản." }, 400);
  }
  if (!canManageBranch(adminProfile, branchUuid)) {
    return response({ ok: false, message: "Admin này không có quyền tạo tài khoản cho chi nhánh đã chọn." }, 403);
  }

  const { data: branch, error: branchError } = await readBranch(serviceClient, branchUuid);
  if (branchError || !branch) {
    return response({ ok: false, message: "Không tìm thấy chi nhánh trong Supabase." }, 404);
  }

  const { data: existingPhoneProfile } = await serviceClient
    .from("profiles")
    .select("id,email,phone,role,auth_user_id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
  const { data: existingEmailProfile } = await serviceClient
    .from("profiles")
    .select("id,email,phone,role,auth_user_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  const existingProfile = existingPhoneProfile || existingEmailProfile;
  if (existingProfile?.auth_user_id) {
    return response({ ok: false, message: "Email hoặc số điện thoại này đã gắn với tài khoản Auth khác." }, 409);
  }

  const { data: authResult, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      phone,
      role,
      branch_uuid: branchUuid
    }
  });

  const authUserId = toText(authResult?.user?.id);
  if (createUserError || !authUserId) {
    console.error("[branch-account-api] create auth user failed", createUserError);
    return response({
      ok: false,
      message: "Không tạo được Auth user. Email có thể đã tồn tại trong Supabase Auth."
    }, 409);
  }

  const metadata = {
    branch_uuid: branchUuid,
    branch_name: toText(branch.name),
    branch_alias: toText(branch.branch_code).toLowerCase()
  };

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .upsert({
      phone,
      name: name || null,
      email,
      auth_user_id: authUserId,
      role,
      status,
      registered: true,
      branch_uuid: branchUuid,
      metadata,
      updated_at: new Date().toISOString()
    }, { onConflict: "phone" })
    .select("id,auth_user_id,phone,name,email,role,status,branch_uuid,created_at,updated_at")
    .maybeSingle();

  if (profileError || !profile) {
    console.error("[branch-account-api] upsert profile failed", profileError);
    await serviceClient.auth.admin.deleteUser(authUserId).catch((cleanupError: unknown) => {
      console.error("[branch-account-api] cleanup auth user failed", cleanupError);
    });
    return response({ ok: false, message: "Đã hủy Auth user vì không lưu được profile chi nhánh." }, 500);
  }

  return response({
    ok: true,
    message: "Đã tạo tài khoản chi nhánh.",
    account: mapProfile(profile, toText(branch.name))
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ ok: false, message: "Method không được hỗ trợ." }, 405);
  }

  const supabaseUrl = toText(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = toText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ ok: false, message: "Thiếu cấu hình Supabase service role cho Edge Function." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const access = await requireAdmin(request, serviceClient);
  if (access.error || !access.profile) {
    return response({ ok: false, message: accessMessage(access.error) }, 403);
  }

  let body: JsonRecord = {};
  try {
    body = getObject(await request.json());
  } catch {
    return response({ ok: false, message: "Payload không hợp lệ." }, 400);
  }

  const action = toText(body.action).toLowerCase();
  if (action === "list") return listAccounts(serviceClient, access.profile);
  if (action === "create") return createAccount(serviceClient, access.profile, body);

  return response({ ok: false, message: "Action không được hỗ trợ." }, 400);
});
