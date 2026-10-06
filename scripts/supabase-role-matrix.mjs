import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Read-only staging checks. Never accepts the production project or service-role token.
const PROJECT = process.env.GHR_STAGING_PROJECT_REF || "";
const KEY = process.env.GHR_STAGING_PUBLISHABLE_KEY || "";
const fixturePath = process.env.GHR_STAGING_ACCESS_FIXTURES || "";
const ROLES = new Set(["anon", "customer_a", "customer_b", "staff", "staff_other_branch", "kitchen", "admin"]);
const TABLES = new Set(["profiles", "orders", "partner_orders", "products"]);

async function run() {
  assert.match(PROJECT, /^[a-z]{20}$/);
  assert.notEqual(PROJECT, "qjaklysckgzdfjthzkzu", "Production project is forbidden");
  assert.ok(KEY && fixturePath, "Staging key and synthetic access fixtures are required");
  if (!KEY.startsWith("sb_publishable_")) {
    const keyClaims = JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString("utf8"));
    assert.equal(keyClaims.role, "anon", "Only publishable or anon keys are accepted");
    assert.equal(keyClaims.ref, PROJECT, "Key project mismatch");
  }
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  assert.equal(fixture.projectRef, PROJECT, "Fixture project mismatch");
  assert.equal(fixture.synthetic, true, "Only dedicated synthetic fixtures are allowed");
  const covered = new Set();
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length >= 13, "Access coverage for all actors is required");
  for (const entry of fixture.cases) {
    assert.ok(ROLES.has(entry.actor) && TABLES.has(entry.table));
    assert.ok(["allow", "deny"].includes(entry.expect));
    assert.match(entry.id, /^[a-zA-Z0-9_-]{1,80}$/);
    const token = entry.actor === "anon" ? "" : process.env["GHR_STAGING_TOKEN_" + entry.actor.toUpperCase()];
    assert.ok(entry.actor === "anon" || token, "Missing staging token for " + entry.actor);
    if (token) {
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      assert.equal(claims.role, "authenticated", "Only authenticated client tokens are accepted");
      assert.equal(claims.iss, "https://" + PROJECT + ".supabase.co/auth/v1", "Token issuer mismatch");
    }
    covered.add(entry.actor + ":" + entry.expect);
  }
  for (const actor of ROLES) {
    assert.ok(covered.has(actor + ":allow") && (actor === "admin" || covered.has(actor + ":deny")), "Missing role allow/deny coverage: " + actor);
  }
  for (const entry of fixture.cases.filter((entry) => entry.expect === "deny")) {
    assert.ok(fixture.cases.some((seed) => seed.expect === "allow" && seed.table === entry.table && seed.id === entry.id), "Denied row requires a paired allowed seed check");
  }
  for (let i = 0; i < fixture.cases.length; i++) {
    const entry = fixture.cases[i];
    const token = entry.actor === "anon" ? "" : process.env["GHR_STAGING_TOKEN_" + entry.actor.toUpperCase()];
    const response = await fetch("https://" + PROJECT + ".supabase.co/rest/v1/" + entry.table + "?select=id&id=eq." + encodeURIComponent(entry.id), {
      headers: { apikey: KEY, ...(token ? { Authorization: "Bearer " + token } : {}) }
    });
    const rows = response.ok ? await response.json() : null;
    // Empty rows can mean RLS denied access, or a bad fixture. Allow checks catch missing seed rows.
    const allowed = response.ok && Array.isArray(rows) && rows.some((row) => row.id === entry.id);
    if (entry.expect === "allow") assert.ok(allowed, "Allow check failed at case " + i);
    else assert.ok((response.ok && Array.isArray(rows) && rows.length === 0) || [401, 403].includes(response.status), "Deny check failed at case " + i);
  }
  console.log("Staging SELECT access matrix passed: " + fixture.cases.length + " cases.");
}

run().catch((error) => {
  // Do not print inputs, JWTs, fixture rows or raw API errors.
  console.error("Access matrix stopped: " + (error instanceof assert.AssertionError ? error.message.split("\n")[0] : "check staging configuration"));
  process.exitCode = 1;
});
