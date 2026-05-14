import { createClient } from "@supabase/supabase-js";

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function checkTable(table) {
  const startedAt = Date.now();
  const { error } = await client.from(table).select("*", { head: true, count: "exact" }).limit(1);
  const durationMs = Date.now() - startedAt;
  return {
    table,
    ok: !error,
    durationMs,
    error: error ? `${error.code || ""} ${error.message || error}`.trim() : ""
  };
}

const tables = ["customers", "orders", "products", "app_configs"];
const results = await Promise.all(tables.map(checkTable));
const failed = results.filter((item) => !item.ok);

results.forEach((item) => {
  if (item.ok) {
    console.log(`[OK] ${item.table} (${item.durationMs}ms)`);
  } else {
    console.error(`[FAIL] ${item.table} (${item.durationMs}ms): ${item.error}`);
  }
});

if (failed.length) {
  process.exit(1);
}

console.log("Supabase health smoke test passed.");
