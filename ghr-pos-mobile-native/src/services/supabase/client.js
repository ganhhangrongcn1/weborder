import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_CONFIG, hasSupabaseConfig } from "../../config/supabaseConfig";

export const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

export function isSupabaseReady() {
  return Boolean(supabase);
}
