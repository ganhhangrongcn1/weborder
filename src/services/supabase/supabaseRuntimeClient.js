import { getSupabaseEnvConfig } from "./runtimeFlags.js";
import { createClient } from "@supabase/supabase-js";

const CLIENT_SCOPES = {
  runtime: {
    globalKey: "__GHR_SUPABASE_CLIENT__",
    storageKey: "ghr-runtime-auth"
  },
  customer: {
    globalKey: "__GHR_SUPABASE_CUSTOMER_AUTH_CLIENT__",
    storageKey: "ghr-customer-auth"
  },
  admin: {
    globalKey: "__GHR_SUPABASE_ADMIN_AUTH_CLIENT__",
    storageKey: "ghr-admin-auth"
  },
  kitchen: {
    globalKey: "__GHR_SUPABASE_KITCHEN_AUTH_CLIENT__",
    storageKey: "ghr-kitchen-auth"
  }
};

function resolveScope(scope = "runtime") {
  return CLIENT_SCOPES[scope] || CLIENT_SCOPES.runtime;
}

function getExistingClient() {
  return getScopedExistingClient("runtime");
}

function setClient(client) {
  return setScopedClient("runtime", client);
}

function getScopedExistingClient(scope = "runtime") {
  const config = resolveScope(scope);
  return globalThis[config.globalKey] || null;
}

function setScopedClient(scope = "runtime", client) {
  const config = resolveScope(scope);
  globalThis[config.globalKey] = client;
  return client;
}

function createSupabaseClientForScope(scope = "runtime") {
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

  const existing = getScopedExistingClient(scope);
  if (existing) return existing;

  try {
    const config = resolveScope(scope);
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: config.storageKey
      }
    });
    return setScopedClient(scope, client);
  } catch (error) {
    console.warn("Failed to init Supabase client. Falling back to local data source.", error);
    return null;
  }
}

export async function initSupabaseRuntimeClient() {
  return createSupabaseClientForScope("runtime");
}

export function getSupabaseRuntimeClient() {
  return getExistingClient();
}

export async function initSupabaseCustomerAuthClient() {
  return createSupabaseClientForScope("customer");
}

export function getSupabaseCustomerAuthClient() {
  return getScopedExistingClient("customer");
}

export async function initSupabaseAdminAuthClient() {
  return createSupabaseClientForScope("admin");
}

export function getSupabaseAdminAuthClient() {
  return getScopedExistingClient("admin");
}

export async function initSupabaseKitchenAuthClient() {
  return createSupabaseClientForScope("kitchen");
}

export function getSupabaseKitchenAuthClient() {
  return getScopedExistingClient("kitchen");
}
