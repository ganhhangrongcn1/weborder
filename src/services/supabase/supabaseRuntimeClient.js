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

const SESSION_EXPIRY_SKEW_MS = 60 * 1000;

function resolveScope(scope = "runtime") {
  return CLIENT_SCOPES[scope] || CLIENT_SCOPES.runtime;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function getScopeStorageKey(scope = "runtime") {
  return resolveScope(scope).storageKey;
}

function getPersistedSessionPayload(scope = "runtime") {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(getScopeStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed.currentSession || parsed.session || parsed;
  } catch {
    return null;
  }
}

function hasSessionTokens(session = null) {
  return Boolean(session?.access_token && session?.refresh_token);
}

function getSessionExpiryTime(session = null) {
  const rawExpiry = Number(
    session?.expires_at ??
    session?.expiresAt ??
    0
  );
  if (!Number.isFinite(rawExpiry) || rawExpiry <= 0) return 0;
  return rawExpiry > 10_000_000_000 ? rawExpiry : rawExpiry * 1000;
}

function isSessionExpired(session = null) {
  const expiresAt = getSessionExpiryTime(session);
  if (!expiresAt) return false;
  return expiresAt <= Date.now() + SESSION_EXPIRY_SKEW_MS;
}

function shouldPrunePersistedSession(session = null) {
  if (!session || typeof session !== "object") return false;
  if (!hasSessionTokens(session)) return true;
  return isSessionExpired(session);
}

function removeScopedSessionStorage(scope = "runtime") {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(getScopeStorageKey(scope));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function prunePersistedSession(scope = "runtime") {
  const session = getPersistedSessionPayload(scope);
  if (!shouldPrunePersistedSession(session)) return;
  removeScopedSessionStorage(scope);
}

export function isSupabaseAuthSessionInvalidError(error = null) {
  const code = String(error?.status || error?.code || "").trim();
  const message = String(error?.message || error || "").trim().toLowerCase();
  return (
    code === "401" ||
    code === "403" ||
    message.includes("jwt") ||
    message.includes("session") ||
    message.includes("refresh token") ||
    message.includes("invalid token") ||
    message.includes("token has expired") ||
    message.includes("user from sub claim in jwt does not exist")
  );
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
    prunePersistedSession(scope);
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

export async function clearScopedSupabaseAuth(scope = "runtime", options = {}) {
  const includeRuntime = options?.includeRuntime === true;
  const scopes = Array.from(new Set([
    scope,
    includeRuntime ? "runtime" : ""
  ].filter(Boolean)));

  await Promise.all(scopes.map(async (targetScope) => {
    const existing = getScopedExistingClient(targetScope);
    if (existing?.auth?.signOut) {
      await existing.auth.signOut().catch(() => {});
    }
    removeScopedSessionStorage(targetScope);
    setScopedClient(targetScope, null);
  }));
}

export async function syncScopedSessionToRuntime(scope = "runtime", session = null) {
  const runtimeClient = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!runtimeClient) return null;

  const scopedClient = getScopedExistingClient(scope) || await createSupabaseClientForScope(scope);
  const nextSession = session || (scopedClient ? (await scopedClient.auth.getSession()).data?.session || null : null);

  if (hasSessionTokens(nextSession) && !isSessionExpired(nextSession)) {
    await runtimeClient.auth.setSession({
      access_token: nextSession.access_token,
      refresh_token: nextSession.refresh_token
    });
    return runtimeClient;
  }

  await clearScopedSupabaseAuth("runtime");
  return runtimeClient;
}
