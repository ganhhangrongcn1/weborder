import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (await readFile(new URL("../src/services/promotionSessionService.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "");
const { default: subscribe } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("promotion visibility refreshes after login, ignores stale anonymous reads and stops on cleanup", async () => {
  let authCallback;
  let unsubscribed = false;
  const client = { auth: { onAuthStateChange(callback) {
    authCallback = callback;
    return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
  } } };
  const pending = [];
  const values = [];
  const stop = subscribe((value) => values.push(value), { client, read(key, fallback, options) {
    assert.equal(key, "ghr_smart_promotions");
    assert.equal(options.force, true);
    return new Promise((resolve) => pending.push(resolve));
  } });
  authCallback("INITIAL_SESSION", null);
  await tick();
  authCallback("SIGNED_IN", { user: { id: "admin" } });
  await tick();
  pending[1](["global", "vietsing"]);
  await tick();
  pending[0](["global"]);
  await tick();
  assert.deepEqual(values.at(-1), ["global", "vietsing"]);
  authCallback("TOKEN_REFRESHED", { user: { id: "admin" } });
  await tick();
  assert.equal(pending.length, 2);
  authCallback("SIGNED_OUT", null);
  await tick();
  pending[2](["global"]);
  await tick();
  assert.deepEqual(values.at(-1), ["global"]);
  stop();
  assert.equal(unsubscribed, true);
});
