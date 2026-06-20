import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_CONFIG, hasSupabaseConfig } from "../../config/supabaseConfig";

export const POS_SUPABASE_AUTH_STORAGE_KEY = "ghr-pos-mobile-auth-v1";

export const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        storage: AsyncStorage,
        storageKey: POS_SUPABASE_AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

export function isSupabaseReady() {
  return Boolean(supabase);
}
