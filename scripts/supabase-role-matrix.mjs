import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Read-only staging checks. Never accepts the production project or service-role token.
const ROLES = new Set(["anon", "customer_a", "customer_b", "staff", "staff_other_branch", "kitchen", "admin"]);
const TABLES = new Set(["profiles", "orders", "partner_orders", "products"]);

export async function runAccessMatrix({ env = process.env, fetchImpl = fetch, readFixture = readFile } = {}) {
  const PROJECT = env.GHR_STAGING_PROJECT_REF || "";
  const KEY = env.GHR_STAGING_PUBLISHABLE_KEY || "";
  const fixturePath = env.GHR_STAGING_ACCESS_FIXTURES || "";
  assert.match(PROJECT, /^[a-z]{20}$/);
  assert.notEqual(PROJECT, "qjaklysckgzdfjthzkzu", "Production project is forbidden");
  assert.ok(KEY && fixturePath, "Staging key and synthetic access fixtures are required");
  if (!KEY.startsWith("sb_publishable_")) {
    const keyClaims = JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString("utf8"));
    assert.equal(keyClaims.role, "anon", "Only publishable or anon keys are accepted");
    assert.equal(keyClaims.ref, PROJECT, "Key project mismatch");
  }
  const fixture = JSON.parse(await readFixture(fixturePath, "utf8"));
  assert.equal(fixture.projectRef, PROJECT, "Fixture project mismatch");
  assert.equal(fixture.synthetic, true, "Only dedicated synthetic fixtures are allowed");
  const covered = new Set();
  const identities = new Map();
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length >= 13, "Access coverage for all actors is required");
  for (const entry of fixture.cases) {
    assert.ok(ROLES.has(entry.actor) && TABLES.has(entry.table));
    assert.ok(["allow", "deny"].includes(entry.expect));
    assert.match(entry.id, /^[a-zA-Z0-9_-]{1,80}$/);
    const token = entry.actor === "anon" ? "" : env["GHR_STAGING_TOKEN_" + entry.actor.toUpperCase()];
    assert.ok(entry.actor === "anon" || token, "Missing staging token for " + entry.actor);
    if (token) {
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      assert.equal(claims.role, "authenticated", "Only authenticated client tokens are accepted");
      assert.equal(claims.iss, "https://" + PROJECT + ".supabase.co/auth/v1", "Token issuer mismatch");
      assert.ok(typeof claims.sub === "string" && /^[0-9a-f-]{36}$/i.test(claims.sub), "User identity is required");
      assert.ok(Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000 + 60, "Fresh staging session is required");
      identities.set(entry.actor, claims.sub);
    }
    covered.add(entry.actor + ":" + entry.expect);
  }
  for (const actor of ROLES) {
    assert.ok(covered.has(actor + ":allow") && (actor === "admin" || covered.has(actor + ":deny")), "Missing role allow/deny coverage: " + actor);
  }
  assert.equal(new Set(identities.values()).size, identities.size, "Actors require separate user identities");
  for (const entry of fixture.cases.filter((entry) => entry.expect === "deny")) {
    assert.ok(fixture.cases.some((seed) => seed.expect === "allow" && seed.table === entry.table && seed.id === entry.id), "Denied row requires a paired allowed seed check");
  }
  const orderedCases = [...fixture.cases].sort((a, b) => Number(a.expect === "deny") - Number(b.expect === "deny"));
  for (let i = 0; i < orderedCases.length; i++) {
    const entry = orderedCases[i];
    const token = entry.actor === "anon" ? "" : env["GHR_STAGING_TOKEN_" + entry.actor.toUpperCase()];
    const response = await fetchImpl("https://" + PROJECT + ".supabase.co/rest/v1/" + entry.table + "?select=id&id=eq." + encodeURIComponent(entry.id), {
      method: "GET", signal: globalThis.AbortSignal.timeout(10000),
      headers: { apikey: KEY, ...(token ? { Authorization: "Bearer " + token } : {}) }
    });
    const rows = response.ok ? await response.json() : null;
    // Empty rows can mean RLS denied access, or a bad fixture. Allow checks catch missing seed rows.
    const allowed = response.ok && Array.isArray(rows) && rows.some((row) => row.id === entry.id);
    if (entry.expect === "allow") assert.ok(allowed, "Allow check failed at case " + i);
    else assert.ok((response.ok && Array.isArray(rows) && rows.length === 0) || response.status === 403, "Deny check failed at case " + i);
  }
  return fixture.cases.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAccessMatrix().then((count) => {
  console.log("Staging SELECT access matrix passed: " + count + " cases.");
}).catch((error) => {
  // Do not print inputs, JWTs, fixture rows or raw API errors.
  console.error("Access matrix stopped: " + (error instanceof assert.AssertionError ? error.message.split("\n")[0] : "check staging configuration"));
  process.exitCode = 1;
});
