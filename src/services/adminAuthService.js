import { getSupabaseAdminAuthClient, initSupabaseAdminAuthClient, syncScopedSessionToRuntime } from "./supabase/supabaseRuntimeClient.js";

const ADMIN_AUTH_TIMEOUT_MS = 6000;
const ADMIN_ACCESS_CACHE_MS = 2500;
const PROFILE_TABLE = "profiles";
const ADMIN_ALLOWED_ROLES = new Set(["admin", "staff", "kitchen"]);
let cachedAdminAccess = null;
let adminAccessInFlight = null;
let adminAccessInFlightKey = "";

function getAdminAccessKey(session = null) {
  const authUserId = String(session?.user?.id || "").trim();
  const expiresAt = String(session?.expires_at || "").trim();
  if (!authUserId) return "";
  return `${authUserId}:${expiresAt}`;
}

function clearAdminAccessCache() {
  cachedAdminAccess = null;
  adminAccessInFlight = null;
  adminAccessInFlightKey = "";
}

function isTransientAdminAuthError(error) {
  const rawMessage = String(error?.message || error || "").trim().toLowerCase();
  return (
    rawMessage.includes("admin_auth_timeout") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("network") ||
    rawMessage.includes("timeout")
  );
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeProfile(profile = null) {
  if (!profile || typeof profile !== "object") return null;
  const metadata = profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {};
  return {
    ...profile,
    email: normalizeEmail(profile.email),
    role: String(profile.role || "").trim().toLowerCase(),
    status: String(profile.status || "").trim().toLowerCase(),
    metadata,
    branchName: String(profile.branch_name || profile.branchName || metadata.branch_name || metadata.branchName || "").trim(),
    branchAlias: String(profile.branch_alias || profile.branchAlias || metadata.branch_alias || metadata.branchAlias || "").trim(),
    branchUuid: String(profile.branch_uuid || profile.branchUuid || metadata.branch_uuid || metadata.branchUuid || "").trim(),
    isGlobalAdmin: String(profile.role || "").trim().toLowerCase() === "admin" &&
      !String(profile.branch_uuid || profile.branchUuid || metadata.branch_uuid || metadata.branchUuid || "").trim()
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

function normalizeAdminAuthError(error, fallbackMessage) {
  const rawMessage = String(error?.message || "").trim().toLowerCase();
  if (!rawMessage) return fallbackMessage;

  if (rawMessage.includes("invalid login credentials")) {
    return "Email hoặc mật khẩu admin chưa đúng.";
  }

  if (rawMessage.includes("email not confirmed")) {
    return "Email admin này chưa được xác nhận trong Supabase Auth.";
  }

  if (rawMessage.includes("admin_auth_timeout")) {
    return "Kết nối Supabase đang chậm hoặc bị treo. Bạn thử đăng nhập lại sau vài giây.";
  }

  if (rawMessage.includes("failed to fetch") || rawMessage.includes("network")) {
    return "Không kết nối được tới Supabase. Bạn kiểm tra mạng hoặc cấu hình rồi thử lại.";
  }

  return String(error?.message || fallbackMessage);
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
  const existing = getSupabaseAdminAuthClient();
  if (existing) return existing;
  const initialized = await withTimeout(() => initSupabaseAdminAuthClient());
  if (initialized) return initialized;
  return getSupabaseAdminAuthClient();
}

async function readPrivilegedProfile(client, session) {
  const authUserId = String(session?.user?.id || "").trim();
  if (!authUserId) return null;

  const { data, error } = await withTimeout(() =>
    client
      .from(PROFILE_TABLE)
      .select("id, auth_user_id, phone, name, email, role, status, registered, branch_uuid, metadata")
      .eq("auth_user_id", authUserId)
      .maybeSingle()
  );
  if (error) throw error;

  return normalizeProfile(data || null);
}

async function resolveAdminAccessFromSessionUncached(client, session) {
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

async function resolveAdminAccessFromSession(client, session) {
  if (!session) return resolveAdminAccessFromSessionUncached(client, null);

  const accessKey = getAdminAccessKey(session);
  const now = Date.now();
  if (
    cachedAdminAccess?.key === accessKey &&
    cachedAdminAccess.expiresAt > now
  ) {
    return cachedAdminAccess.value;
  }
  if (adminAccessInFlight && adminAccessInFlightKey === accessKey) {
    return adminAccessInFlight;
  }

  adminAccessInFlightKey = accessKey;
  adminAccessInFlight = resolveAdminAccessFromSessionUncached(client, session);

  try {
    const access = await adminAccessInFlight;
    cachedAdminAccess = {
      key: accessKey,
      expiresAt: Date.now() + ADMIN_ACCESS_CACHE_MS,
      value: access
    };
    return access;
  } finally {
    if (adminAccessInFlightKey === accessKey) {
      adminAccessInFlight = null;
      adminAccessInFlightKey = "";
    }
  }
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
    const access = await resolveAdminAccessFromSession(client, data?.session || null);
    await syncScopedSessionToRuntime("admin", access.session).catch(() => {});
    return access;
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
    await initSupabaseAdminAuthClient();
    client = await getClientReady();
  }
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };

  let data = null;

  try {
    const signInResult = await withTimeout(() =>
      client.auth.signInWithPassword({
        email: String(email || "").trim(),
        password: String(password || "")
      })
    );
    data = signInResult?.data || null;
    const error = signInResult?.error || null;
    if (error) {
      return { ok: false, message: normalizeAdminAuthError(error, "Đăng nhập thất bại.") };
    }
  } catch (error) {
    return { ok: false, message: normalizeAdminAuthError(error, "Đăng nhập thất bại.") };
  }

  try {
    const access = await withTimeout(() => resolveAdminAccessFromSession(client, data?.session || null));
    if (!access.session) {
      await withTimeout(() => client.auth.signOut()).catch(() => {});
      await syncScopedSessionToRuntime("admin", null).catch(() => {});
      return {
        ok: false,
        message: access.message || "Tài khoản này không có quyền vào khu quản trị."
      };
    }
    await syncScopedSessionToRuntime("admin", access.session).catch(() => {});
    return { ok: true, session: access.session, profile: access.profile || null };
  } catch (accessError) {
    await withTimeout(() => client.auth.signOut()).catch(() => {});
    await syncScopedSessionToRuntime("admin", null).catch(() => {});
    return {
      ok: false,
      message: normalizeAdminAuthError(accessError, "Không thể xác minh quyền quản trị.")
    };
  }
}

export async function logoutAdmin() {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  const { error } = await withTimeout(() => client.auth.signOut());
  if (error) return { ok: false, message: String(error.message || "Đăng xuất thất bại.") };
  clearAdminAccessCache();
  await syncScopedSessionToRuntime("admin", null).catch(() => {});
  return { ok: true };
}

export async function subscribeAdminAuth(onChange) {
  const client = await getClientReady();
  if (!client || typeof onChange !== "function") return () => {};
  let disposed = false;
  const pendingTimers = new Set();

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;

    const timer = setTimeout(async () => {
      pendingTimers.delete(timer);
      if (disposed) return;

      try {
        if (!session) {
          clearAdminAccessCache();
          onChange(await resolveAdminAccessFromSession(client, null));
          syncScopedSessionToRuntime("admin", null).catch(() => {});
          return;
        }

        const access = await resolveAdminAccessFromSession(client, session);
        await syncScopedSessionToRuntime("admin", access.session).catch(() => {});
        if (!disposed) onChange(access);
      } catch (error) {
        const isTransientError = Boolean(session) && isTransientAdminAuthError(error);
        if (disposed) return;
        onChange({
          session: isTransientError ? session : null,
          rawSession: session || null,
          profile: null,
          unauthorized: Boolean(session) && !isTransientError,
          transientAuthError: isTransientError,
          message: session ? normalizeAdminAuthError(error, "Không thể xác minh quyền quản trị.") : "",
          error
        });
      }
    }, 0);

    pendingTimers.add(timer);
  });

  return () => {
    disposed = true;
    pendingTimers.forEach((timer) => clearTimeout(timer));
    pendingTimers.clear();
    data?.subscription?.unsubscribe?.();
  };
}
