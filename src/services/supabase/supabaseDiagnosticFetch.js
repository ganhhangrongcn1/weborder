import { getSafeEndpoint, recordSupabaseRequest } from "./supabaseDiagnostics.js";

export default function createSupabaseDiagnosticFetch({
  baseUrl, scope = "runtime",
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  record = recordSupabaseRequest
} = {}) {
  return async (input, init) => {
    let started = 0;
    try { started = now(); } catch { /* optional timing */ }
    const observe = (response, aborted = false) => {
      try {
        record({
          scope, endpoint: getSafeEndpoint(input, baseUrl),
          method: String(init?.method || input?.method || "GET").toUpperCase(),
          status: response?.status || 0, durationMs: now() - started,
          requestId: response?.headers?.get?.("sb-request-id") || "", aborted
        });
      } catch { /* Observation must not affect response, rejection or abort. */ }
    };
    try {
      const response = await fetchImpl(input, init);
      observe(response);
      return response;
    } catch (error) {
      try {
        observe(null, error?.name === "AbortError" || Boolean(init?.signal?.aborted || input?.signal?.aborted));
      } catch { /* Even unusual error objects must be rethrown unchanged. */ }
      throw error;
    }
  };
}
