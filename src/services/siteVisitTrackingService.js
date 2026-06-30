import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";
import { isSiteVisitTrackingEnabled } from "./supabase/runtimeFlags.js";
import { addDaysToVietnamDateInput } from "../utils/adminDateRange.js";

const SITE_VISITOR_STORAGE_KEY = "ghr_site_visitor_id";
const SITE_VISIT_DEDUPE_PREFIX = "ghr_site_visit_sent";
const SITE_VISIT_DEDUPE_MS = 10000;
const SITE_VISITS_TABLE = "site_visits";
const SITE_VISIT_DAILY_STATS_RPC = "get_site_visit_daily_stats";

function isBrowserReady() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function limitText(value = "", maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function createVisitorId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // Ignore private-mode storage failures; tracking should never break UX.
  }
}

function getOrCreateVisitorId() {
  if (!isBrowserReady()) return "";
  const existing = readStorage(window.localStorage, SITE_VISITOR_STORAGE_KEY);
  if (existing) return existing;

  const nextVisitorId = createVisitorId();
  writeStorage(window.localStorage, SITE_VISITOR_STORAGE_KEY, nextVisitorId);
  return nextVisitorId;
}

function getVietnamDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function normalizeDevice() {
  if (!isBrowserReady()) return "unknown";
  const userAgent = String(window.navigator?.userAgent || "").toLowerCase();
  if (/ipad|tablet/.test(userAgent)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(userAgent)) return "mobile";
  return "desktop";
}

function getRouteGroup(pathname = "") {
  const path = String(pathname || "/").toLowerCase();
  if (path.startsWith("/qr/")) return "qr";
  if (path.startsWith("/banhkembanhtrang")) return "cake";
  if (path.startsWith("/menu")) return "menu";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/orders")) return "orders";
  if (path.startsWith("/loyalty")) return "loyalty";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/success")) return "success";
  if (path === "/" || path.startsWith("/home")) return "home";
  return "customer";
}

function isTrackableSitePath(pathname = "") {
  const path = String(pathname || "/").toLowerCase();
  if (!path || path === "/") return true;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/kitchen")) return false;
  if (path.startsWith("/download")) return false;
  if (path.startsWith("/qrcode")) return false;
  return (
    path.startsWith("/home") ||
    path.startsWith("/menu") ||
    path.startsWith("/cart") ||
    path.startsWith("/checkout") ||
    path.startsWith("/success") ||
    path.startsWith("/profile") ||
    path.startsWith("/orders") ||
    path.startsWith("/loyalty") ||
    path.startsWith("/qr/") ||
    path.startsWith("/banhkembanhtrang")
  );
}

function getTrafficSource(search = "") {
  const params = new URLSearchParams(String(search || ""));
  const utmSource = limitText(params.get("utm_source"), 80);
  if (utmSource) return utmSource.toLowerCase();

  if (!isBrowserReady()) return "direct";
  const referrer = String(document.referrer || "").trim();
  if (!referrer) return "direct";

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host) return "referral";
    if (host.includes("facebook")) return "facebook";
    if (host.includes("zalo")) return "zalo";
    if (host.includes("google")) return "google";
    return host.slice(0, 80);
  } catch {
    return "referral";
  }
}

