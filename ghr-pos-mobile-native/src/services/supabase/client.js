import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { SUPABASE_CONFIG, hasSupabaseConfig } from "../../config/supabaseConfig";

export const POS_SUPABASE_AUTH_STORAGE_KEY = "ghr-pos-mobile-auth-v1";
let authLifecycleCleanup = null;

export const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        storage: AsyncStorage,
        storageKey: POS_SUPABASE_AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock
      }
    })
  : null;

export function isSupabaseReady() {
  return Boolean(supabase);
}

export function startPosSupabaseAuthLifecycle() {
  if (!supabase || Platform.OS === "web") return () => {};
  if (authLifecycleCleanup) return authLifecycleCleanup;

  const syncAutoRefresh = (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
      return;
    }
    void supabase.auth.stopAutoRefresh();
  };

  syncAutoRefresh(AppState.currentState);
  const subscription = AppState.addEventListener("change", syncAutoRefresh);

  authLifecycleCleanup = () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
    authLifecycleCleanup = null;
  };

  return authLifecycleCleanup;
}
