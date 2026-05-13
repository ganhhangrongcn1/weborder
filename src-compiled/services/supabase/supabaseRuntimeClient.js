import { getSupabaseEnvConfig } from "./runtimeFlags.js";
import { createClient } from "@supabase/supabase-js";

function getExistingClient() {
  return globalThis.__GHR_SUPABASE_CLIENT__ || null;
}

function setClient(client) {
  globalThis.__GHR_SUPABASE_CLIENT__ = client;
  return client;
}

export async function initSupabaseRuntimeClient() {
  const { url, anonKey } = getSupabaseEnvConfig();
  if (!url || !anonKey) {
    if (import.meta?.env?.PROD) {
      console.warn("[supabaseRuntimeClient] Missing runtime env:", {
        hasUrl: Boolean(url),
        hasAnonKey: Boolean(anonKey)
      });
    }
    return null;
  }

  const existing = getExistingClient();
  if (existing) return existing;

  try {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return setClient(client);
  } catch (error) {
    console.warn("Failed to init Supabase client. Falling back to local data source.", error);
    return null;
  }
}

export function getSupabaseRuntimeClient() {
  return getExistingClient();
}
