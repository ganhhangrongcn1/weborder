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

const probePhone = `9${Date.now().toString().slice(-9)}`;
const probeOrderId = `SMOKE-${Date.now()}`;

async function assertSelect(table) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) throw new Error(`[${table}] select failed: ${error.message}`);
}

async function run() {
  await assertSelect("profiles");
  await assertSelect("customer_addresses");
  await assertSelect("orders");
  await assertSelect("order_items");
  await assertSelect("loyalty_accounts");
  await assertSelect("loyalty_ledger");

  const profileRow = {
    phone: probePhone,
    name: "Smoke Test",
    registered: true,
    role: "customer",
    status: "active"
  };
  const { error: profileError } = await supabase.from("profiles").upsert(profileRow, { onConflict: "phone" });
  if (profileError) throw new Error(`[profiles] upsert failed: ${profileError.message}`);

  const addressRow = {
    customer_phone: probePhone,
    label: "Smoke Address",
    receiver_name: "Smoke Test",
    phone: probePhone,
    address: "Smoke Address",
    is_default: true
  };
  const { error: addressError } = await supabase.from("customer_addresses").insert(addressRow);
  if (addressError) throw new Error(`[customer_addresses] insert failed: ${addressError.message}`);

  const orderRow = {
    id: probeOrderId,
    order_code: probeOrderId,
    customer_phone: probePhone,
    customer_name: "Smoke Test",
    total_amount: 10000
  };
  const { error: orderError } = await supabase.from("orders").upsert(orderRow, { onConflict: "id" });
  if (orderError) throw new Error(`[orders] upsert failed: ${orderError.message}`);

  const itemRow = {
    order_id: probeOrderId,
    product_id: "smoke-product",
    product_name: "Smoke Product",
    quantity: 1,
    unit_price: 10000,
    line_total: 10000
  };
  const { error: itemError } = await supabase.from("order_items").insert(itemRow);
  if (itemError) throw new Error(`[order_items] insert failed: ${itemError.message}`);

  const loyaltyRow = {
    customer_phone: probePhone,
    total_points: 10
  };
  const { error: loyaltyError } = await supabase.from("loyalty_accounts").upsert(loyaltyRow, { onConflict: "customer_phone" });
  if (loyaltyError) throw new Error(`[loyalty_accounts] upsert failed: ${loyaltyError.message}`);

  const ledgerRow = {
    id: `SMOKE-POINT-${Date.now()}`,
    customer_phone: probePhone,
    entry_type: "ORDER_EARN",
    order_id: probeOrderId,
    points: 10,
    amount: 10000,
    title: "Smoke"
  };
  const { error: ledgerError } = await supabase.from("loyalty_ledger").insert(ledgerRow);
  if (ledgerError) throw new Error(`[loyalty_ledger] insert failed: ${ledgerError.message}`);

  await supabase.from("order_items").delete().eq("order_id", probeOrderId);
  await supabase.from("loyalty_ledger").delete().eq("order_id", probeOrderId);
  await supabase.from("orders").delete().eq("id", probeOrderId);
  await supabase.from("loyalty_accounts").delete().eq("customer_phone", probePhone);
  await supabase.from("customer_addresses").delete().eq("customer_phone", probePhone);

  console.log("Supabase core smoke test passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
