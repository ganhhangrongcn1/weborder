export const SUPABASE_CONFIG = {
  url: "https://qjaklysckgzdfjthzkzu.supabase.co",
  anonKey: "sb_publishable_VPLwhy64zz2QQUyy02xzsg_CXs2A1JI"
};

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}
