import { getCustomerKey } from "./storageService.js";
import { isSupabaseRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import {
  getSupabaseCustomerAuthClient,
  initSupabaseCustomerAuthClient,
  syncScopedSessionToRuntime
} from "./supabase/supabaseRuntimeClient.js";

const PHONE_AUTH_EMAIL_DOMAIN = "@phone.ghr.vn";

function toPhoneAuthEmail(phone) {
  const key = getCustomerKey(phone);
  if (!key) return "";
  return `${key}${PHONE_AUTH_EMAIL_DOMAIN}`;
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isPhoneAuthEmail(email = "") {
  return normalizeEmail(email).endsWith(PHONE_AUTH_EMAIL_DOMAIN);
}

function getPasswordRecoveryRedirectUrl() {
  if (typeof window === "undefined" || !window.location?.origin) return undefined;
  const url = new URL(window.location.href);
  url.searchParams.set("authFlow", "recovery");
  return url.toString();
}

async function resolveAuthEmailForPhone(client, phone, preferredEmail = "") {
  const normalizedPhone = getCustomerKey(phone);
  const safePreferredEmail = normalizeEmail(preferredEmail);
  if (isValidEmail(safePreferredEmail)) return safePreferredEmail;
  if (!client || !normalizedPhone) return "";

  try {
    const { data, error } = await client
      .rpc("get_customer_profile_login_hint", {
        p_phone: normalizedPhone
      });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      const profileEmail = normalizeEmail(row?.email || "");
      if (isValidEmail(profileEmail)) return profileEmail;
    }
  } catch {
  }

  return toPhoneAuthEmail(normalizedPhone);
}

export async function getSupabaseCustomerSessionSnapshot() {
  const client = await getClientReady();
  if (!client) return { ok: false, reason: "client_unavailable" };
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) return { ok: false, reason: "session_error", error: sessionError };
    const session = sessionData?.session || null;
    await syncScopedSessionToRuntime("customer", session).catch(() => {});
    if (!session?.user) return { ok: false, reason: "no_session" };
    const authUser = session.user;
    const meta = authUser.user_metadata || {};
    const phone = getCustomerKey(meta.phone || "");
    if (!phone) return { ok: false, reason: "missing_phone", authUserId: String(authUser.id || "") };
    const authName = String(meta.full_name || meta.display_name || meta.name || "").trim();
    return {
      ok: true,
      phone,
      authUserId: String(authUser.id || ""),
      email: String(authUser.email || ""),
      name: authName
    };
  } catch (error) {
    return { ok: false, reason: "unexpected_error", error };
  }
}

function normalizeAuthError(error, fallback = "Không thể thực hiện xác thực. Vui lòng thử lại.") {
  const message = String(error?.message || "").trim();
  if (!message) return fallback;
  return message;
}

function getClient() {
  return getSupabaseCustomerAuthClient();
}

async function getClientReady() {
  const existing = getClient();
  if (existing) return existing;
  const initialized = await initSupabaseCustomerAuthClient();
  if (initialized) return initialized;
  return getClient();
}

export async function registerPhonePasswordAuth({ phone, password, name = "", email = "" }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const normalizedPhone = getCustomerKey(phone);
  const authEmail = normalizeEmail(email);
  if (!normalizedPhone) return { ok: false, message: "Số điện thoại không hợp lệ." };
  if (!isValidEmail(authEmail)) return { ok: false, message: "Vui lòng nhập email hợp lệ để lấy lại mật khẩu khi cần." };
  if (String(password || "").length < 6) return { ok: false, message: "Mật khẩu tối thiểu 6 ký tự." };

  try {
    const { data, error } = await client.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          phone: normalizedPhone,
          name: String(name || "").trim()
        }
      }
    });
    if (error) return { ok: false, message: normalizeAuthError(error) };
    await syncScopedSessionToRuntime("customer", data?.session || null).catch(() => {});
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error) };
  }
}

export async function loginPhonePasswordAuth({ phone, password, email = "" }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const authEmail = await resolveAuthEmailForPhone(client, phone, email);
  if (!authEmail) return { ok: false, message: "Số điện thoại không hợp lệ." };

  try {
    const { data, error } = await client.auth.signInWithPassword({ email: authEmail, password });
    if (error) return { ok: false, message: normalizeAuthError(error, "Đăng nhập thất bại.") };
    await syncScopedSessionToRuntime("customer", data?.session || null).catch(() => {});
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Đăng nhập thất bại.") };
  }
}

export async function updatePhonePasswordAuth({ phone, password, email = "" }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const authEmail = await resolveAuthEmailForPhone(client, phone, email);
  if (!authEmail) return { ok: false, message: "Số điện thoại không hợp lệ." };

  try {
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email: authEmail, password });
    if (!signInError && signInData?.user) return { ok: true };
  } catch {
    // Keep the same compact result shape for callers.
  }
  return { ok: false, message: "Không thể xác minh tài khoản Supabase cho số này." };
}

