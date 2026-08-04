import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  open,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(PROJECT_ROOT, ".env.partner-review-worker"), override: false });

const LOCAL_ROOT = path.join(PROJECT_ROOT, ".local-tools", "partner-review-worker");
const PROFILE_ROOT = path.join(LOCAL_ROOT, "profiles");
const LOCK_PATH = path.join(LOCAL_ROOT, "worker.lock");
const LOG_PATH = path.join(LOCAL_ROOT, "worker.log");
const FEEDBACK_URL = "https://merchant.grab.com/feedback";
const FEEDBACK_API_URL = "https://api.grab.com/food/merchant/v1/feedback";
const LOGIN_URL = "https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal";
const API_URL = String(process.env.PARTNER_REVIEW_API_URL || "").trim();
const REVIEW_REWARD_API_URL = String(
  process.env.REVIEW_REWARD_API_URL
  || API_URL.replace(/partner-review-source-api\/?$/i, "review-reward-api")
).trim();
const AUTOMATION_SECRET = String(process.env.PARTNER_REVIEW_AUTOMATION_SECRET || "").trim();
const SUPABASE_ANON_KEY = String(process.env.PARTNER_REVIEW_ANON_KEY || "").trim();
const FALLBACK_INTERVAL_MINUTES = Math.max(5, Number(process.env.PARTNER_REVIEW_INTERVAL_MINUTES) || 60);
const REVIEW_WINDOW_DAYS = Math.max(1, Number(process.env.PARTNER_REVIEW_WINDOW_DAYS) || 2);
const BATCH_SIZE = Math.min(50, Math.max(1, Number(process.env.PARTNER_REVIEW_BATCH_SIZE) || 4));
const CONCURRENCY = Math.min(8, Math.max(1, Number(process.env.PARTNER_REVIEW_CONCURRENCY) || 1));
const HEADLESS = String(process.env.PARTNER_REVIEW_HEADLESS || "true").toLowerCase() !== "false";
const RUN_ONCE = process.argv.includes("--once");
const WORKER_ID = `${hostname()}:${process.pid}`;
const USERNAME_SELECTOR = [
  "#Username",
  "input[name='username']",
  "input[autocomplete='username']",
  "input[type='email']",
  "input[type='text']"
].join(", ");
const PASSWORD_SELECTOR = [
  "input[type='password']",
  "input[name='password']",
  "input[autocomplete='current-password']"
].join(", ");

let lockHandle = null;
let stopping = false;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const safeKey = (value) => String(value || "source").replace(/[^a-zA-Z0-9_-]+/g, "_");
const intervalMs = (value) => Math.min(1440, Math.max(5, Number(value) || FALLBACK_INTERVAL_MINUTES)) * 60_000;
const cookieHeader = (cookies) => cookies
  .filter((cookie) => !cookie.expires || cookie.expires < 0 || cookie.expires * 1000 > Date.now())
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join("; ");
const CLOSED_STORE_REASONS = new Set([3, 4, 5, 7, 8]);
const PAUSED_STORE_REASONS = new Map([[1, "TEMPPAUSED"], [2, "OPSPAUSED"], [6, "OPSPAUSED"]]);

function isFeedbackPage(page) {
  try {
    return new URL(page.url()).pathname.replace(/\/+$/, "") === "/feedback";
  } catch {
    return false;
  }
}

async function openFeedbackPage(page, { force = false } = {}) {
  if (!force && isFeedbackPage(page)) return;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(FEEDBACK_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = /ERR_ABORTED/i.test(message) && attempt < maxAttempts;
      if (!canRetry) throw error;
      await sleep(attempt * 2_000);
    }
  }
}

async function log(message, detail = "") {
  const line = `[${new Date().toISOString()}] ${message}${detail ? ` ${detail}` : ""}`;
  console.log(line);
  await mkdir(LOCAL_ROOT, { recursive: true });
  await writeFile(LOG_PATH, `${line}\n`, { flag: "a" });
}

async function api(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": AUTOMATION_SECRET,
      ...(SUPABASE_ANON_KEY ? {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`
      } : {})
    },
    body: JSON.stringify({ action, ...payload }),
    signal: globalThis.AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(body.message || `Partner review API returned ${response.status}`);
  }
  return body;
}

async function cleanupReviewRewardProofs() {
  if (!REVIEW_REWARD_API_URL) return;
  const response = await fetch(REVIEW_REWARD_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": AUTOMATION_SECRET,
      ...(SUPABASE_ANON_KEY ? {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`
      } : {})
    },
    body: JSON.stringify({ action: "cleanup" }),
    signal: globalThis.AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(body.message || `Review reward cleanup returned ${response.status}`);
  }
  if (Number(body.deleted) > 0) {
    await log("Đã tự động xóa ảnh đánh giá hết hạn:", `${body.deleted} ảnh`);
  }
}

