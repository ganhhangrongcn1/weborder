const STORAGE_KEY = "ghr_kitchen_request_audit_v1";
const HOUR_MS = 60 * 60 * 1000;

function getNow() {
  return Date.now();
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readEvents() {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events = []) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Ignore storage quota/private mode errors. Audit must never affect kitchen flow.
  }
}

function compactEvents(events = [], now = getNow()) {
  const from = now - HOUR_MS;
  return events.filter((event) => Number(event?.at || 0) >= from).slice(-600);
}

function countBy(events = [], field = "table") {
  return events.reduce((map, event) => {
    const key = String(event?.[field] || "unknown");
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function toSortedRows(map = new Map()) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((first, second) => second.count - first.count || first.key.localeCompare(second.key));
}

export function recordKitchenRequest(scope = "unknown", table = "unknown", type = "read") {
  if (!canUseLocalStorage()) return;

  const now = getNow();
  const events = compactEvents(readEvents(), now);
  events.push({
    at: now,
    scope: String(scope || "unknown"),
    table: String(table || "unknown"),
    type: String(type || "read")
  });
  writeEvents(events);
}

export function getKitchenRequestAuditSnapshot() {
  const now = getNow();
  const events = compactEvents(readEvents(), now);
  writeEvents(events);

  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const recentEvents = events.filter((event) => Number(event?.at || 0) >= fiveMinutesAgo);

  return {
    total60m: events.length,
    total5m: recentEvents.length,
    byTable: toSortedRows(countBy(events, "table")),
    byScope: toSortedRows(countBy(events, "scope")),
    updatedAt: new Date(now).toISOString()
  };
}

export function resetKitchenRequestAudit() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
