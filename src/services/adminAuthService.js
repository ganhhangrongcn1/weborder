import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

const ADMIN_AUTH_TIMEOUT_MS = 6000;

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

export async function getAdminSession() {
  const client = await getClientReady();
  if (!client) return { session: null, error: new Error("missing_supabase_client") };
  try {
    const { data, error } = await withTimeout(() => client.auth.getSession());
    return { session: data?.session || null, error: error || null };
  } catch (error) {
    return { session: null, error };
  }
}

export async function loginAdminWithPassword({ email, password }) {
  // Retry once because runtime client can finish bootstrapping just after first check.
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
  return { ok: true, session: data?.session || null };
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
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onChange(session || null);
  });
  return () => {
    data?.subscription?.unsubscribe?.();
  };
}