async function findChrome() {
  const configured = String(process.env.PARTNER_REVIEW_CHROME_PATH || "").trim();
  const candidates = [
    configured,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe")
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }
  throw new Error("Không tìm thấy Chrome/Edge. Hãy đặt PARTNER_REVIEW_CHROME_PATH.");
}

async function isLoginRequired(page) {
  const url = page.url().toLowerCase();
  if (url.includes("weblogin.grab.com") || url.includes("/login")) return true;
  return Boolean(await page.$(`${USERNAME_SELECTOR}, ${PASSWORD_SELECTOR}`));
}

async function waitForGrabLogin(page, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await page.waitForSelector(USERNAME_SELECTOR, {
        visible: true,
        timeout: 35_000
      });
    } catch {
      if (attempt >= maxAttempts) {
        const pageText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
        if (/securing browser|secure payment environment/i.test(pageText)) {
          throw new Error("Grab đang giữ trang ở bước kiểm tra bảo mật trình duyệt.");
        }
        throw new Error("Grab không hiển thị ô đăng nhập sau bước kiểm tra bảo mật.");
      }
      await sleep(attempt * 2_000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    }
  }
  return null;
}

async function login(page, source, { visible = false } = {}) {
  const credentials = await api("automation_credentials", { source_id: source.id });
  const username = String(credentials.credentials?.username || "");
  const password = String(credentials.credentials?.password || "");
  if (!username || !password) throw new Error("Thiếu tài khoản hoặc mật khẩu trong Supabase Vault.");

  await log("Phiên Grab hết hạn, đang đăng nhập lại:", source.display_name);
  if (!await isLoginRequired(page)) {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  if (visible) {
    await log("Đang chờ Grab hoàn tất xác minh trên cửa sổ Chrome:", source.display_name);
  }
  const usernameInput = await waitForGrabLogin(page, visible ? 10 : 2);
  if (!usernameInput) throw new Error("Không tìm thấy ô tài khoản Grab.");
  await usernameInput.type(username, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null),
    usernameInput.press("Enter")
  ]);
  const passwordInput = await page.waitForSelector(PASSWORD_SELECTOR, {
    visible: true,
    timeout: 35_000
  });
  await passwordInput.type(password, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45_000 }).catch(() => null),
    passwordInput.press("Enter")
  ]);
  if (await isLoginRequired(page)) throw new Error("Grab từ chối đăng nhập hoặc yêu cầu xác minh bổ sung.");
}

