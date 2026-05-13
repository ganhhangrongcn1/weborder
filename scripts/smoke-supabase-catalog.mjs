import { createClient } from "@supabase/supabase-js";

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const stamp = Date.now();
const ids = {
  category: `smoke-cat-${stamp}`,
  product: `smoke-prod-${stamp}`,
  topping: `smoke-top-${stamp}`,
  optionGroup: `smoke-group-${stamp}`,
  option: `smoke-opt-${stamp}`,
  relation: `smoke-link-${stamp}`,
  homeContent: 900000 + Number(String(stamp).slice(-5))
};

const created = {
  promotions: null,
  smartPromotions: null,
  campaigns: null,
  coupons: null,
  homeBanners: null,
  branches: null,
  zones: null
};

async function assertSelect(table) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) throw new Error(`[${table}] select failed: ${error.message}`);
}

async function run() {
  await assertSelect("categories");
  await assertSelect("products");
  await assertSelect("toppings");
  await assertSelect("product_toppings");
  await assertSelect("option_groups");
  await assertSelect("option_group_options");
  await assertSelect("product_option_groups");
  await assertSelect("promotions");
  await assertSelect("smart_promotions");
  await assertSelect("campaigns");
  await assertSelect("coupons");
  await assertSelect("home_banners");
  await assertSelect("branches");
  await assertSelect("delivery_zones");
  await assertSelect("home_content");

  const { error: categoryError } = await supabase
    .from("categories")
    .upsert({ id: ids.category, name: "Smoke Category", active: true }, { onConflict: "id" });
  if (categoryError) throw new Error(`[categories] upsert failed: ${categoryError.message}`);

  const { error: productError } = await supabase
    .from("products")
    .upsert(
      {
        id: ids.product,
        name: "Smoke Product",
        price: 10000,
        category_id: ids.category,
        active: true,
        visible: true
      },
      { onConflict: "id" }
    );
  if (productError) throw new Error(`[products] upsert failed: ${productError.message}`);

  const { error: toppingError } = await supabase
    .from("toppings")
    .upsert({ id: ids.topping, name: "Smoke Topping", price: 2000, active: true }, { onConflict: "id" });
  if (toppingError) throw new Error(`[toppings] upsert failed: ${toppingError.message}`);

  const { error: productToppingError } = await supabase.from("product_toppings").upsert(
    {
      product_id: ids.product,
      topping_id: ids.topping,
      extra_price: 2000,
      is_default: false
    },
    { onConflict: "product_id,topping_id" }
  );
  if (productToppingError) throw new Error(`[product_toppings] upsert failed: ${productToppingError.message}`);

  const { error: optionGroupError } = await supabase
    .from("option_groups")
    .upsert({ id: ids.optionGroup, name: "Smoke Group", required: false, max_select: 1, active: true }, { onConflict: "id" });
  if (optionGroupError) throw new Error(`[option_groups] upsert failed: ${optionGroupError.message}`);

  const { error: optionError } = await supabase.from("option_group_options").upsert(
    {
      id: ids.option,
      group_id: ids.optionGroup,
      name: "Smoke Option",
      price: 1000,
      active: true
    },
    { onConflict: "id" }
  );
  if (optionError) throw new Error(`[option_group_options] upsert failed: ${optionError.message}`);

  const { error: linkError } = await supabase.from("product_option_groups").upsert(
    {
      product_id: ids.product,
      group_id: ids.optionGroup,
      metadata: { smoke: true, stamp }
    },
    { onConflict: "product_id,group_id" }
  );
  if (linkError) throw new Error(`[product_option_groups] upsert failed: ${linkError.message}`);

  const { data: promoData, error: promoError } = await supabase
    .from("promotions")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (promoError) throw new Error(`[promotions] insert failed: ${promoError.message}`);
  created.promotions = promoData?.id ?? null;

  const { data: smartData, error: smartError } = await supabase
    .from("smart_promotions")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (smartError) throw new Error(`[smart_promotions] insert failed: ${smartError.message}`);
  created.smartPromotions = smartData?.id ?? null;

  const { data: campaignData, error: campaignError } = await supabase
    .from("campaigns")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (campaignError) throw new Error(`[campaigns] insert failed: ${campaignError.message}`);
  created.campaigns = campaignData?.id ?? null;

  const { data: couponData, error: couponError } = await supabase
    .from("coupons")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (couponError) throw new Error(`[coupons] insert failed: ${couponError.message}`);
  created.coupons = couponData?.id ?? null;

  const { data: bannerData, error: bannerError } = await supabase
    .from("home_banners")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (bannerError) throw new Error(`[home_banners] insert failed: ${bannerError.message}`);
  created.homeBanners = bannerData?.id ?? null;

  const { data: branchData, error: branchError } = await supabase
    .from("branches")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (branchError) throw new Error(`[branches] insert failed: ${branchError.message}`);
  created.branches = branchData?.id ?? null;

  const { data: zoneData, error: zoneError } = await supabase
    .from("delivery_zones")
    .insert({ data: { smoke: true, stamp } })
    .select("id")
    .single();
  if (zoneError) throw new Error(`[delivery_zones] insert failed: ${zoneError.message}`);
  created.zones = zoneData?.id ?? null;

  const { error: homeContentError } = await supabase
    .from("home_content")
    .upsert({ id: ids.homeContent, value: { smoke: true, stamp } }, { onConflict: "id" });
  if (homeContentError) throw new Error(`[home_content] upsert failed: ${homeContentError.message}`);

  console.log("Supabase catalog smoke test passed.");
}

async function cleanup() {
  await supabase.from("product_option_groups").delete().eq("product_id", ids.product);
  await supabase.from("option_group_options").delete().eq("id", ids.option);
  await supabase.from("option_groups").delete().eq("id", ids.optionGroup);
  await supabase.from("product_toppings").delete().eq("product_id", ids.product);
  await supabase.from("products").delete().eq("id", ids.product);
  await supabase.from("toppings").delete().eq("id", ids.topping);
  await supabase.from("categories").delete().eq("id", ids.category);
  await supabase.from("home_content").delete().eq("id", ids.homeContent);

  if (created.promotions != null) await supabase.from("promotions").delete().eq("id", created.promotions);
  if (created.smartPromotions != null) await supabase.from("smart_promotions").delete().eq("id", created.smartPromotions);
  if (created.campaigns != null) await supabase.from("campaigns").delete().eq("id", created.campaigns);
  if (created.coupons != null) await supabase.from("coupons").delete().eq("id", created.coupons);
  if (created.homeBanners != null) await supabase.from("home_banners").delete().eq("id", created.homeBanners);
  if (created.branches != null) await supabase.from("branches").delete().eq("id", created.branches);
  if (created.zones != null) await supabase.from("delivery_zones").delete().eq("id", created.zones);
}

run()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (_error) {
      // noop
    }
  });
