import { CookieJar } from "tough-cookie";
import { addBrowserCookies } from "./grab-direct-auth.mjs";

export default async function restoreCookieJar(rawSession, page = null) {
  let session = {};
  try {
    session = typeof rawSession === "string" ? JSON.parse(rawSession || "{}") : rawSession || {};
    if (session.cookieJar) return await CookieJar.deserialize(session.cookieJar);
  } catch {
    // Legacy or damaged snapshots can still fall back to browser cookies.
  }
  const cookies = Array.isArray(session.cookies) && session.cookies.length
    ? session.cookies : page ? await page.cookies(
      "https://merchant.grab.com/", "https://api.grab.com/", "https://weblogin.grab.com/"
    ) : [];
  const jar = new CookieJar();
  await addBrowserCookies(jar, cookies);
  return jar;
}
