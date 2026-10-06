const SCOPES = new Set(["runtime", "customer", "admin", "kitchen"]);
const OPERATIONS = new Set([
  "get_customer_popular_products", "get_customer_order_count_summary",
  "get_customer_order_point_statuses", "get_admin_dashboard_summary",
  "get_admin_business_analytics", "get_admin_crm_analytics", "apply_loyalty_event",
  "claim_partner_order_points", "upsert_customer_stub_profile"
]);
const TABLES = new Set([
  "orders", "order_items", "partner_orders", "partner_order_items", "profiles",
  "loyalty_accounts", "loyalty_ledger", "app_configs", "products", "categories",
  "branches", "print_jobs", "monthly_customer_gifts"
]);
const METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]);
const TTL_MS = 15 * 60 * 1000;
let entries = [];

export function getSafeEndpoint(input, baseUrl) {
  try {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.origin !== new URL(baseUrl).origin) return "";
    const path = url.pathname.split("/").filter(Boolean);
    if (path[0] === "rest" && path[1] === "v1") {
      if (path[2] === "rpc") return OPERATIONS.has(path[3]) ? "rpc/" + path[3] : "rpc/other";
      return TABLES.has(path[2]) ? "table/" + path[2] : "table/other";
    }
    if (["auth", "storage", "functions"].includes(path[0])) return path[0];
  } catch { /* Diagnostics never changes request behavior. */ }
  return "";
}

function prune(now) {
  entries = entries.filter((entry) => entry.at >= now - TTL_MS).slice(-200);
}

export function recordSupabaseRequest({ scope, endpoint, method, status, durationMs, requestId, aborted }, now = Date.now()) {
  if (!endpoint || !/^(rpc|table)\/(other|[a-z_]+)$|^(auth|storage|functions)$/.test(endpoint)) return;
  // Do not accept arbitrary endpoint labels from callers.
  const safeEndpoint = getSafeEndpoint(
    "https://diagnostics.invalid/" + (endpoint.startsWith("rpc/") ? "rest/v1/" + endpoint : endpoint.startsWith("table/") ? "rest/v1/" + endpoint.slice(6) : endpoint),
    "https://diagnostics.invalid"
  );
  if (safeEndpoint !== endpoint) return;
  prune(now);
  entries.push({
    kind: "request", at: now, scope: SCOPES.has(scope) ? scope : "runtime",
    endpoint, method: METHODS.has(method) ? method : "OTHER",
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.min(durationMs, 600000)) : 0,
    requestId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId || "") ? requestId : "",
    aborted: Boolean(aborted)
  });
  prune(now);
}

export function recordSupabaseSdkError(operation, error, scope = "runtime", now = Date.now()) {
  if (!OPERATIONS.has(operation)) return;
  const code = String(error?.code || "");
  prune(now);
  entries.push({
    kind: "sdk_error", at: now, scope: SCOPES.has(scope) ? scope : "runtime",
    endpoint: "rpc/" + operation,
    code: /^(?:[0-9][0-9A-Z]{4}|P[0-9]{4}|PGRST[0-9]{3})$/.test(code) ? code : "UNKNOWN"
  });
  prune(now);
}

export function getSupabaseDiagnostics(now = Date.now()) {
  prune(now);
  const snapshot = entries.map((entry) => ({ ...entry }));
  const requests = snapshot.filter((entry) => entry.kind === "request");
  const errors = requests.filter((entry) => !entry.aborted && (entry.status === 0 || entry.status >= 400));
  const successes = requests.filter((entry) => entry.status >= 200 && entry.status < 400);
  const groups = new Map();
  for (const entry of requests) {
    const key = entry.scope + ":" + entry.endpoint;
    if (!groups.has(key)) groups.set(key, { scope: entry.scope, endpoint: entry.endpoint, samples: [] });
    if (entry.status > 0) groups.get(key).samples.push(entry.durationMs);
  }
  return {
    requests: requests.length, errors: errors.length,
    aborted: requests.filter((entry) => entry.aborted).length,
    lastSuccessAt: successes.length ? Math.max(...successes.map((entry) => entry.at)) : null,
    groups: [...groups.values()].map(({ samples, ...group }) => {
      samples.sort((a, b) => a - b);
      return { ...group, count: samples.length, p95HeadersMs: samples.length >= 20 ? samples[Math.ceil(samples.length * 0.95) - 1] : null };
    }),
    entries: snapshot
  };
}

export function clearSupabaseDiagnostics() { entries = []; }
export default { getSupabaseDiagnostics, clearSupabaseDiagnostics };