export async function changeLoggedInCustomerPasswordAuth({ phone, currentPassword, newPassword, email = "" }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const authEmail = await resolveAuthEmailForPhone(client, phone, email);
  if (!authEmail) return { ok: false, message: "Số điện thoại không hợp lệ." };
  if (String(currentPassword || "").length < 1) return { ok: false, message: "Vui lòng nhập mật khẩu hiện tại." };
  if (String(newPassword || "").length < 6) return { ok: false, message: "Mật khẩu mới tối thiểu 6 ký tự." };

  try {
    const { error: signInError } = await client.auth.signInWithPassword({
      email: authEmail,
      password: currentPassword
    });
    if (signInError) {
      return { ok: false, message: "Mật khẩu hiện tại chưa đúng." };
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPassword
    });
    if (updateError) {
      return { ok: false, message: normalizeAuthError(updateError, "Không thể cập nhật mật khẩu.") };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Không thể cập nhật mật khẩu.") };
  }
}

export async function requestCustomerPasswordResetEmailAuth({ email }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const authEmail = normalizeEmail(email);
  if (!isValidEmail(authEmail) || isPhoneAuthEmail(authEmail)) {
    return { ok: false, message: "Vui lòng nhập email thật đã đăng ký." };
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(authEmail, {
      redirectTo: getPasswordRecoveryRedirectUrl()
    });
    if (error) return { ok: false, message: normalizeAuthError(error, "Không thể gửi email đặt lại mật khẩu.") };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Không thể gửi email đặt lại mật khẩu.") };
  }
}

export async function updateRecoveryPasswordAuth({ password }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  if (String(password || "").length < 6) return { ok: false, message: "Mật khẩu mới tối thiểu 6 ký tự." };

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      return { ok: false, message: "Link đặt lại mật khẩu đã hết hạn hoặc chưa được xác nhận." };
    }
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, message: normalizeAuthError(error, "Không thể cập nhật mật khẩu mới.") };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Không thể cập nhật mật khẩu mới.") };
  }
}

export async function syncCustomerProfileToSupabase({ phone, name = "", email: _email = "", avatarUrl = "", authUserId = "" }) {
  const client = await getClientReady();
  const normalizedPhone = getCustomerKey(phone);
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!normalizedPhone) return { ok: false, message: "Số điện thoại không hợp lệ." };
  if (!isSupabaseRuntimeWriteEnabled()) return { ok: false, message: "Supabase runtime write đang tắt." };

  try {
    const { data: authData } = await client.auth.getUser();
    const authUser = authData?.user || null;
    const safeName = String(name || "").trim();
    const safeAuthUserId = String(authUserId || authUser?.id || "").trim();
    const safeAvatarUrl = String(avatarUrl || "").trim();
    if (!safeAuthUserId) {
      return { ok: false, message: "Phiên đăng nhập chưa có mã người dùng hợp lệ." };
    }
    const { error: profileError } = await client.rpc("sync_own_customer_profile", {
      p_phone: normalizedPhone,
      p_name: safeName || null,
      p_avatar_url: safeAvatarUrl || null
    });
    if (profileError) {
      console.error("[syncCustomerProfileToSupabase] profile upsert failed", profileError);
      return { ok: false, message: normalizeAuthError(profileError, "Không thể đồng bộ hồ sơ.") };
    }

    if (authUser) {
      const { error: authError } = await client.auth.updateUser({
        data: {
          phone: normalizedPhone,
          name: safeName,
          full_name: safeName,
          display_name: safeName
        }
      });
      if (authError) {
        console.error("[syncCustomerProfileToSupabase] auth updateUser failed", authError);
        return { ok: false, message: normalizeAuthError(authError, "Đã lưu hồ sơ nhưng chưa cập nhật auth profile.") };
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Lỗi đồng bộ hồ sơ Supabase.") };
  }
}

export async function logoutCustomerAuthSession() {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  try {
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, message: normalizeAuthError(error, "Đăng xuất thất bại.") };
    await syncScopedSessionToRuntime("customer", null).catch(() => {});
    return { ok: true };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Đăng xuất thất bại.") };
  }
}

export async function syncAuthProfileToCustomerRow() {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!isSupabaseRuntimeWriteEnabled()) return { ok: false, message: "Supabase runtime write đang tắt." };

  try {
    const { data: authData, error: authReadError } = await client.auth.getUser();
    if (authReadError) return { ok: false, message: normalizeAuthError(authReadError, "Không đọc được auth user.") };
    const user = authData?.user;
    if (!user) return { ok: false, message: "Chưa có phiên đăng nhập Supabase." };

    const meta = user.user_metadata || {};
    const phone = getCustomerKey(meta.phone || "");
    if (!phone) return { ok: false, message: "Auth user chưa có số điện thoại hợp lệ." };
    const name = String(meta.full_name || meta.display_name || meta.name || "").trim();
    const email = String(user.email || "").trim();
    return syncCustomerProfileToSupabase({
      phone,
      name,
      email,
      authUserId: user.id
    });
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Lỗi đồng bộ auth -> profiles.") };
  }
}