async function collectFeedback(page) {
  let requestTemplate = null;
  let overview = {};
  let sessionExpired = false;
  const pending = [];
  const onResponse = (response) => {
    const url = response.url();
    const method = response.request().method();
    if (url.includes("/feedback/reviews") && method === "POST") {
      if (response.status() === 401 || response.status() === 403) {
        sessionExpired = true;
      }
      requestTemplate = {
        url,
        headers: response.request().headers(),
        body: response.request().postData()
      };
      pending.push(response.json()
        .then(() => null)
        .catch(() => null));
    }
    if (url.includes("/feedback/overview") && method === "GET") {
      pending.push(response.json()
        .then((body) => {
          overview = body.feedbackOverview || {};
        })
        .catch(() => null));
    }
  };

  page.on("response", onResponse);
  try {
    // The listener must be attached before the feedback page sends its API
    // requests. A previous navigation may already have consumed them.
    await openFeedbackPage(page, { force: true });
    await sleep(6_000);
    await Promise.allSettled(pending);
    if (sessionExpired) {
      throw new Error("Phiên Grab hết hạn (HTTP 401/403).");
    }
    if (!requestTemplate?.body) {
      throw new Error("Không bắt được yêu cầu API đánh giá từ Grab sau khi tải lại trang.");
    }

    const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60_000);
    const end = new Date();
    const baseBody = JSON.parse(requestTemplate.body);
    baseBody.startDate = cutoff.toISOString();
    baseBody.endDate = end.toISOString();
    delete baseBody.nextToken;

    const blockedHeaders = new Set([
      "accept-encoding",
      "connection",
      "content-length",
      "cookie",
      "host",
      "origin",
      "referer",
      "user-agent"
    ]);
    const headers = Object.fromEntries(
      Object.entries(requestTemplate.headers || {})
        .filter(([name]) => (
          /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)
          && !blockedHeaders.has(name.toLowerCase())
          && !name.toLowerCase().startsWith("sec-")
        ))
    );
    const reviews = [];
    let nextToken = "";
    let pageCount = 0;

    do {
      const requestBody = { ...baseBody };
      if (nextToken) requestBody.nextToken = nextToken;
      const responseBody = await page.evaluate(async ({ url, requestHeaders, body }) => {
        const response = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: requestHeaders,
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`Grab feedback API returned ${response.status}`);
        return response.json();
      }, {
        url: requestTemplate.url,
        requestHeaders: headers,
        body: requestBody
      });
      if (!Array.isArray(responseBody?.reviews)) {
        throw new Error("Grab feedback API trả dữ liệu đánh giá không hợp lệ.");
      }
      const pageReviews = Array.isArray(responseBody?.reviews) ? responseBody.reviews : [];
      reviews.push(...pageReviews);
      nextToken = String(responseBody?.nextToken || "");
      pageCount += 1;
      if (!pageReviews.length || pageCount >= 50) nextToken = "";
    } while (nextToken);

    return {
      reviews: reviews.filter((review) => {
        const createdAt = Date.parse(review?.createdAt);
        return Number.isFinite(createdAt) && createdAt >= cutoff.getTime() && createdAt <= end.getTime();
      }),
      overview,
      pageCount
    };
  } finally {
    page.off("response", onResponse);
  }
}

