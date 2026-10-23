import test from "node:test";
import assert from "node:assert/strict";
import { detectMiniAppRuntime, initializeMiniApp, mutateNativeState, getSessionId, setSessionId } from "../src/services/miniAppRuntime.js";

test("nhận diện Mini App và chế độ Device, không nhận web local thường là Zalo", () => {
  assert.equal(detectMiniAppRuntime({ hostname: "h5.zdn.vn" }), true);
  assert.equal(detectMiniAppRuntime({ hostname: "192.168.1.2", userAgent: "Zalo Android", appId: "2442731166050783503" }), true);
  assert.equal(detectMiniAppRuntime({ hostname: "localhost", userAgent: "Chrome" }), false);
  assert.equal(detectMiniAppRuntime({ hostname: "localhost", userAgent: "Chrome", appId: "2442731166050783503" }), true);
  assert.equal(detectMiniAppRuntime({ hostname: "fake-h5.zdn.vn", userAgent: "Chrome" }), false);
});

test("lưu Zalo bằng nativeStorage, tuần tự hóa thao tác và không dùng sessionStorage", async () => {
  const previous = globalThis.window;
  globalThis.window = { location: { hostname: "h5.zdn.vn" }, sessionStorage: { getItem() { throw Error("Web storage must not run"); }, setItem() { throw Error("Web storage must not run"); } } };
  const map = new Map();
  try {
    await initializeMiniApp(async () => ({ nativeStorage: { getItem: (key) => map.get(key), setItem: (key, value) => map.set(key, value) } }));
    const seed = () => ({ version: 1, records: [], requests: [], phones: {} });
    await Promise.all([1, 2, 3].map((id) => mutateNativeState((s) => ({ ...s, records: [...s.records, id] }), seed)));
    const state = await mutateNativeState((s) => s, seed);
    assert.deepEqual(state.records, [1, 2, 3]);
    setSessionId("demo-employee"); assert.equal(getSessionId(), "demo-employee");
    setSessionId(null); assert.equal(getSessionId(), null);
    await assert.rejects(() => mutateNativeState((s) => ({ ...s, huge: "x".repeat(1100000) }), seed), /đã đầy/);
    assert.deepEqual((await mutateNativeState((s) => s, seed)).records, [1, 2, 3]);
  } finally { globalThis.window = previous; }
});
