import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the actual hook cache functions with controlled network responses.
const source = readFileSync(new URL("../src/pages/admin/state/useAdminOrderCrmState.js", import.meta.url), "utf8");
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  let now = 0;
  const requests = [];
  const context = {
    Map, Number, String, Array,
    Date: { now: () => now },
    loadOrdersSnapshotUncached: (...args) => {
      const pending = deferred();
      requests.push({ ...pending, args });
      return pending.promise;
    },
    getWebOrdersOnly: (rows) => rows.filter((row) => row.sourceType !== "partner")
  };
  const api = vm.runInNewContext([
    section("const SNAPSHOT_CACHE_TTL_MS", "const DASHBOARD_DATA_KEYS"),
    section("async function loadOrdersSnapshot(", "async function loadOrdersSnapshotUncached("),
    section("function buildOrdersSnapshotCacheKey(", "function getSelectedBranchOption("),
    "({ loadOrdersSnapshot, clearOrdersSnapshotCache })"
  ].join("\n"), context);
  return { ...api, requests, advance: (ms) => { now += ms; } };
}

test("late success after clear cannot cache old rows or remove a newer request", async () => {
  const h = harness();
  const old = h.loadOrdersSnapshot(null);
  h.clearOrdersSnapshotCache();
  const current = h.loadOrdersSnapshot(null);
  h.requests[0].resolve([{ id: "old" }]);
  await old;
  const follower = h.loadOrdersSnapshot(null);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([{ id: "new" }]);
  assert.equal((await current)[0].id, "new");
  assert.equal((await follower)[0].id, "new");
  assert.equal((await h.loadOrdersSnapshot(null))[0].id, "new");
});

test("late error after clear keeps the replacement request shared", async () => {
  const h = harness();
  const old = h.loadOrdersSnapshot(null);
  const failure = assert.rejects(old, /network/);
  h.clearOrdersSnapshotCache();
  const current = h.loadOrdersSnapshot(null);
  h.requests[0].reject(new Error("network"));
  await failure;
  const follower = h.loadOrdersSnapshot(null);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([]);
  await Promise.all([current, follower]);
});

test("old combined result cannot seed a web-only alias after invalidation", async () => {
  const h = harness();
  const old = h.loadOrdersSnapshot(null, {}, { includePartnerOrders: true });
  h.clearOrdersSnapshotCache();
  h.requests[0].resolve([{ id: "old-web" }]);
  await old;
  const web = h.loadOrdersSnapshot(null);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([{ id: "fresh-web" }]);
  assert.equal((await web)[0].id, "fresh-web");
});

test("current combined result preserves web alias and 60-second TTL", async () => {
  const h = harness();
  const combined = h.loadOrdersSnapshot(null, {}, { includePartnerOrders: true });
  h.requests[0].resolve([{ id: "web" }, { id: "partner", sourceType: "partner" }]);
  await combined;
  assert.equal((await h.loadOrdersSnapshot(null)).length, 1);
  assert.equal(h.requests.length, 1);
  h.advance(60000);
  const expired = h.loadOrdersSnapshot(null);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([]);
  await expired;
});

test("date and item-detail scopes still have separate requests", async () => {
  const h = harness();
  const a = h.loadOrdersSnapshot(null, { dateFrom: "day-a" });
  const b = h.loadOrdersSnapshot(null, { dateFrom: "day-b" });
  const c = h.loadOrdersSnapshot(null, { dateFrom: "day-a" }, { includeOrderItems: false });
  assert.equal(h.requests.length, 3);
  h.requests.forEach((request) => request.resolve([]));
  await Promise.all([a, b, c]);
});