async function syncSource(source, chromePath, headless = HEADLESS, allowVisibleRetry = true) {
  const startedAt = Date.now();
  const profilePath = path.join(PROFILE_ROOT, safeKey(source.account_key || source.id));
  await mkdir(profilePath, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: profilePath,
    headless,
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: { width: 1366, height: 900 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=Translate"
    ]
  });
  let browserClosed = false;

  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    page.setDefaultTimeout(30_000);
    let loggedInNow = false;
    let reviews;
    let overview;
    let pageCount;
    let directApi = false;

    if (source.merchant_id) {
      try {
        ({ reviews, overview, pageCount } = await collectFeedbackDirect(page, source));
        directApi = true;
        await log("Dùng cookie gọi trực tiếp Grab API:", source.display_name);
      } catch (error) {
        await log(
          "Chuyển sang trình duyệt để làm mới phiên:",
          `${source.display_name} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (!directApi) {
      await openFeedbackPage(page, { force: true });
      if (await isLoginRequired(page)) {
        await login(page, source, { visible: !headless });
        loggedInNow = true;
      } else {
        await log("Dùng lại phiên Grab còn hiệu lực:", source.display_name);
      }
      try {
        ({ reviews, overview, pageCount } = await collectFeedback(page));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const sessionExpired = /hết hạn|401|403/i.test(message);
        if (sessionExpired || await isLoginRequired(page)) {
          await login(page, source, { visible: !headless });
          loggedInNow = true;
          ({ reviews, overview, pageCount } = await collectFeedback(page));
        } else {
          throw error;
        }
      }
    }

    let busyResult = { applied: false, reason: "disabled" };
    if (source.busy_enabled === true) {
      try {
        const permission = await api("automation_busy_permission", { source_id: source.id });
        busyResult = permission.busy_enabled === true
          ? await setStoreBusy(page, source)
          : { applied: false, reason: "disabled_at_execution" };
        await log(
          busyResult.applied ? "Đã kéo Busy 15 phút:" : "Đã bỏ qua Busy an toàn:",
          `${source.display_name} - ${busyResult.reason || busyResult.fromState || "ok"}`
        );
      } catch (busyError) {
        busyResult = {
          applied: false,
          reason: "error",
          error: String(busyError?.message || busyError).slice(0, 500)
        };
        await log("Không kéo được Busy, vẫn tiếp tục đồng bộ:", `${source.display_name} - ${busyResult.error}`);
      }
    }

    const session = loggedInNow
      ? {
          cookies: await page.cookies(),
          storage: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
        }
      : {};
    const merchantId = String(reviews.find((review) => review?.merchantID)?.merchantID || "");
    const result = await api("automation_reviews", {
      source_id: source.id,
      merchant_id: merchantId,
      overview,
      reviews,
      session,
      busy_result: busyResult
    });
    await log(
      "Đồng bộ thành công:",
      `${source.display_name} - ${result.upserted_count} đánh giá / ${pageCount} trang / ${Math.round((Date.now() - startedAt) / 1000)} giây / ${directApi ? "API trực tiếp" : "trình duyệt"}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsVisibleLogin = /kiểm tra bảo mật|không hiển thị ô đăng nhập/i.test(message);
    if (headless && allowVisibleRetry && needsVisibleLogin) {
      await browser.close();
      browserClosed = true;
      await log("Grab chặn đăng nhập ẩn, chuyển sang Chrome hiển thị:", source.display_name);
      return syncSource(source, chromePath, false, false);
    }
    throw error;
  } finally {
    if (!browserClosed) await browser.close();
  }
}

async function runSource(source, chromePath) {
  await log("Bắt đầu đồng bộ:", source.display_name);
  try {
    await syncSource(source, chromePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log("Đồng bộ thất bại:", `${source.display_name} - ${message}`);
    await api("automation_failure", {
      source_id: source.id,
      worker_id: WORKER_ID,
      error_message: message,
      auth_expired: /đăng nhập|login|401|403|xác minh/i.test(message)
    }).catch(() => null);
  }
}

async function runCycle(chromePath) {
  await cleanupReviewRewardProofs().catch((error) =>
    log("Chưa dọn được ảnh đánh giá hết hạn:", error instanceof Error ? error.message : String(error))
  );
  const batch = await api("automation_sources", {
    worker_id: WORKER_ID,
    limit: BATCH_SIZE
  });
  const sources = Array.isArray(batch.sources) ? batch.sources : [];
  if (!sources.length) {
    await log("Không có gian hàng đang bật đồng bộ.");
    return intervalMs(batch.settings?.sync_interval_minutes);
  }
  await log(
    CONCURRENCY === 1 ? "Chạy lần lượt:" : "Chạy theo nhóm:",
    `${sources.length} gian hàng, dữ liệu ${REVIEW_WINDOW_DAYS} ngày gần nhất`
  );
  for (let index = 0; index < sources.length && !stopping; index += CONCURRENCY) {
    await Promise.all(
      sources
        .slice(index, index + CONCURRENCY)
        .map((source) => runSource(source, chromePath))
    );
    if (CONCURRENCY === 1 && index < sources.length - 1) await sleep(5_000);
  }
  return intervalMs(batch.settings?.sync_interval_minutes);
}

async function collectFeedbackDirect(page, source) {
  const merchantId = String(source.merchant_id || "").trim();
  if (!merchantId) throw new Error("Chưa có Merchant ID để gọi trực tiếp Grab API.");
  const cookies = await page.cookies("https://api.grab.com/", "https://merchant.grab.com/");
  const cookie = cookieHeader(cookies);
  if (!cookie) throw new Error("Chưa có cookie Grab API trong Chrome profile.");

  const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60_000);
  const end = new Date();
  const request = async (path, options = {}) => {
    const response = await fetch(`${FEEDBACK_API_URL}${path}`, {
      ...options,
      headers: {
        accept: "application/json, text/plain, */*",
        cookie,
        merchantid: merchantId,
        origin: "https://merchant.grab.com",
        referer: "https://merchant.grab.com/",
        requestsource: "troyPortal",
        ...(options.body ? { "content-type": "application/json" } : {})
      },
      signal: globalThis.AbortSignal.timeout(30_000)
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Phiên Grab hết hạn (HTTP ${response.status}).`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Grab feedback API returned ${response.status}`);
    return body;
  };

  const baseBody = {
    serviceType: "DELIVERY",
    startDate: cutoff.toISOString(),
    endDate: end.toISOString(),
    merchantIDs: [merchantId],
    businessTypeFilter: 0,
    includeEmptyReviews: true
  };
  const reviews = [];
  let nextToken = "";
  let pageCount = 0;
  do {
    const body = await request("/reviews", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, ...(nextToken ? { nextToken } : {}) })
    });
    if (!Array.isArray(body?.reviews)) throw new Error("Grab feedback API trả dữ liệu đánh giá không hợp lệ.");
    reviews.push(...body.reviews);
    nextToken = String(body.nextToken || "");
    pageCount += 1;
    if (!body.reviews.length || pageCount >= 50) nextToken = "";
  } while (nextToken);

  const query = new URLSearchParams({
    serviceType: "DELIVERY",
    startDate: cutoff.toISOString(),
    endDate: end.toISOString(),
    "merchantIDs[]": merchantId,
    businessTypeFilter: "0",
    include_empty_reviews: "true"
  });
  const overviewBody = await request(`/overview?${query}`);
  return {
    reviews: reviews.filter((review) => {
      const createdAt = Date.parse(review?.createdAt);
      return Number.isFinite(createdAt) && createdAt >= cutoff.getTime() && createdAt <= end.getTime();
    }),
    overview: overviewBody?.feedbackOverview || {},
    pageCount
  };
}

