import assert from "node:assert/strict";
import test from "node:test";
import observeNexpos, { NEXPOS_SOCKET_URL, NEXPOS_TOPICS, readEventMetadata }
  from "../services/nexpos-vercel/nexposObserver.js";

function createHarness() {
  let clock = 0;
  let id = 0;
  const tasks = new Map();
  const timers = {
    setTimeout(fn, ms) { tasks.set(++id, { fn, at: clock + ms }); return id; },
    clearTimeout(key) { tasks.delete(key); },
    setInterval(fn, ms) { tasks.set(++id, { fn, at: clock + ms, interval: ms }); return id; },
    clearInterval(key) { tasks.delete(key); }
  };
  const sockets = [];
  const socketFactory = (url) => {
    assert.equal(url, NEXPOS_SOCKET_URL);
    const listeners = {};
    const socket = {
      readyState: 1, sent: [], closed: false,
      addEventListener(name, callback) { listeners[name] = callback; },
      send(data) { this.sent.push(JSON.parse(data)); },
      emit(name, event = {}) { listeners[name]?.(event); },
      close() { this.closed = true; this.readyState = 3; this.emit("close"); }
    };
    sockets.push(socket);
    return socket;
  };
  const tick = (ms) => {
    const end = clock + ms;
    for (;;) {
      const next = [...tasks].filter(([, task]) => task.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [key, task] = next;
      clock = task.at;
      if (task.interval) task.at += task.interval;
      else tasks.delete(key);
      task.fn();
    }
    clock = end;
  };
  return { timers, socketFactory, sockets, tick, tasks };
}

test("only verified topics and the selected HUB produce metadata", () => {
  const message = (data) => JSON.stringify({ data, message: "private customer data" });
  assert.deepEqual(readEventMetadata(message({ topic: "saas_notifications", hub_ids: ["hub"] }), "hub"),
    { topic: "saas_notifications" });
  assert.equal(readEventMetadata(message({ topic: "saas_notifications", hub_ids: ["other"] }), "hub"), null);
  assert.equal(readEventMetadata(message({ topic: "unknown", hub_id: "hub" }), "hub"), null);
  assert.equal(readEventMetadata("invalid", "hub"), null);
  assert.equal(readEventMetadata("x".repeat(128 * 1024 + 1), "hub"), null);
});

test("handshake, heartbeat and bounded shutdown use portal protocol", async () => {
  const h = createHarness();
  const result = observeNexpos({ accessToken: "fake-test-token", hubId: "hub", ...h });
  h.sockets[0].emit("open");
  assert.deepEqual(h.sockets[0].sent[0], { access_token: "fake-test-token", topic: NEXPOS_TOPICS });
  h.tick(30000);
  assert.deepEqual(h.sockets[0].sent[1], { type: "ping" });
  h.sockets[0].emit("message", { data: JSON.stringify({ data: { topic: "saas_order_status_change", hub_id: "hub" } }) });
  h.tick(210000);
  const summary = await result;
  assert.equal(summary.events.saas_order_status_change, 1);
  assert.equal(summary.reason, "duration");
  assert.equal(h.sockets[0].closed, true);
  assert.equal(h.tasks.size, 0);
  assert.equal(JSON.stringify(summary).includes("fake-test-token"), false);
});

test("closed socket reconnects with backoff and remains bounded", async () => {
  const h = createHarness();
  const result = observeNexpos({ accessToken: "fake", hubId: "hub", durationMs: 10000, ...h });
  h.sockets[0].close();
  h.tick(2999);
  assert.equal(h.sockets.length, 1);
  h.tick(1);
  assert.equal(h.sockets.length, 2);
  h.sockets[1].close();
  h.tick(6000);
  assert.equal(h.sockets.length, 3);
  h.tick(1000);
  assert.equal((await result).reason, "duration");
  assert.equal(h.tasks.size, 0);
});

test("abort and socket errors clean up without exposing raw events", async () => {
  const h = createHarness();
  const controller = new globalThis.AbortController();
  const result = observeNexpos({ accessToken: "fake", hubId: "hub", signal: controller.signal, ...h });
  controller.abort();
  assert.equal((await result).reason, "aborted");
  assert.equal(h.tasks.size, 0);
  const other = createHarness();
  const errorResult = observeNexpos({ accessToken: "fake", hubId: "hub", ...other });
  other.sockets[0].emit("error", { message: "private" });
  assert.equal((await errorResult).reason, "socket_error");
  assert.equal(other.tasks.size, 0);
});

test("invalid configuration never opens a socket", () => {
  const h = createHarness();
  assert.throws(() => observeNexpos({ ...h, hubId: "hub" }), /missing/);
  assert.throws(() => observeNexpos({ ...h, hubId: "hub", accessToken: "fake", durationMs: 300000 }), /invalid/);
  assert.equal(h.sockets.length, 0);
});