function shouldSkipDuplicateVisit(pathname = "", search = "") {
  if (!isBrowserReady()) return true;
  const today = getVietnamDateText();
  const key = `${SITE_VISIT_DEDUPE_PREFIX}:${today}:${pathname}:${search}`;
  const previous = Number(readStorage(window.sessionStorage, key) || 0);
  if (previous && Date.now() - previous < SITE_VISIT_DEDUPE_MS) return true;
  writeStorage(window.sessionStorage, key, String(Date.now()));
  return false;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDateInputTime(dateText = "") {
  const time = new Date(`${String(dateText || "").trim()}T00:00:00+07:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getInclusiveDayCount(dateFrom = "", dateTo = "") {
  const fromTime = getDateInputTime(dateFrom);
  const toTime = getDateInputTime(dateTo);
  if (!fromTime || !toTime) return 1;
  return Math.max(1, Math.round((toTime - fromTime) / 86400000) + 1);
}

function buildPreviousDateRange(dateRange = {}) {
  const currentFrom = String(dateRange.dateFrom || "").trim();
  const currentTo = String(dateRange.dateTo || dateRange.dateFrom || "").trim();
  if (!currentFrom || !currentTo) return null;

  const fromText = currentFrom <= currentTo ? currentFrom : currentTo;
  const toText = currentFrom <= currentTo ? currentTo : currentFrom;
  const dayCount = getInclusiveDayCount(fromText, toText);
  const previousTo = addDaysToVietnamDateInput(fromText, -1);
  const previousFrom = addDaysToVietnamDateInput(previousTo, -(dayCount - 1));
  if (!previousFrom || !previousTo) return null;

  return {
    dateFrom: previousFrom,
    dateTo: previousTo,
    dayCount
  };
}

function mapDailyStats(rows = []) {
  const daily = (Array.isArray(rows) ? rows : []).map((row) => ({
    date: String(row.visit_date || ""),
    pageViews: toNumber(row.page_views),
    uniqueVisitors: toNumber(row.unique_visitors)
  }));
  const totals = daily.reduce(
    (summary, item) => ({
      pageViews: summary.pageViews + item.pageViews,
      uniqueVisitors: summary.uniqueVisitors + item.uniqueVisitors
    }),
    { pageViews: 0, uniqueVisitors: 0 }
  );
  const peakDay = daily.reduce(
    (peak, item) => (item.pageViews > peak.pageViews ? item : peak),
    { date: "", pageViews: 0, uniqueVisitors: 0 }
  );

  return {
    source: "rpc",
    daily,
    pageViews: totals.pageViews,
    uniqueVisitors: totals.uniqueVisitors,
    averagePageViewsPerVisitor: totals.uniqueVisitors
      ? Math.round((totals.pageViews / totals.uniqueVisitors) * 10) / 10
      : 0,
    peakDay
  };
}

function buildComparison(current = {}, previous = {}, previousDateRange = null) {
  const currentPageViews = toNumber(current.pageViews);
  const previousPageViews = toNumber(previous.pageViews);
  const currentUniqueVisitors = toNumber(current.uniqueVisitors);
  const previousUniqueVisitors = toNumber(previous.uniqueVisitors);
  const pageViewDelta = currentPageViews - previousPageViews;
  const pageViewPercent = previousPageViews
    ? Math.round((pageViewDelta / previousPageViews) * 1000) / 10
    : currentPageViews
      ? 100
      : 0;
  const uniqueVisitorDelta = currentUniqueVisitors - previousUniqueVisitors;
  const uniqueVisitorPercent = previousUniqueVisitors
    ? Math.round((uniqueVisitorDelta / previousUniqueVisitors) * 1000) / 10
    : currentUniqueVisitors
      ? 100
      : 0;

  return {
    pageViewDelta,
    pageViewPercent,
    uniqueVisitorDelta,
    uniqueVisitorPercent,
    previousDateFrom: previousDateRange?.dateFrom || "",
    previousDateTo: previousDateRange?.dateTo || "",
    dayCount: previousDateRange?.dayCount || 1
  };
}

export async function recordSiteVisit({ pathname = "", search = "" } = {}) {
  if (!isBrowserReady()) return { ok: false, skipped: true, reason: "not_browser" };
  if (!isSiteVisitTrackingEnabled()) return { ok: false, skipped: true, reason: "disabled" };
  if (!isTrackableSitePath(pathname)) return { ok: false, skipped: true, reason: "ignored_path" };
  if (shouldSkipDuplicateVisit(pathname, search)) return { ok: false, skipped: true, reason: "duplicate" };

  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return { ok: false, skipped: true, reason: "missing_visitor" };

  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client) return { ok: false, skipped: true, reason: "missing_client" };

  const payload = {
    visitor_id: visitorId,
    visit_date: getVietnamDateText(),
    path: limitText(pathname || "/", 240),
    route_group: getRouteGroup(pathname),
    referrer: limitText(document.referrer, 500),
    source: getTrafficSource(search),
    device: normalizeDevice(),
    viewport_width: Number(window.innerWidth || 0) || null,
    user_agent: limitText(window.navigator?.userAgent || "", 500)
  };

  const { error } = await client.from(SITE_VISITS_TABLE).insert(payload);
  if (error) throw error;
  return { ok: true };
}

export async function getSiteVisitDailyStats(dateRange = {}) {
  const client = await getAdminSupabaseClient();
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  const previousDateRange = buildPreviousDateRange(dateRange);
  const currentRequest = client.rpc(SITE_VISIT_DAILY_STATS_RPC, {
    p_date_from: dateRange.dateFrom,
    p_date_to: dateRange.dateTo
  });
  const previousRequest = previousDateRange
    ? client.rpc(SITE_VISIT_DAILY_STATS_RPC, {
        p_date_from: previousDateRange.dateFrom,
        p_date_to: previousDateRange.dateTo
      })
    : Promise.resolve({ data: [], error: null });

  const [currentResult, previousResult] = await Promise.all([currentRequest, previousRequest]);
  const error = currentResult.error || previousResult.error;
  if (error) {
    const code = String(error.code || "");
    if (code === "42883" || code === "PGRST202") return null;
    throw error;
  }

  const current = mapDailyStats(currentResult.data);
  const previous = mapDailyStats(previousResult.data);
  return {
    ...current,
    previous,
    comparison: buildComparison(current, previous, previousDateRange)
  };
}

export default {
  recordSiteVisit,
  getSiteVisitDailyStats
};
