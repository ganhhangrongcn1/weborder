import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function checkReadableTable(table) {
  const startedAt = Date.now();
  const { error } = await client
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);
  return {
    name: table,
    ok: !error,
    durationMs: Date.now() - startedAt,
    error: error ? `${error.code || ""} ${error.message || error}`.trim() : ""
  };
}

async function checkProfilesProtected() {
  const startedAt = Date.now();
  const { error } = await client
    .from("profiles")
    .select("*", { head: true, count: "exact" })
    .limit(1);
  return {
    name: "profiles protected",
    ok: Boolean(error),
    durationMs: Date.now() - startedAt,
    error: error ? "" : "anonymous profiles select unexpectedly allowed"
  };
}

async function checkLoginHintRpc() {
  const startedAt = Date.now();
  const { error } = await client.rpc("get_customer_profile_login_hint", {
    p_phone: "9000000000"
  });
  return {
    name: "profile login hint RPC",
    ok: !error,
    durationMs: Date.now() - startedAt,
    error: error ? `${error.code || ""} ${error.message || error}`.trim() : ""
  };
}

const results = await Promise.all([
  checkProfilesProtected(),
  checkLoginHintRpc(),
  checkReadableTable("orders"),
  checkReadableTable("products"),
  checkReadableTable("app_configs")
]);
const failed = results.filter((item) => !item.ok);

results.forEach((item) => {
  if (item.ok) {
    console.log(`[OK] ${item.name} (${item.durationMs}ms)`);
  } else {
    console.error(`[FAIL] ${item.name} (${item.durationMs}ms): ${item.error}`);
  }
});

if (failed.length) {
  process.exit(1);
}

console.log("Supabase health/security smoke test passed.");
