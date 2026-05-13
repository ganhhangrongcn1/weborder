import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabaseRuntimeClient.js";

export function getSupabaseClient() {
  const existing = getSupabaseRuntimeClient();
  if (existing) return existing;
  return null;
}

export const supabaseClient = getSupabaseClient();

// Ensure client bootstraps even when this module is imported first.
initSupabaseRuntimeClient();
