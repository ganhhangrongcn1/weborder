import assert from "node:assert/strict";
import test from "node:test";
import createKitchenRefreshQueue from "../src/services/kitchenRefreshQueue.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("busy refresh retains both sources and runs one full follow-up", async () => {
  const queue = createKitchenRefreshQueue();
  const scope = {};
  const gate = deferred();
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const execute = async (request) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    calls.push(request);
    if (calls.length === 1) await gate.promise;
    active -= 1;
  };
  const first = queue.request({ scope, silent: true, sourceType: "partner" }, execute);
  const second = queue.request({ scope, silent: true, sourceType: "partner" }, execute);
  const third = queue.request({ scope, silent: false, sourceType: "website" }, execute);
  assert.equal(calls.length, 1);
  gate.resolve();
  await Promise.all([first, second, third]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].sourceType, "");
  assert.equal(calls[1].silent, false);
  assert.equal(maxActive, 1);
});

test("same-source bursts preserve a scoped follow-up", async () => {
  const queue = createKitchenRefreshQueue();
  const scope = {};
  const gate = deferred();
  const sources = [];
  const execute = async (request) => {
    sources.push(request.sourceType);
    if (sources.length === 1) await gate.promise;
  };
  const pending = [queue.request({ scope, sourceType: "partner" }, execute)];
  for (let index = 0; index < 20; index += 1) {
    pending.push(queue.request({ scope, sourceType: "partner" }, execute));
  }
  gate.resolve();
  await Promise.all(pending);
  assert.deepEqual(sources, ["partner", "partner"]);
});

test("changing scope discards old queued reads and old results", async () => {
  const queue = createKitchenRefreshQueue();
  const oldScope = {};
  const newScope = {};
  const gate = deferred();
  const applied = [];
  const first = queue.request({ scope: oldScope }, async (_request, isCurrent) => {
    await gate.promise;
    if (isCurrent()) applied.push("old");
  });
  const discarded = queue.request({ scope: oldScope }, async () => applied.push("discarded"));
  const latest = queue.request({ scope: newScope }, async (_request, isCurrent) => {
    if (isCurrent()) applied.push("new");
  });
  gate.resolve();
  await Promise.all([first, discarded, latest]);
  assert.deepEqual(applied, ["new"]);
});

test("unmount invalidation prevents applying an in-flight result", async () => {
  const queue = createKitchenRefreshQueue();
  const gate = deferred();
  let applied = false;
  const first = queue.request({ scope: {} }, async (_request, isCurrent) => {
    await gate.promise;
    applied = isCurrent();
  });
  queue.invalidate();
  gate.resolve();
  await first;
  assert.equal(applied, false);
});

test("failed read releases the queue and still runs the pending refresh", async () => {
  const queue = createKitchenRefreshQueue();
  const scope = {};
  const gate = deferred();
  let completed = false;
  const first = queue.request({ scope }, async () => {
    await gate.promise;
    throw new Error("network");
  });
  const failure = assert.rejects(first, /network/);
  const next = queue.request({ scope }, async () => { completed = true; });
  gate.resolve();
  await Promise.all([failure, next]);
  assert.equal(completed, true);
});
