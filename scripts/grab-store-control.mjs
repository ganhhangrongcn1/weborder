import GRAB_API from "./grab-api-endpoints.mjs";
import grabCsrfHeaders from "./grab-csrf-headers.mjs";
const PORTAL = GRAB_API.portal;
const CLOSED_REASONS = new Set([3, 4, 5, 7, 8]);
const PAUSED_REASONS = new Map([[1, "TEMPPAUSED"], [2, "OPSPAUSED"], [6, "OPSPAUSED"]]);

function readStatus(payload) {
  return [payload?.data, payload?.result, payload].find((value) =>
    value && typeof value === "object" && ("isOpen" in value || "closeReason" in value)
  );
}

// Keep credentials scoped to the exact request URL, including refreshed cookies.
export default async function setGrabStoreState(page, source, action, {
  cookieJar = null,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!["busy", "normal"].includes(action)) throw new Error("Lệnh trạng thái Grab không hợp lệ.");
  const merchantId = String(source.merchant_id || "").trim();
  if (!merchantId) return { applied: false, reason: "missing_merchant_id" };

  const request = async (requestPath, options = {}) => {
    const url = `${GRAB_API.foodOrigin}/${requestPath}`;
    const cookies = cookieJar ? [] : await page.cookies(url);
    const cookie = cookieJar ? await cookieJar.getCookieString(url) : cookies
      .filter((item) => !item.expires || item.expires < 0 || item.expires * 1000 > Date.now())
      .map((item) => `${item.name}=${item.value}`).join("; ");
    if (!cookie) throw new Error("Chưa có cookie Grab Portal để đổi trạng thái cửa hàng.");
    const response = await fetchImpl(url, {
      ...options,
      redirect: "error",
      headers: {
        accept: "application/json, text/plain, */*",
        cookie,
        origin: PORTAL,
        referer: `${PORTAL}/`,
        requestsource: "troyPortal",
        "x-client-id": "GrabMerchant-Portal",
        "x-grabkit-clientid": "grabmerchant-portal",
        merchantid: merchantId,
        ...grabCsrfHeaders(cookie, options.method || "GET"),
        ...(options.body ? { "content-type": "application/json" } : {})
      },
      signal: AbortSignal.timeout(30_000)
    });
    const updates = response.headers.getSetCookie?.() || [];
    if (cookieJar) {
      for (const value of updates) await cookieJar.setCookie(value, url);
    }
    // A forbidden operation must not trigger repeated login attempts.
    if (response.status === 401 || response.status === 403) {
      const error = new Error(response.status === 401
        ? "Phiên Grab hết hạn (HTTP 401)."
        : `Grab từ chối ${options.method || "GET"} /${requestPath} (HTTP 403); cần kiểm tra phiên và quyền truy cập.`);
      error.code = response.status === 401 ? "GRAB_SESSION_EXPIRED" : "GRAB_STORE_FORBIDDEN";
      throw error;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Grab Portal trả HTTP ${response.status}.`);
    return body;
  };

  const status = readStatus(await request(GRAB_API.openStatus));
  if (!status) return { applied: false, reason: "unknown_status" };
  const closeReason = Number(status.closeReason || 0);
  if (status.isOpen !== true && CLOSED_REASONS.has(closeReason)) {
    return { applied: false, reason: "closed", closeReason };
  }
  const fromState = status.isOpen === true
    ? (status.isMexInBusyMode ? "BUSY" : "NORMAL")
    : PAUSED_REASONS.get(closeReason);
  if (!fromState) return { applied: false, reason: "unknown_state", closeReason };
  if (action === "normal" && fromState === "NORMAL") {
    return { applied: false, reason: "already_normal", fromState };
  }

  await request(GRAB_API.storeStatus, {
    method: "PUT",
    body: JSON.stringify({
      fromState,
      toState: action === "busy" ? "BUSY" : "NORMAL",
      busyModeRequest: action === "busy"
        ? { busyModeFoodPrepareTime: 15, busyModeStartTime: null } : {},
      tempPauseRequest: {}
    })
  });
  const confirmed = readStatus(await request(GRAB_API.openStatus));
  const verified = confirmed?.isOpen === true && (action === "busy"
    ? confirmed.isMexInBusyMode === true
    : confirmed.isMexInBusyMode === false);
  if (!verified) return { applied: false, action, reason: "status_unconfirmed", fromState };
  return { applied: true, action, ...(action === "busy" ? { minutes: 15 } : {}), fromState };
}
