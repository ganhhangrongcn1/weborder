import { CookieJar } from "tough-cookie";

const LOGIN_ENDPOINT = "https://api.grab.com/grabid/v1/authnv4/login";
const VERIFY_ENDPOINT = "https://api.grab.com/grabid/v1/challengesession/challengeSession/verifyChallenge";
const LOGIN_URL = "https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal";
const REDIRECT_URL = "https://merchant.grab.com/portal";

function directAuthError(message, status = 0, code = "") {
  const error = new Error(message);
  error.status = Number(status || 0);
  if (code) error.code = code;
  return error;
}

async function addBrowserCookies(jar, cookies) {
  for (const cookie of cookies) {
    const domain = String(cookie.domain || "").replace(/^\./, "");
    if (!domain || !cookie.name) continue;
    const url = `${cookie.secure ? "https" : "http"}://${domain}${cookie.path || "/"}`;
    const attributes = [
      `${cookie.name}=${cookie.value}`,
      `Path=${cookie.path || "/"}`,
      `Domain=${cookie.domain || domain}`,
      cookie.secure ? "Secure" : "",
      cookie.httpOnly ? "HttpOnly" : "",
      Number(cookie.expires) > 0 ? `Expires=${new Date(cookie.expires * 1000).toUTCString()}` : ""
    ].filter(Boolean).join("; ");
    await jar.setCookie(attributes, url);
  }
}

async function storeResponseCookies(jar, response, url) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  for (const value of values) await jar.setCookie(value, url);
}

function createRequester(jar, fingerprint) {
  return async (url, options = {}) => {
    const cookie = await jar.getCookieString(url);
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      headers: {
        accept: "application/json, text/plain, */*",
        origin: "https://weblogin.grab.com",
        referer: "https://weblogin.grab.com/",
        "user-agent": fingerprint.userAgent,
        "x-hydraweb-jwt": fingerprint.hydra,
        "x-tracking-id": fingerprint.trackingId,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(options.headers || {})
      },
      signal: globalThis.AbortSignal.timeout(30_000)
    });
    await storeResponseCookies(jar, response, url);
    return response;
  };
}

async function readJson(response) {
  return { response, data: await response.json().catch(() => null) };
}

async function followRedirects(request, initialUrl) {
  let url = initialUrl;
  for (let index = 0; index < 10; index += 1) {
    const response = await request(url, { method: "GET" });
    if (response.status < 300 || response.status >= 400) return;
    const location = response.headers.get("location");
    if (!location) throw directAuthError("Grab trả chuyển hướng đăng nhập không hợp lệ.", response.status);
    url = new URL(location, url).toString();
  }
  throw directAuthError("Grab chuyển hướng đăng nhập quá nhiều lần.");
}

async function captureHydraFingerprint(browser, username, timeoutMs = 60_000) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  let finish;
  let fail;
  const captured = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const timer = setTimeout(() => fail(directAuthError(
    "Grab không tạo được mã nhận diện trình duyệt.",
    0,
    "GRAB_DIRECT_AUTH_UNAVAILABLE"
  )), timeoutMs);

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().startsWith(LOGIN_ENDPOINT) && request.method() === "POST") {
      const headers = request.headers();
      request.abort("blockedbyclient").catch(() => null);
      if (!headers["x-hydraweb-jwt"] || !headers["x-tracking-id"]) {
        fail(directAuthError("Grab không cung cấp đủ mã xác thực Hydra.", 0, "GRAB_DIRECT_AUTH_UNAVAILABLE"));
        return;
      }
      context.cookies().then((cookies) => finish({
        hydra: headers["x-hydraweb-jwt"],
        trackingId: headers["x-tracking-id"],
        userAgent: headers["user-agent"],
        cookies
      }), fail);
      return;
    }
    request.continue().catch(() => null);
  });

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const usernameInput = await page.waitForSelector("input[type='text'], input[name='username'], input[autocomplete='username']", {
      visible: true,
      timeout: Math.min(timeoutMs, 35_000)
    });
    await usernameInput.type(username, { delay: 20 });
    await usernameInput.press("Enter");
    return await captured;
  } catch (error) {
    if (error?.code) throw error;
    throw directAuthError(`Không lấy được mã Hydra từ Grab: ${error.message}`, 0, "GRAB_DIRECT_AUTH_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
    await context.close().catch(() => null);
  }
}

async function cookiesForBrowser(jar) {
  const cookieSets = await Promise.all([
    jar.getCookies("https://api.grab.com/"),
    jar.getCookies("https://merchant.grab.com/"),
    jar.getCookies("https://weblogin.grab.com/")
  ]);
  const unique = new Map();
  for (const cookie of cookieSets.flat()) {
    const domain = cookie.domain || "";
    const key = `${cookie.key}|${domain}|${cookie.path || "/"}`;
    unique.set(key, {
      name: cookie.key,
      value: cookie.value,
      domain,
      path: cookie.path || "/",
      expires: cookie.expires instanceof Date ? Math.floor(cookie.expires.getTime() / 1000) : -1,
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure),
      ...(["strict", "lax", "none"].includes(String(cookie.sameSite || "").toLowerCase())
        ? { sameSite: String(cookie.sameSite).toLowerCase().replace(/^./, (character) => character.toUpperCase()) }
        : {})
    });
  }
  return [...unique.values()];
}

export async function loginGrabDirect(browser, { username, password }) {
  const fingerprint = await captureHydraFingerprint(browser, username);
  const jar = new CookieJar();
  await addBrowserCookies(jar, fingerprint.cookies);
  const request = createRequester(jar, fingerprint);
  const loginBody = {
    challengeSessionID: "",
    accountIdentifier: username,
    accountIdentifierType: "USERNAME",
    serviceID: "MEXUSERS",
    redirect: REDIRECT_URL
  };

  const first = await readJson(await request(LOGIN_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(loginBody)
  }));
  const challengeSessionID = first.data?.details?.challengeSessionID;
  const challengeType = first.data?.details?.currentGeneratedChallenge?.challengeType;
  if (!challengeSessionID || challengeType !== "PWD_V2") {
    const interactive = Boolean(challengeType && challengeType !== "PWD_V2");
    throw directAuthError(
      first.data?.message || `Grab không trả thử thách mật khẩu (HTTP ${first.response.status}).`,
      first.response.status,
      interactive ? "GRAB_INTERACTIVE_AUTH_REQUIRED" : ""
    );
  }

  const verified = await readJson(await request(VERIFY_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ challengeSessionID, challengeType, payload: { code: password } })
  }));
  if (!verified.response.ok || verified.data?.isCompleted !== true) {
    throw directAuthError(
      verified.data?.message || `Grab từ chối mật khẩu (HTTP ${verified.response.status}).`,
      verified.response.status
    );
  }

  const completed = await readJson(await request(LOGIN_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ ...loginBody, challengeSessionID })
  }));
  if (!completed.response.ok || !completed.data?.redirect) {
    throw directAuthError(
      completed.data?.message || `Grab không hoàn tất đăng nhập (HTTP ${completed.response.status}).`,
      completed.response.status
    );
  }
  await followRedirects(request, completed.data.redirect);
  const cookies = await cookiesForBrowser(jar);
  if (!cookies.length) throw directAuthError("Grab đăng nhập thành công nhưng không trả cookie API.");
  return { cookies, jar };
}
