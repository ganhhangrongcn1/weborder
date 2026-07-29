export function getSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

  return {
    url,
    anonKey,
    ready: Boolean(url && anonKey)
  };
}
