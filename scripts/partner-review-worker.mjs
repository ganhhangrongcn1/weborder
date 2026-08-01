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
const LOGIN_URL = "https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal";
const API_URL = String(process.env.PARTNER_REVIEW_API_URL || "").trim();
const REVIEW_REWARD_API_URL = String(
  process.env.REVIEW_REWARD_API_URL
  || API_URL.replace(/partner-review-source-api\/?$/i, "review-reward-api")
).trim();
const AUTOMATION_SECRET = String(process.env.PARTNER_REVIEW_AUTOMATION_SECRET || "").trim();
const INTERVAL_MS = Math.max(5, Number(process.env.PARTNER_REVIEW_INTERVAL_MINUTES) || 60) * 60_000;
const REVIEW_WINDOW_DAYS = Math.max(1, Number(process.env.PARTNER_REVIEW_WINDOW_DAYS) || 2);
const BATCH_SIZE = Math.min(50, Math.max(1, Number(process.env.PARTNER_REVIEW_BATCH_SIZE) || 4));
const CONCURRENCY = Math.min(8, Math.max(1, Number(process.env.PARTNER_REVIEW_CONCURRENCY) || 1));
const HEADLESS = String(process.env.PARTNER_REVIEW_HEADLESS || "true").toLowerCase() !== "false";
const RUN_ONCE = process.argv.includes("--once");
const WORKER_ID = `${hostname()}:${process.pid}`;

let lockHandle = null;
let stopping = false;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const safeKey = (value) => String(value || "source").replace(/[^a-zA-Z0-9_-]+/g, "_");

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
      "x-automation-secret": AUTOMATION_SECRET
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(30_000)
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
      "x-automation-secret": AUTOMATION_SECRET
    },
    body: JSON.stringify({ action: "cleanup" }),
    signal: AbortSignal.timeout(30_000)
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
  return Boolean(await page.$("#Username, input[type='password']"));
}

async function login(page, source) {
  const credentials = await api("automation_credentials", { source_id: source.id });
  const username = String(credentials.credentials?.username || "");
  const password = String(credentials.credentials?.password || "");
  if (!username || !password) throw new Error("Thiếu tài khoản hoặc mật khẩu trong Supabase Vault.");

  await log("Phiên Grab hết hạn, đang đăng nhập lại:", source.display_name);
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#Username", { timeout: 30_000 });
  await page.type("#Username", username, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null),
    page.click("button")
  ]);
  await page.waitForSelector("input[type='password']", { timeout: 30_000 });
  await page.type("input[type='password']", password, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45_000 }).catch(() => null),
    page.click("button")
  ]);
  if (await isLoginRequired(page)) throw new Error("Grab từ chối đăng nhập hoặc yêu cầu xác minh bổ sung.");
}

async function collectFeedback(page) {
  let requestTemplate = null;
  let overview = {};
  const pending = [];
  const onResponse = (response) => {
    const url = response.url();
    const method = response.request().method();
    if (url.includes("/feedback/reviews") && method === "POST") {
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
    await openFeedbackPage(page);
    await sleep(6_000);
    await Promise.allSettled(pending);
    if (!requestTemplate?.body) return { reviews: [], overview, pageCount: 0 };

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

async function syncSource(source, chromePath) {
  const startedAt = Date.now();
  const profilePath = path.join(PROFILE_ROOT, safeKey(source.account_key || source.id));
  await mkdir(profilePath, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: profilePath,
    headless: HEADLESS,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate"
    ]
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    page.setDefaultTimeout(30_000);
    await openFeedbackPage(page, { force: true });

    let loggedInNow = false;
    if (await isLoginRequired(page)) {
      await login(page, source);
      loggedInNow = true;
    } else {
      await log("Dùng lại phiên Grab còn hiệu lực:", source.display_name);
    }

    let { reviews, overview, pageCount } = await collectFeedback(page);
    if (!reviews.length) {
      if (await isLoginRequired(page)) {
        await login(page, source);
        loggedInNow = true;
        const retried = await collectFeedback(page);
        reviews = retried.reviews;
        overview = retried.overview;
        pageCount = retried.pageCount;
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
      session
    });
    await log(
      "Đồng bộ thành công:",
      `${source.display_name} - ${result.upserted_count} đánh giá / ${pageCount} trang / ${Math.round((Date.now() - startedAt) / 1000)} giây`
    );
  } finally {
    await browser.close();
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
    return;
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

  await runCycle(chromePath);

  while (!RUN_ONCE && !stopping) {
    await sleep(INTERVAL_MS);
    if (!stopping) await runCycle(chromePath);
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
