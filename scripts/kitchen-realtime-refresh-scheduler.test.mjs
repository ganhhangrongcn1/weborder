import assert from "node:assert/strict";
import test from "node:test";
import createScheduler from "../src/services/kitchenRealtimeRefreshScheduler.js";

function clock() {
  let time = 0, id = 0;
  const tasks = new Map();
  return {
    now: () => time,
    setTimeout(fn, delay) { tasks.set(++id, { fn, at: time + delay }); return id; },
    clearTimeout(key) { tasks.delete(key); },
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      time = end;
    }
  };
}

test("continuous item events cannot postpone an order refresh", () => {
  const timers = clock(), calls = [];
  const scheduler = createScheduler(value => calls.push({ ...value, at: timers.now() }), timers);
  scheduler.schedule({ sourceType: "partner" });
  for (let i = 0; i < 4; i++) {
    timers.advance(50);
    scheduler.schedule({ sourceType: "partner", item: true });
  }
  timers.advance(50);
  assert.deepEqual(calls, [{ sourceType: "partner", receivedAt: 200, at: 250 }]);
});

test("order signal accelerates an item batch and merges both sources", () => {
  const timers = clock(), calls = [];
  const scheduler = createScheduler(value => calls.push({ ...value, at: timers.now() }), timers);
  scheduler.schedule({ sourceType: "partner", item: true });
  timers.advance(100);
  scheduler.schedule({ sourceType: "website" });
  timers.advance(250);
  assert.deepEqual(calls, [{ sourceType: "", receivedAt: 100, at: 350 }]);
  timers.advance(1000);
  assert.equal(calls.length, 1);
});

test("cleanup discards obsolete branch batch and future batches still work", () => {
  const timers = clock(), calls = [];
  const scheduler = createScheduler(value => calls.push(value), timers);
  scheduler.schedule({ sourceType: "partner" });
  scheduler.cancel();
  timers.advance(1000);
  assert.equal(calls.length, 0);
  scheduler.schedule({ sourceType: "website", item: true });
  timers.advance(749);
  assert.equal(calls.length, 0);
  timers.advance(1);
  assert.equal(calls[0].sourceType, "website");
});
