import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import startStoreCommandLane from "./partner-store-command-lane.mjs";

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test("a slow account does not block another command; polls are bounded and shutdown drains", async () => {
  const slow = deferred();
  const secondStarted = deferred();
  let claims = 0;
  const limits = [];
  const lane = startStoreCommandLane({
    intervalMs: 5, capacity: 2,
    claim: async (limit) => {
      limits.push(limit);
      claims += 1;
      return claims === 1 ? ["slow"] : claims === 2 ? ["fast"] : [];
    },
    run: async (source) => {
      if (source === "slow") await slow.promise;
      else secondStarted.resolve();
    },
    onError: async (error) => { throw error; }
  });
  try {
    await Promise.race([secondStarted.promise, delay(1000).then(() => { throw new Error("Second account blocked"); })]);
    assert.deepEqual(limits.slice(0, 2), [2, 1]);
    let stopped = false;
    const stop = lane.stop().then(() => { stopped = true; });
    await delay(10);
    assert.equal(stopped, false);
    slow.resolve();
    await stop;
    const count = claims;
    await delay(15);
    assert.equal(claims, count);
  } finally {
    slow.resolve();
    await lane.stop();
  }
});

test("claim errors recover; failed commands free capacity without overlapping claims", async () => {
  let claims = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const errors = [];
  const recovered = deferred();
  const lane = startStoreCommandLane({
    intervalMs: 2, capacity: 1,
    claim: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(5);
      inFlight -= 1;
      claims += 1;
      if (claims === 1) throw new Error("offline");
      return claims === 2 ? ["bad"] : claims === 3 ? ["good"] : [];
    },
    run: async (source) => {
      if (source === "bad") throw new Error("denied");
      recovered.resolve();
    },
    onError: async (error) => { errors.push(error.message); }
  });
  try {
    await Promise.race([recovered.promise, delay(1000).then(() => { throw new Error("No recovery"); })]);
    assert.deepEqual(errors, ["offline", "denied"]);
    assert.equal(maxInFlight, 1);
  } finally {
    await lane.stop();
  }
});
