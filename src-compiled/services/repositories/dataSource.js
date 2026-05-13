import { getSupabaseClient } from "../supabase/supabaseClient.js";

export function getDataSource() {
  const value = String(import.meta.env?.VITE_DATA_SOURCE || "supabase").toLowerCase();
  return value === "local" ? "local" : "supabase";
}

export function isSupabaseEnabled() {
  return getDataSource() === "supabase" && Boolean(getSupabaseClient());
}

export function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!isSupabaseEnabled()) {
    console.warn(
      "[dataSource] Supabase is disabled. Set VITE_DATA_SOURCE=supabase and provide VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY."
    );
    return null;
  }
  return client;
}