async function setStoreState(page, source, action) {
  if (!["busy", "normal"].includes(action)) throw new Error("Lệnh trạng thái Grab không hợp lệ.");
  const merchantId = String(source.merchant_id || "").trim();
  if (!merchantId) return { applied: false, reason: "missing_merchant_id" };
  const cookies = await page.cookies("https://merchant.grab.com/", "https://api.grab.com/");
  const cookie = cookieHeader(cookies);
  if (!cookie) throw new Error("Chưa có cookie Grab Portal để đổi trạng thái cửa hàng.");

  const request = async (requestPath, options = {}) => {
    const response = await fetch(`https://merchant.grab.com/${requestPath.replace(/^\/+/, "")}`, {
      ...options,
      headers: {
        accept: "application/json, text/plain, */*",
        cookie,
        origin: "https://merchant.grab.com",
        referer: "https://merchant.grab.com/",
        requestsource: "troyPortal",
        merchantid: merchantId,
        ...(options.body ? { "content-type": "application/json" } : {})
      },
      signal: globalThis.AbortSignal.timeout(30_000)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Grab Portal trả HTTP ${response.status}.`);
    return body;
  };

  const payload = await request("food/merchant/v3/open-status");
  const candidates = [payload?.data, payload?.result, payload];
  const status = candidates.find((value) => value && typeof value === "object" && ("isOpen" in value || "closeReason" in value));
  if (!status) return { applied: false, reason: "unknown_status" };
  const closeReason = Number(status.closeReason || 0);
  if (status.isOpen !== true && CLOSED_STORE_REASONS.has(closeReason)) {
    return { applied: false, reason: "closed", closeReason };
  }
  const fromState = status.isOpen === true
    ? (status.isMexInBusyMode ? "BUSY" : "NORMAL")
    : PAUSED_STORE_REASONS.get(closeReason);
  if (!fromState) return { applied: false, reason: "unknown_state", closeReason };

  if (action === "normal" && fromState === "NORMAL") {
    return { applied: false, reason: "already_normal", fromState };
  }

  await request("food/merchant/v1/merchant/status", {
    method: "PUT",
    body: JSON.stringify({
      fromState,
      toState: action === "busy" ? "BUSY" : "NORMAL",
      busyModeRequest: action === "busy"
        ? { busyModeFoodPrepareTime: 15, busyModeStartTime: null }
        : {},
      tempPauseRequest: {}
    })
  });
  return { applied: true, action, ...(action === "busy" ? { minutes: 15 } : {}), fromState };
}

async function setStoreBusy(page, source) {
  if (source.busy_enabled !== true) return { applied: false, reason: "disabled" };
  return setStoreState(page, source, "busy");
}

async function runStoreControl(source, chromePath) {
  const action = String(source.store_control_action || "").toLowerCase();
  const profilePath = path.join(PROFILE_ROOT, safeKey(source.account_key || source.id));
  await mkdir(profilePath, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: profilePath,
    headless: HEADLESS,
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: { width: 1366, height: 900 },
    args: ["--no-first-run", "--no-default-browser-check", "--disable-blink-features=AutomationControlled"]
  });
  let result = {};
  let succeeded = false;
  let errorMessage = "";
  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    page.setDefaultTimeout(30_000);
    try {
      result = await setStoreState(page, source, action);
    } catch {
      await openFeedbackPage(page, { force: true });
      if (await isLoginRequired(page)) await login(page, source, { visible: !HEADLESS });
      result = await setStoreState(page, source, action);
    }
    succeeded = result.applied === true || result.reason === "already_normal";
    if (!succeeded) errorMessage = `Grab từ chối đổi trạng thái: ${result.reason || "unknown"}.`;
    await log(
      succeeded ? "Đã xử lý công tắc cửa hàng:" : "Không đổi trạng thái cửa hàng:",
      `${source.display_name} - ${action} - ${result.reason || result.fromState || "ok"}`
    );
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    result = { applied: false, action, reason: "error", error: errorMessage.slice(0, 500) };
    await log("Lệnh công tắc cửa hàng lỗi:", `${source.display_name} - ${errorMessage}`);
  } finally {
    await browser.close().catch(() => null);
    await api("automation_store_command_result", {
      source_id: source.id,
      store_control_requested_at: source.store_control_requested_at,
      succeeded,
      result,
      error: errorMessage
    }).catch((error) => log("Chưa ghi được kết quả công tắc:", error instanceof Error ? error.message : String(error)));
  }
}

async function pollStoreControls(chromePath) {
  const batch = await api("automation_store_commands", { worker_id: WORKER_ID, limit: CONCURRENCY });
  const sources = Array.isArray(batch.sources) ? batch.sources : [];
  if (!sources.length) return;
  await Promise.all(sources.map((source) => runStoreControl(source, chromePath)));
}

async function readRemoteInterval(fallbackMs) {
  try {
    const result = await api("automation_settings");
    return intervalMs(result.settings?.sync_interval_minutes);
  } catch (error) {
    await log("Chưa đọc được lịch đồng bộ mới, giữ lịch hiện tại:", error instanceof Error ? error.message : String(error));
    return fallbackMs;
  }
}

async function saveNextRun(nextRunAt) {
  await api("automation_heartbeat", {
    worker_id: WORKER_ID,
    next_run_at: nextRunAt.toISOString()
  }).catch((error) => log("Chưa ghi được lần chạy kế tiếp:", error instanceof Error ? error.message : String(error)));
}

async function acquireLock() {
  await mkdir(LOCAL_ROOT, { recursive: true });
  try {
    lockHandle = await open(LOCK_PATH, "wx");
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const lockStat = await stat(LOCK_PATH).catch(() => null);
    if (!lockStat || Date.now() - lockStat.mtimeMs > 6 * 60 * 60_000) {
      await rm(LOCK_PATH, { force: true });
      lockHandle = await open(LOCK_PATH, "wx");
    } else {
      throw new Error("Worker đánh giá đang chạy ở tiến trình khác.");
    }
  }
  await lockHandle.writeFile(JSON.stringify({ pid: process.pid, worker_id: WORKER_ID }));
}

async function releaseLock() {
  await lockHandle?.close().catch(() => null);
  await rm(LOCK_PATH, { force: true }).catch(() => null);
}

async function main() {
  if (!API_URL || !AUTOMATION_SECRET) {
    throw new Error("Thiếu PARTNER_REVIEW_API_URL hoặc PARTNER_REVIEW_AUTOMATION_SECRET.");
  }
  await acquireLock();
  const chromePath = await findChrome();
  await log("Worker đánh giá đã khởi động:", `${WORKER_ID} - ${HEADLESS ? "ẩn" : "hiện Chrome"}`);

  let currentIntervalMs = await runCycle(chromePath);
  let lastCycleCompletedAt = Date.now();
  let lastSettingsReadAt = 0;
  await saveNextRun(new Date(lastCycleCompletedAt + currentIntervalMs));
  await log("Lần đồng bộ kế tiếp:", new Date(lastCycleCompletedAt + currentIntervalMs).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));

  while (!RUN_ONCE && !stopping) {
    await sleep(10_000);
    if (stopping) break;
    await pollStoreControls(chromePath).catch((error) =>
      log("Chưa đọc được lệnh công tắc cửa hàng:", error instanceof Error ? error.message : String(error))
    );
    if (Date.now() - lastSettingsReadAt >= 60_000) {
      const previousIntervalMs = currentIntervalMs;
      currentIntervalMs = await readRemoteInterval(currentIntervalMs);
      lastSettingsReadAt = Date.now();
      if (currentIntervalMs !== previousIntervalMs) {
        await saveNextRun(new Date(lastCycleCompletedAt + currentIntervalMs));
        await log("Đã nhận lịch đồng bộ mới:", `${Math.round(currentIntervalMs / 60_000)} phút/lần`);
      }
    }
    if (Date.now() - lastCycleCompletedAt < currentIntervalMs) continue;
    currentIntervalMs = await runCycle(chromePath);
    lastCycleCompletedAt = Date.now();
    await saveNextRun(new Date(lastCycleCompletedAt + currentIntervalMs));
    await log("Lần đồng bộ kế tiếp:", new Date(lastCycleCompletedAt + currentIntervalMs).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

main()
  .catch(async (error) => {
    await log("Worker dừng do lỗi:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(releaseLock);
