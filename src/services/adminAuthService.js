import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

const ADMIN_AUTH_TIMEOUT_MS = 6000;
const PROFILE_TABLE = "profiles";
const ADMIN_ALLOWED_ROLES = new Set(["admin", "staff", "kitchen"]);
const PRIVILEGED_ROLES = ["admin", "staff", "kitchen", "shipper"];

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeProfile(profile = null) {
  if (!profile || typeof profile !== "object") return null;
  return {
    ...profile,
    email: normalizeEmail(profile.email),
    role: String(profile.role || "").trim().toLowerCase(),
    status: String(profile.status || "").trim().toLowerCase()
  };
}

function canAccessAdmin(profile = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return false;
  return normalized.status === "active" && ADMIN_ALLOWED_ROLES.has(normalized.role);
}

function buildUnauthorizedMessage(profile = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized) {
    return "Tài khoản này chưa được cấp quyền quản trị trong bảng profiles.";
  }
  if (normalized.status === "blocked") {
    return "Tài khoản quản trị này đang bị khóa.";
  }
  if (normalized.status && normalized.status !== "active") {
    return "Tài khoản quản trị này hiện chưa hoạt động.";
  }
  return "Tài khoản này không có quyền vào khu quản trị.";
}

async function withTimeout(task, timeoutMs = ADMIN_AUTH_TIMEOUT_MS) {
  let timer = null;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("admin_auth_timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getClientReady() {
  const existing = getSupabaseRuntimeClient();
  if (existing) return existing;
  const initialized = await withTimeout(() => initSupabaseRuntimeClient());
  if (initialized) return initialized;
  return getSupabaseRuntimeClient();
}

async function readPrivilegedProfile(client, session) {
  const authUserId = String(session?.user?.id || "").trim();
  const email = normalizeEmail(session?.user?.email);

  if (!authUserId && !email) return null;

  let profile = null;

  if (authUserId) {
    const { data, error } = await client
      .from(PROFILE_TABLE)
      .select("id, auth_user_id, phone, name, email, role, status, registered")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw error;
    profile = data || null;
  }

  if (!profile && email) {
    const { data, error } = await client
      .from(PROFILE_TABLE)
      .select("id, auth_user_id, phone, name, email, role, status, registered")
      .ilike("email", email)
      .in("role", PRIVILEGED_ROLES)
      .maybeSingle();
    if (error) throw error;
    profile = data || null;
  }

  const normalized = normalizeProfile(profile);
  if (!normalized) return null;

  if (!normalized.auth_user_id && authUserId && normalized.email === email) {
    const { data, error } = await client
      .from(PROFILE_TABLE)
      .update({
        auth_user_id: authUserId,
        updated_at: new Date().toISOString()
      })
      .eq("id", normalized.id)
      .select("id, auth_user_id, phone, name, email, role, status, registered")
      .maybeSingle();
    if (error) throw error;
    return normalizeProfile(data || normalized);
  }

  return normalized;
}

async function resolveAdminAccessFromSession(client, session) {
  if (!session) {
    return {
      session: null,
      rawSession: null,
      profile: null,
      unauthorized: false,
      message: "",
      error: null
    };
  }

  const profile = await readPrivilegedProfile(client, session);
  if (!canAccessAdmin(profile)) {
    return {
      session: null,
      rawSession: session,
      profile,
      unauthorized: true,
      message: buildUnauthorizedMessage(profile),
      error: null
    };
  }

  return {
    session,
    rawSession: session,
    profile,
    unauthorized: false,
    message: "",
    error: null
  };
}

export async function getAdminSession() {
  const client = await getClientReady();
  if (!client) {
    return {
      session: null,
      rawSession: null,
      profile: null,
      unauthorized: false,
      message: "",
      error: new Error("missing_supabase_client")
    };
  }
  try {
    const { data, error } = await withTimeout(() => client.auth.getSession());
    if (error) {
      return {
        session: null,
        rawSession: null,
        profile: null,
        unauthorized: false,
        message: "",
        error
      };
    }
    return await resolveAdminAccessFromSession(client, data?.session || null);
  } catch (error) {
    return {
      session: null,
      rawSession: null,
      profile: null,
      unauthorized: false,
      message: "",
      error
    };
  }
}

export async function loginAdminWithPassword({ email, password }) {
  let client = await getClientReady();
  if (!client) {
    await initSupabaseRuntimeClient();
    client = await getClientReady();
  }
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };

  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(password || "")
  });
  if (error) {
    return { ok: false, message: String(error.message || "Đăng nhập thất bại.") };
  }

  try {
    const access = await resolveAdminAccessFromSession(client, data?.session || null);
    if (!access.session) {
      await client.auth.signOut();
      return {
        ok: false,
        message: access.message || "Tài khoản này không có quyền vào khu quản trị."
      };
    }
    return { ok: true, session: access.session, profile: access.profile || null };
  } catch (accessError) {
    await client.auth.signOut();
    return {
      ok: false,
      message: String(accessError?.message || "Không thể xác minh quyền quản trị.")
    };
  }
}

export async function logoutAdmin() {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  const { error } = await client.auth.signOut();
  if (error) return { ok: false, message: String(error.message || "Đăng xuất thất bại.") };
  return { ok: true };
}

export async function subscribeAdminAuth(onChange) {
  const client = await getClientReady();
  if (!client || typeof onChange !== "function") return () => {};
  const { data } = client.auth.onAuthStateChange(async (_event, session) => {
    try {
      const access = await resolveAdminAccessFromSession(client, session || null);
      onChange(access);
    } catch (error) {
      onChange({
        session: null,
        rawSession: session || null,
        profile: null,
        unauthorized: Boolean(session),
        message: session ? "Không thể xác minh quyền quản trị." : "",
        error
      });
    }
  });
  return () => {
    data?.subscription?.unsubscribe?.();
  };
}
