import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("failed remote shipping save preserves state and does not write local cache or retry", async () => {
  const source = readFileSync(new URL("../src/pages/admin/actions/useAdminStoreConfigActions.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  const calls = [];
  globalThis.__shippingSaveFixture = {
    saveShippingConfig: (value) => { calls.push("cache"); return value; },
    saveShippingConfigStrictAsync: async () => { calls.push("remote"); throw Error("fixture failure"); }
  };
  const module = await import("data:text/javascript;base64," + Buffer.from("const {saveShippingConfig,saveShippingConfigStrictAsync}=globalThis.__shippingSaveFixture;\n" + source).toString("base64"));
  const actions = module.default({ supabaseConfigSyncEnabled: true, shippingConfig: { baseFeeFirst3Km: 15000 }, setShippingConfig: () => calls.push("state") });
  await assert.rejects(actions.handleSaveShipping({ baseFeeFirst3Km: 19000 }), /fixture failure/);
  assert.deepEqual(calls, ["remote"]);
  delete globalThis.__shippingSaveFixture;
});

test("successful remote shipping save updates cache and state after acknowledgement", async () => {
  const source = readFileSync(new URL("../src/pages/admin/actions/useAdminStoreConfigActions.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  const calls = [];
  globalThis.__shippingSaveFixture = {
    saveShippingConfig: (value) => { calls.push("cache"); return value; },
    saveShippingConfigStrictAsync: async (value) => { calls.push("remote"); return value; }
  };
  const module = await import("data:text/javascript;base64," + Buffer.from("const {saveShippingConfig,saveShippingConfigStrictAsync}=globalThis.__shippingSaveFixture;\n" + source + "\n// success fixture").toString("base64"));
  let saved;
  const actions = module.default({ supabaseConfigSyncEnabled: true, setShippingConfig: (value) => { calls.push("state"); saved = value; } });
  await actions.handleSaveShipping({ baseFeeFirst3Km: 19000, freeShipThreshold: 123456 });
  assert.deepEqual(calls, ["remote", "cache", "state"]);
  assert.equal(saved.freeShipThreshold, 123456);
  delete globalThis.__shippingSaveFixture;
});
