import { config } from "dotenv";
import { CookieJar } from "tough-cookie";
import GRAB_API from "./grab-api-endpoints.mjs";
import puppeteer from "puppeteer-core";
import { loginGrabDirect } from "./grab-direct-auth.mjs";

// Read-only check using encrypted Admin sessions; never print credentials.
export default async function checkStore(sourceId) {
  const response = await fetch(process.env.PARTNER_REVIEW_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": process.env.PARTNER_REVIEW_AUTOMATION_SECRET,
      apikey: process.env.PARTNER_REVIEW_ANON_KEY,
      authorization: `Bearer ${process.env.PARTNER_REVIEW_ANON_KEY}`
    },
    body: JSON.stringify({ action: "automation_credentials", source_id: sourceId }),
    signal: AbortSignal.timeout(30000)
  });
  const auth = await response.json();
  if (!response.ok || !auth.ok) throw new Error(`Admin HTTP ${response.status}`);
  const session = JSON.parse(auth.credentials?.session || "{}");
  let jar = new CookieJar();
  for (const cookie of session.cookies || []) {
    if (cookie.expires > 0 && cookie.expires * 1000 <= Date.now()) continue;
    const domain = String(cookie.domain || "").replace(/^\./, "");
    if (!domain) continue;
    await jar.setCookie(`${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path || "/"}${cookie.secure ? "; Secure" : ""}`, `https://${domain}${cookie.path || "/"}`);
  }
  if (process.argv.includes("--login")) {
    const browser = await puppeteer.launch({
      executablePath: process.env.PARTNER_REVIEW_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check"]
    });
    try { jar = (await loginGrabDirect(browser, auth.credentials)).jar; }
    finally { await browser.close(); }
  }
  const url = `${GRAB_API.foodOrigin}/${GRAB_API.openStatus}`;
  const cookie = await jar.getCookieString(url);
  const result = await fetch(url, {
    redirect: "error",
    headers: {
      accept: "application/json, text/plain, */*", cookie,
      merchantid: auth.source.merchant_id,
      origin: GRAB_API.portal, referer: `${GRAB_API.portal}/`,
      requestsource: "troyPortal",
      "x-client-id": "GrabMerchant-Portal", "x-grabkit-clientid": "grabmerchant-portal"
    },
    signal: AbortSignal.timeout(30000)
  });
  const data = await result.json().catch(() => null);
  const status = data?.data || data?.result || data;
  return {
    sourceId, name: auth.source.display_name,
    credentialsConfigured: Boolean(auth.credentials?.username && auth.credentials?.password),
    status: result.status, isOpen: status?.isOpen, isBusy: status?.isMexInBusyMode
  };
}

config({ path: ".env.partner-review-worker", quiet: true });
for (const id of process.argv.slice(2).filter((arg) => !arg.startsWith("--"))) {
  try { console.log(JSON.stringify(await checkStore(id))); }
  catch (error) { console.log(JSON.stringify({ sourceId: id, code: error.code || "CHECK_FAILED", error: "Không kiểm tra được phiên Grab. Không thay đổi trạng thái quán." })); process.exitCode = 1; }
}
