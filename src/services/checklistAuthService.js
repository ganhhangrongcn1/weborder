import { getSupabaseAdminAuthClient, initSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

async function getClient() {
  return getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
}

async function resolveChecklistAccess(client, session) {
  if (!session?.user?.id) return { session: null, profile: null, access: [], authorized: false };
  const [profileResult, accessResult] = await Promise.all([
    client.from("profiles").select("auth_user_id, name, email, role, status, branch_uuid").eq("auth_user_id", session.user.id).maybeSingle(),
    client.from("checklist_user_access").select("role, branch_uuid, is_active").eq("auth_user_id", session.user.id).eq("is_active", true)
  ]);
  if (profileResult.error) throw profileResult.error;
  if (accessResult.error) throw accessResult.error;
  const profile = profileResult.data || null;
  const access = accessResult.data || [];
  const profileIsActive = String(profile?.status || "").toLowerCase() === "active";
  const isActiveAdmin = String(profile?.role || "").toLowerCase() === "admin" && profileIsActive;
  const isSupervisor = profileIsActive && access.some((item) => ["admin", "supervisor"].includes(String(item.role || "").toLowerCase()));
  return { session, profile, access, authorized: isActiveAdmin || isSupervisor };
}

export async function getChecklistSession() {
  const client = await getClient();
  if (!client) throw new Error("Chưa kết nối được Supabase.");
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return resolveChecklistAccess(client, data?.session || null);
}

export async function loginChecklistUser({ email, password }) {
  const client = await getClient();
  if (!client) throw new Error("Chưa kết nối được Supabase.");
  const { data, error } = await client.auth.signInWithPassword({ email: String(email || "").trim().toLowerCase(), password: String(password || "") });
  if (error) throw error;
  const resolved = await resolveChecklistAccess(client, data.session);
  if (!resolved.authorized) {
    await client.auth.signOut().catch(() => {});
    throw new Error("Tài khoản chưa được cấp quyền Admin hoặc Giám sát checklist.");
  }
  return resolved;
}

export async function logoutChecklistUser() {
  const client = await getClient();
  if (client) await client.auth.signOut().catch(() => {});
}
