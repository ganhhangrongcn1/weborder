import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function assertSelect(table) {
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" });
  if (error) throw new Error(`[${table}] select failed: ${error.message}`);
}

async function assertAnonymousTableDenied(table) {
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" });
  if (!error) {
    throw new Error(`[${table}] anonymous select unexpectedly allowed`);
  }
}

async function assertLoyaltyAnonymousDenied(table) {
  await assertAnonymousTableDenied(table);

  const deniedInsertRow = table === "loyalty_ledger"
    ? {
        id: `SMOKE-DENIED-${Date.now()}`,
        customer_phone: "9000000000",
        entry_type: "OTHER",
        points: 1,
        amount: 0,
        title: "Smoke denied"
      }
    : { customer_phone: "9000000000", total_points: 1 };
  const { error } = await supabase.from(table).insert(deniedInsertRow);
  if (!error) {
    throw new Error(`[${table}] anonymous insert unexpectedly allowed`);
  }
}

async function assertLoginHintRpcAvailable() {
  const { error } = await supabase.rpc("get_customer_profile_login_hint", {
    p_phone: "9000000000"
  });
  if (error) {
    throw new Error(`[get_customer_profile_login_hint] failed: ${error.message}`);
  }
}

async function run() {
  await assertSelect("customer_addresses");
  await assertSelect("orders");
  await assertSelect("order_items");
  await assertAnonymousTableDenied("profiles");
  await assertLoyaltyAnonymousDenied("loyalty_accounts");
  await assertLoyaltyAnonymousDenied("loyalty_ledger");
  await assertLoginHintRpcAvailable();

  console.log("Supabase core access/security smoke test passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
