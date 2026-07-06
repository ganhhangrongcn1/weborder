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

const readableCatalogTables = [
  "categories",
  "products",
  "toppings",
  "product_toppings",
  "option_groups",
  "option_group_options",
  "product_option_groups",
  "promotions",
  "smart_promotions",
  "campaigns",
  "coupons",
  "home_banners",
  "branches",
  "delivery_zones",
  "home_content"
];

async function assertSelect(table) {
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" });
  if (error) throw new Error(`[${table}] select failed: ${error.message}`);
}

async function assertAnonymousCouponWriteDenied() {
  const { error } = await supabase
    .from("coupons")
    .insert({ data: { smoke: true, stamp: Date.now() } });
  if (!error) {
    throw new Error("[coupons] anonymous insert unexpectedly allowed");
  }
}

async function run() {
  await Promise.all(readableCatalogTables.map(assertSelect));
  await assertAnonymousCouponWriteDenied();
  console.log("Supabase catalog read/security smoke test passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
