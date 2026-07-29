import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../../config/supabaseConfig.js";

let client = null;

export function getSupabaseClient() {
  if (client) return client;
  const config = getSupabaseConfig();
  if (!config.ready) return null;

  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "ghr-checklist-auth"
    }
  });
  return client;
}
