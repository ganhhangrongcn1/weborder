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
const LEGACY_JWT_KEY_CLIENTS = new WeakSet();

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

function isJwtLikeToken(value = "") {
  const token = String(value || "").trim();
  if (!token) return false;
  return token.split(".").length === 3;
}

function configureRealtimeAccessToken(client, supabaseKey = "") {
  if (!client?.realtime) return client;
  if (isJwtLikeToken(supabaseKey)) {
    LEGACY_JWT_KEY_CLIENTS.add(client);
    return client;
  }

  client.realtime.accessToken = async () => {
    try {
      const { data } = await client.auth.getSession();
      const accessToken = data?.session?.access_token || "";
      return isJwtLikeToken(accessToken) ? accessToken : null;
    } catch {
      return null;
    }
  };

  client.realtime.setAuth().catch(() => {});
  return client;
}

export function isSupabaseRealtimeReady(client = null) {
  if (!client?.realtime) return false;
  if (LEGACY_JWT_KEY_CLIENTS.has(client)) return true;
  return isJwtLikeToken(client.realtime.accessTokenValue);
}

export async function ensureSupabaseRealtimeReady(client = null) {
  if (isSupabaseRealtimeReady(client)) return true;
  if (!client?.auth?.getSession || !client?.realtime?.setAuth) return false;

  try {
    const { data } = await client.auth.getSession();
    const accessToken = data?.session?.access_token || "";
    if (!isJwtLikeToken(accessToken)) return false;
    await client.realtime.setAuth(accessToken);
    return isSupabaseRealtimeReady(client);
  } catch {
    return false;
  }
}

function buildScopeAuthConfig(scope = "runtime") {
  const config = resolveScope(scope);
  const shouldPersistSession = scope !== "runtime";

  return {
    persistSession: shouldPersistSession,
    autoRefreshToken: true,
    ...(shouldPersistSession ? { storageKey: config.storageKey } : {})
  };
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
    const client = createClient(url, anonKey, {
      auth: buildScopeAuthConfig(scope)
    });
    configureRealtimeAccessToken(client, anonKey);
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

export async function syncScopedSessionToRuntime(scope = "runtime", session = null) {
  const runtimeClient = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!runtimeClient) return null;

  const scopedClient = getScopedExistingClient(scope) || await createSupabaseClientForScope(scope);
  const nextSession = session || (scopedClient ? (await scopedClient.auth.getSession()).data?.session || null : null);

  if (nextSession?.access_token && nextSession?.refresh_token) {
    await runtimeClient.auth.setSession({
      access_token: nextSession.access_token,
      refresh_token: nextSession.refresh_token
    });
    return runtimeClient;
  }

  await runtimeClient.auth.signOut().catch(() => {});
  return runtimeClient;
}
