import test from "node:test";
import assert from "node:assert/strict";
import createBoundary from "../src/services/supabase/sessionCacheBoundary.js";

function clientFixture(id = "a") {
  let session = id ? { user: { id } } : null;
  let listener; let unsubscribed = 0; let reads = 0;
  return {
    client: { auth: {
      getSession: async () => { reads++; return { data: { session } }; },
      onAuthStateChange: (callback) => { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed++; } } } }; }
    } },
    emit(event, id) { session = id ? { user: { id } } : null; listener(event, session); },
    unsubscribed: () => unsubscribed, reads: () => reads
  };
}

test("logout, account switch and user updates invalidate earlier reads; same-user token refresh does not", async () => {
  const fixture = clientFixture(); let clears = 0;
  const boundary = createBoundary(() => clears++);
  const initial = await boundary.enter(fixture.client);
  fixture.emit("TOKEN_REFRESHED", "a"); assert.equal(initial.isCurrent(), true);
  fixture.emit("SIGNED_OUT", null); assert.equal(initial.isCurrent(), false);
  fixture.emit("SIGNED_IN", "b");
  const next = await boundary.enter(fixture.client); assert.equal(next.isCurrent(), true);
  fixture.emit("USER_UPDATED", "b"); assert.equal(next.isCurrent(), false);
  assert.ok(clears >= 4);
});

test("replacing clients and disposal unsubscribe and invalidate old responses", async () => {
  const first = clientFixture(); const second = clientFixture("b");
  const boundary = createBoundary(() => {});
  const old = await boundary.enter(first.client);
  const current = await boundary.enter(second.client);
  assert.equal(first.unsubscribed(), 1); assert.equal(old.isCurrent(), false);
  boundary.dispose(); assert.equal(second.unsubscribed(), 1); assert.equal(current.isCurrent(), false);
});

test("concurrent session inspection shares local work", async () => {
  const fixture = clientFixture(); const boundary = createBoundary(() => {});
  const contexts = await Promise.all([boundary.enter(fixture.client), boundary.enter(fixture.client)]);
  assert.equal(fixture.reads(), 1); assert.ok(contexts.every((context) => context.isCurrent()));
});

test("auth changes while inspecting a session cannot authorize an old cache read", async () => {
  const fixture = clientFixture(); let complete;
  fixture.client.auth.getSession = () => new Promise((resolve) => { complete = resolve; });
  const boundary = createBoundary(() => {});
  const pending = boundary.enter(fixture.client);
  await Promise.resolve(); fixture.emit("SIGNED_OUT", null);
  complete({ data: { session: { user: { id: "a" } } } });
  assert.equal(await pending, null);
});

test("local session errors fail closed without reading cached data", async () => {
  const fixture = clientFixture(); fixture.client.auth.getSession = async () => { throw new Error("fixture"); };
  assert.equal(await createBoundary(() => {}).enter(fixture.client), null);
});
