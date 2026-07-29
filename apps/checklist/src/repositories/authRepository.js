import { getSupabaseClient } from "../services/supabase/supabaseClient.js";

const PROFILE_COLUMNS = "id, auth_user_id, name, email, phone, role, status, branch_uuid, metadata";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("missing_supabase_config");
  return client;
}

export async function getSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function signInWithPassword({ email, password }) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || "")
  });
  if (error) throw error;
  return data?.session || null;
}

export async function signOut() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getProfileByAuthUserId(authUserId) {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function subscribeAuth(callback) {
  const client = requireClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session || null));
  return () => data?.subscription?.unsubscribe?.();
}
