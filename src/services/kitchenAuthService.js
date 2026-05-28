import {
  getSupabaseKitchenAuthClient,
  initSupabaseKitchenAuthClient
} from "./supabase/supabaseRuntimeClient.js";

const AUTH_TIMEOUT_MS = 15000;
const PROFILE_TABLE = "profiles";
const KITCHEN_ALLOWED_ROLES = new Set(["admin", "staff", "kitchen"]);

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
    branchUuid: String(profile.branch_uuid || profile.branchUuid || metadata.branch_uuid || metadata.branchUuid || "").trim()
  };
}

function canAccessKitchen(profile = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return false;
  return normalized.status === "active" && KITCHEN_ALLOWED_ROLES.has(normalized.role);
}

function buildUnauthorizedMessage(profile = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return "Tài khoản này chưa được cấp quyền bếp trong bảng profiles.";
  if (normalized.status === "blocked") return "Tài khoản bếp này đang bị khóa.";
  if (normalized.status && normalized.status !== "active") return "Tài khoản bếp này hiện chưa hoạt động.";
  return "Tài khoản này không có quyền vào app bếp.";
}

function normalizeAuthError(error, fallbackMessage = "Đăng nhập thất bại.") {
  const rawMessage = String(error?.message || "").trim().toLowerCase();
  if (!rawMessage) return fallbackMessage;
  if (rawMessage.includes("invalid login credentials")) return "Email hoặc mật khẩu chưa đúng.";
  if (rawMessage.includes("email not confirmed")) return "Email này chưa được xác nhận trong Supabase Auth.";
  if (rawMessage.includes("timeout")) return "Kết nối Supabase đang chậm. Bạn thử lại sau vài giây.";
  if (rawMessage.includes("failed to fetch") || rawMessage.includes("network")) {
    return "Không kết nối được tới Supabase. Bạn kiểm tra mạng hoặc cấu hình rồi thử lại.";
  }
  return String(error?.message || fallbackMessage);
}

function isTransientAuthError(error) {
  const rawMessage = String(error?.message || error || "").trim().toLowerCase();
  return (
    rawMessage.includes("kitchen_auth_timeout") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("network") ||
    rawMessage.includes("timeout")
  );
}

async function withTimeout(task, timeoutMs = AUTH_TIMEOUT_MS) {
  let timer = null;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("kitchen_auth_timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getClientReady() {
  const existing = getSupabaseKitchenAuthClient();
  if (existing) return existing;
  const initialized = await withTimeout(() => initSupabaseKitchenAuthClient());
  if (initialized) return initialized;
  return getSupabaseKitchenAuthClient();
}

async function readKitchenProfile(client, session) {
  const authUserId = String(session?.user?.id || "").trim();
  const email = normalizeEmail(session?.user?.email || "");
  if (!authUserId && !email) return null;

  if (authUserId) {
    const { data, error } = await withTimeout(() =>
      client
        .from(PROFILE_TABLE)
        .select("id, auth_user_id, phone, name, email, role, status, registered, branch_uuid, metadata")
        .eq("auth_user_id", authUserId)
        .maybeSingle()
    );
    if (error) throw error;
    if (data) return normalizeProfile(data);
  }

  if (!email) return null;
  const { data, error } = await withTimeout(() =>
    client
      .from(PROFILE_TABLE)
      .select("id, auth_user_id, phone, name, email, role, status, registered, branch_uuid, metadata")
      .ilike("email", email)
      .maybeSingle()
  );
  if (error) throw error;
  return normalizeProfile(data || null);
}

async function resolveKitchenAccessFromSession(client, session) {
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

  const profile = await readKitchenProfile(client, session);
  if (!canAccessKitchen(profile)) {
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

export async function getKitchenSession() {
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
      return { session: null, rawSession: null, profile: null, unauthorized: false, message: "", error };
    }
    return await resolveKitchenAccessFromSession(client, data?.session || null);
  } catch (error) {
    return { session: null, rawSession: null, profile: null, unauthorized: false, message: "", error };
  }
}

export async function loginKitchenWithPassword({ email, password }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };

  let data = null;
  try {
    const result = await withTimeout(() =>
      client.auth.signInWithPassword({
        email: String(email || "").trim(),
        password: String(password || "")
      })
    );
    data = result?.data || null;
    if (result?.error) {
      return { ok: false, message: normalizeAuthError(result.error) };
    }
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error) };
  }

  try {
    const access = await resolveKitchenAccessFromSession(client, data?.session || null);
    if (!access.session) {
      await withTimeout(() => client.auth.signOut()).catch(() => {});
      return { ok: false, message: access.message || "Tài khoản này không có quyền vào app bếp." };
    }
    return { ok: true, session: access.session, profile: access.profile || null };
  } catch (error) {
    if (isTransientAuthError(error)) {
      return {
        ok: false,
        message: normalizeAuthError(error, "Kết nối Supabase đang chậm. Bạn bấm đăng nhập lại sau vài giây.")
      };
    }
    await withTimeout(() => client.auth.signOut()).catch(() => {});
    return { ok: false, message: normalizeAuthError(error, "Không thể xác minh quyền bếp.") };
  }
}

export async function logoutKitchen() {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  const { error } = await withTimeout(() => client.auth.signOut());
  if (error) return { ok: false, message: String(error.message || "Đăng xuất thất bại.") };
  return { ok: true };
}

export async function subscribeKitchenAuth(onChange) {
  const client = await getClientReady();
  if (!client || typeof onChange !== "function") return () => {};

  const { data } = client.auth.onAuthStateChange(async (_event, session) => {
    try {
      const access = await resolveKitchenAccessFromSession(client, session || null);
      onChange(access);
    } catch (error) {
      const transientAuthError = Boolean(session) && isTransientAuthError(error);
      onChange({
        session: transientAuthError ? session : null,
        rawSession: session || null,
        profile: null,
        unauthorized: Boolean(session) && !transientAuthError,
        transientAuthError,
        message: transientAuthError ? "" : session ? normalizeAuthError(error, "Không thể xác minh quyền bếp.") : "",
        error
      });
    }
  });

  return () => {
    data?.subscription?.unsubscribe?.();
  };
}
