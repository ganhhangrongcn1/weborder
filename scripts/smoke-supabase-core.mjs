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

const probeOrderId = `SMOKE-${Date.now()}`;

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

async function cleanupProbeOrder() {
  const { error: itemError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", probeOrderId);
  if (itemError) throw new Error(`[order_items] cleanup failed: ${itemError.message}`);

  const { error: orderError } = await supabase
    .from("orders")
    .delete()
    .eq("id", probeOrderId);
  if (orderError) throw new Error(`[orders] cleanup failed: ${orderError.message}`);
}

async function assertOrderWriteFlow() {
  const { error: orderError } = await supabase.from("orders").insert({
    id: probeOrderId,
    order_code: probeOrderId,
    customer_phone: null,
    customer_name: "Smoke Test",
    total_amount: 10000
  });
  if (orderError) throw new Error(`[orders] insert failed: ${orderError.message}`);

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: probeOrderId,
    product_id: "smoke-product",
    product_name: "Smoke Product",
    quantity: 1,
    unit_price: 10000,
    line_total: 10000
  });
  if (itemError) throw new Error(`[order_items] insert failed: ${itemError.message}`);
}

async function run() {
  await assertSelect("customer_addresses");
  await assertSelect("orders");
  await assertSelect("order_items");
  await assertAnonymousTableDenied("profiles");
  await assertLoyaltyAnonymousDenied("loyalty_accounts");
  await assertLoyaltyAnonymousDenied("loyalty_ledger");
  await assertLoginHintRpcAvailable();

  try {
    await assertOrderWriteFlow();
  } finally {
    await cleanupProbeOrder();
  }

  console.log("Supabase core order/security smoke test passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
