import assert from "node:assert/strict";
import test from "node:test";
import { runAccessMatrix } from "./supabase-role-matrix.mjs";

function harness() {
  const project = "abcdefghijklmnopqrst";
  const actors = ["anon", "customer_a", "customer_b", "staff", "staff_other_branch", "kitchen", "admin"];
  const env = { GHR_STAGING_PROJECT_REF: project, GHR_STAGING_PUBLISHABLE_KEY: "sb_publishable_fixture", GHR_STAGING_ACCESS_FIXTURES: "synthetic.json" };
  const fixture = { projectRef: project, synthetic: true, cases: [] };
  for (const [index, actor] of actors.entries()) {
    if (actor !== "anon") {
      const claims = { role: "authenticated", iss: `https://${project}.supabase.co/auth/v1`, sub: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, exp: Math.floor(Date.now() / 1000) + 3600 };
      env["GHR_STAGING_TOKEN_" + actor.toUpperCase()] = "fixture." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".fixture";
    }
    fixture.cases.push({ actor, table: actor === "anon" ? "products" : "profiles", id: actor === "admin" ? "protected" : "seed_" + actor, expect: "allow" });
    if (actor !== "admin") fixture.cases.push({ actor, table: "profiles", id: "protected", expect: "deny" });
  }
  let calls = 0;
  return { env, fixture, count: () => calls, options: {
    env, readFixture: async () => JSON.stringify(fixture),
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(init.method, "GET");
      assert.ok(init.signal instanceof globalThis.AbortSignal);
      const id = new URL(url).searchParams.get("id").slice(3);
      const isAdmin = init.headers.Authorization === "Bearer " + env.GHR_STAGING_TOKEN_ADMIN;
      return new globalThis.Response(JSON.stringify(id === "protected" && !isAdmin ? [] : [{ id }]), { status: 200 });
    }
  } };
}

test("SELECT matrix checks real seed visibility before denied rows, using read-only requests", async () => {
  const h = harness();
  assert.equal(await runAccessMatrix(h.options), 13);
  assert.equal(h.count(), 13);
});

test("production and elevated keys are rejected before any request", async () => {
  for (const patch of [
    { GHR_STAGING_PROJECT_REF: "qjaklysckgzdfjthzkzu" },
    { GHR_STAGING_PUBLISHABLE_KEY: "fixture." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".fixture" }
  ]) {
    const h = harness(); Object.assign(h.env, patch);
    await assert.rejects(runAccessMatrix(h.options)); assert.equal(h.count(), 0);
  }
});

test("missing paired seed and shared actor identities are rejected before any request", async () => {
  const h = harness(); h.fixture.cases[1].id = "nonexistent";
  await assert.rejects(runAccessMatrix(h.options)); assert.equal(h.count(), 0);
  const shared = harness(); shared.env.GHR_STAGING_TOKEN_CUSTOMER_B = shared.env.GHR_STAGING_TOKEN_CUSTOMER_A;
  await assert.rejects(runAccessMatrix(shared.options)); assert.equal(shared.count(), 0);
});

test("expired session cannot falsely pass a denial check", async () => {
  const h = harness();
  const parts = h.env.GHR_STAGING_TOKEN_KITCHEN.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url")); claims.exp = 1;
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url"); h.env.GHR_STAGING_TOKEN_KITCHEN = parts.join(".");
  await assert.rejects(runAccessMatrix(h.options)); assert.equal(h.count(), 0);
});

test("401 and server errors never count as successful access denial", async () => {
  for (const status of [401, 500]) {
    const h = harness(); const original = h.options.fetchImpl;
    h.options.fetchImpl = async (url, init) => {
      if (url.includes("id=eq.protected") && init.headers.Authorization !== "Bearer " + h.env.GHR_STAGING_TOKEN_ADMIN) return new globalThis.Response("{}", { status });
      return original(url, init);
    };
    await assert.rejects(runAccessMatrix(h.options), /Deny check failed/);
  }
});

test("missing seed aborts before denial checks can hide a bad fixture", async () => {
  const h = harness(); let calls = 0;
  h.options.fetchImpl = async () => { calls++; return new globalThis.Response("[]", { status: 200 }); };
  await assert.rejects(runAccessMatrix(h.options), /Allow check failed/);
  assert.equal(calls, 1);
});
