import assert from "node:assert/strict";
import test from "node:test";
import { CookieJar } from "tough-cookie";
import { addBrowserCookies, cookiesForBrowser } from "./grab-direct-auth.mjs";
import restoreCookieJar from "./grab-session.mjs";

test("domain cookies survive browser round trip; host-only cookies stay scoped", async () => {
  const jar = new CookieJar();
  await jar.setCookie("shared=session; Domain=grab.com; Path=/; Secure; HttpOnly", "https://api.grab.com/");
  await jar.setCookie("private=portal; Path=/; Secure", "https://merchant.grab.com/");
  const cookies = await cookiesForBrowser(jar);
  assert.equal(cookies.find((cookie) => cookie.name === "shared").domain, ".grab.com");
  assert.equal(cookies.find((cookie) => cookie.name === "private").domain, "merchant.grab.com");
  const restored = new CookieJar();
  await addBrowserCookies(restored, cookies);
  assert.equal(await restored.getCookieString("https://api.grab.com/"), "shared=session");
  assert.equal(await restored.getCookieString("https://child.merchant.grab.com/"), "shared=session");
  assert.equal(await restored.getCookieString("https://unrelated.example/"), "");
});

test("serialized API session preserves rotated cookies and expiration", async () => {
  const jar = new CookieJar();
  await jar.setCookie("mexusers_authn_token_jti=old; Domain=grab.com; Path=/", "https://api.grab.com/");
  await jar.setCookie("mexusers_authn_token_jti=new; Domain=grab.com; Path=/", "https://api.grab.com/");
  await jar.setCookie("expired=no; Max-Age=0; Path=/", "https://api.grab.com/");
  const restored = await restoreCookieJar(JSON.stringify({ cookieJar: await jar.serialize() }));
  assert.equal(await restored.getCookieString("https://api.grab.com/"), "mexusers_authn_token_jti=new");
});

test("legacy browser session restores without starting a browser", async () => {
  const restored = await restoreCookieJar(JSON.stringify({ cookies: [
    { name: "session", value: "legacy", domain: ".grab.com", path: "/", secure: true, expires: -1 }
  ] }));
  assert.equal(await restored.getCookieString("https://api.grab.com/"), "session=legacy");
  assert.equal(await (await restoreCookieJar("broken-json")).getCookieString("https://api.grab.com/"), "");
});
