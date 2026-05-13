import { getCustomerKey } from "./storageService.js";
import { isSupabaseRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

function toPhoneAuthEmail(phone) {
  const key = getCustomerKey(phone);
  if (!key) return "";
  return `${key}@phone.ghr.vn`;
}

export async function getSupabaseCustomerSessionSnapshot() {
  const client = await getClientReady();
  if (!client) return { ok: false, reason: "client_unavailable" };
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) return { ok: false, reason: "session_error", error: sessionError };
    const session = sessionData?.session || null;
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
  return getSupabaseRuntimeClient();
}

async function getClientReady() {
  const existing = getClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  return getClient();
}

export async function registerPhonePasswordAuth({ phone, password, name = "" }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const email = toPhoneAuthEmail(phone);
  if (!email) return { ok: false, message: "Số điện thoại không hợp lệ." };
  if (String(password || "").length < 6) return { ok: false, message: "Mật khẩu tối thiểu 6 ký tự." };

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone: getCustomerKey(phone),
          name: String(name || "").trim()
        }
      }
    });
    if (error) return { ok: false, message: normalizeAuthError(error) };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error) };
  }
}

export async function loginPhonePasswordAuth({ phone, password }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const email = toPhoneAuthEmail(phone);
  if (!email) return { ok: false, message: "Số điện thoại không hợp lệ." };

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: normalizeAuthError(error, "Đăng nhập thất bại.") };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Đăng nhập thất bại.") };
  }
}

export async function updatePhonePasswordAuth({ phone, password }) {
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase auth chưa sẵn sàng." };
  const email = toPhoneAuthEmail(phone);
  if (!email) return { ok: false, message: "Số điện thoại không hợp lệ." };

  try {
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (!signInError && signInData?.user) return { ok: true };
  } catch (_error) {
    // Ignore.
  }
  return { ok: false, message: "Không thể xác minh tài khoản Supabase cho số này." };
}

export async function syncCustomerProfileToSupabase({ phone, name = "", email = "", avatarUrl = "" }) {
  const client = await getClientReady();
  const normalizedPhone = getCustomerKey(phone);
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };
  if (!normalizedPhone) return { ok: false, message: "Số điện thoại không hợp lệ." };
  if (!isSupabaseRuntimeWriteEnabled()) return { ok: false, message: "Supabase runtime write đang tắt." };

  try {
    const safeName = String(name || "").trim();
    const safeEmail = String(email || "").trim();
    const safeAvatarUrl = String(avatarUrl || "").trim();
    const customerRow = {
      phone: normalizedPhone,
      registered: true,
      updated_at: new Date().toISOString()
    };
    if (safeName) customerRow.name = safeName;
    if (safeEmail) customerRow.email = safeEmail;
    // Important: never overwrite existing avatar with empty string.
    if (safeAvatarUrl) customerRow.avatar_url = safeAvatarUrl;

    const { error: customerError } = await client.from("customers").upsert(
      [customerRow],
      { onConflict: "phone" }
    );
    if (customerError) {
      console.error("[syncCustomerProfileToSupabase] customer upsert failed", customerError);
      return { ok: false, message: normalizeAuthError(customerError, "Không thể đồng bộ khách hàng.") };
    }

    const { data: authData } = await client.auth.getUser();
    if (authData?.user) {
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
        return { ok: false, message: normalizeAuthError(authError, "Đã lưu customer nhưng chưa cập nhật auth profile.") };
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
    const { data: existingCustomer, error: existingCustomerError } = await client
      .from("customers")
      .select("phone,name")
      .eq("phone", phone)
      .maybeSingle();
    if (existingCustomerError) {
      return { ok: false, message: normalizeAuthError(existingCustomerError, "Không đọc được hồ sơ customer.") };
    }
    const existingName = String(existingCustomer?.name || "").trim();
    const shouldFillName = !existingName && !!name;
    return syncCustomerProfileToSupabase({
      phone,
      name: shouldFillName ? name : existingName,
      email
    });
  } catch (error) {
    return { ok: false, message: normalizeAuthError(error, "Lỗi đồng bộ auth -> customers.") };
  }
}
