import { getRepositoryRuntimeInfo, getRuntimeSupabaseClient } from "./repositoryRuntime.js";

const CATALOG_TABLE_BY_KEY = {
  ghr_products: "products",
  ghr_categories: "categories",
  ghr_toppings: "toppings",
  ghr_promos: "promotions",
  ghr_smart_promotions: "smart_promotions",
  ghr_banners: "home_banners",
  ghr_campaigns: "campaigns",
  ghr_branches: "branches",
  ghr_zones: "delivery_zones",
  ghr_coupons: "coupons",
  ghr_home_content: "home_content"
};

const MINUTE = 60 * 1000;
const CATALOG_TTL_MS = 5 * MINUTE;
const CATALOG_KEY_TTL_MS = {
  ghr_products: 5 * MINUTE,
  ghr_categories: 5 * MINUTE,
  ghr_toppings: 5 * MINUTE,
  ghr_home_content: 5 * MINUTE,
  ghr_banners: 5 * MINUTE,
  ghr_promos: 2 * MINUTE,
  ghr_smart_promotions: 2 * MINUTE,
  ghr_coupons: 2 * MINUTE,
  ghr_campaigns: 2 * MINUTE,
  ghr_shipping_config: 2 * MINUTE,
  ghr_branches: 2 * MINUTE,
  ghr_hours: 2 * MINUTE,
  ghr_zones: 2 * MINUTE,
  ghr_loyalty: 5 * MINUTE,
  ghr_zalo_config: 5 * MINUTE
};
const catalogReadCache = new Map();
const catalogInFlight = new Map();
const isDev = Boolean(import.meta?.env?.DEV);

function getCatalogTtlMs(key) {
  return CATALOG_KEY_TTL_MS[String(key || "").trim()] ?? CATALOG_TTL_MS;
}

function getFreshCatalogCache(key) {
  const item = catalogReadCache.get(key);
  if (!item) return null;
  if (Date.now() - item.cachedAt > getCatalogTtlMs(key)) {
    if (isDev) console.info(`[catalogSupabaseRepository] cache stale: ${key}`);
    return null;
  }
  if (isDev) console.info(`[catalogSupabaseRepository] cache hit: ${key}`);
  return item.value;
}

function setCatalogCache(key, value) {
  catalogReadCache.set(key, {
    value,
    cachedAt: Date.now()
  });
}

function isSupabaseRuntimeReady() {
  const info = getRepositoryRuntimeInfo();
  return info.source === "supabase" && info.hasSupabaseClient;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").normalize("NFC").trim();
  return text || fallback;
}

function normalizeIdList(values = []) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => normalizeText(value, ""))
        .filter(Boolean)
    )
  );
}

function normalizeCategoryId(value) {
  const normalized = normalizeText(value, "");
  if (!normalized) return "";
  return normalized === "Tất cả" ? "" : normalized;
}

function buildFallbackToppingId(optionName = "", groupId = "") {
  const seed = `${groupId}-${optionName}`.toLowerCase();
  const slug = seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `topping-${Date.now()}`;
}

async function readJsonRows(tableName, fallback) {
  const client = getRuntimeSupabaseClient();
  if (!client) return fallback;

  const { data, error } = await client
    .from(tableName)
    .select("data")
    .order("updated_at", { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) return fallback;

  const rows = data
    .map((row) => row?.data)
    .filter((value) => value !== undefined && value !== null);

  return rows.length ? rows : fallback;
}

async function readSingleJsonConfig(tableName, fallback) {
  const client = getRuntimeSupabaseClient();
  if (!client) return fallback;

  const { data, error } = await client
    .from(tableName)
    .select("value")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? fallback;
}

async function trySelect(client, tableName, columns, orderBy = "updated_at") {
  const { data, error } = await client
    .from(tableName)
    .select(columns)
    .order(orderBy, { ascending: true });
  if (error) throw error;
  return data;
}

async function readCatalogFromStandardTableInternal(key, fallback) {
  if (!isSupabaseRuntimeReady()) return fallback;
  const tableName = CATALOG_TABLE_BY_KEY[key];
  if (!tableName) return fallback;

  // List-like entities use row-per-item (column `data`), while full-page configs can use single-row JSON (`value`).
  if (key === "ghr_home_content") {
    return readSingleJsonConfig(tableName, fallback);
  }
  if (key === "ghr_products") {
    const client = getRuntimeSupabaseClient();
    if (!client) return fallback;
    const { data, error } = await client
      .from(tableName)
      .select("id,name,description,image,price,original_price,badge,category_id,visible,active,sort_order,metadata")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: true });
    if (error) throw error;
    if (!Array.isArray(data) || !data.length) return fallback;
    return data.map((row) => ({
      id: row?.id,
      name: row?.name || "",
      description: row?.description || "",
      image: row?.image || "",
      price: normalizeNumber(row?.price, 0),
      originalPrice: row?.original_price == null ? "" : normalizeNumber(row?.original_price, 0),
      badge: row?.badge || "",
      category: row?.category_id || "",
      visible: normalizeBoolean(row?.visible, true),
      active: normalizeBoolean(row?.active, true),
      sortOrder: normalizeNumber(row?.sort_order, 0),
      ...(row?.metadata && typeof row.metadata === "object" ? row.metadata : {})
    }));
  }
  if (key === "ghr_categories") {
    const client = getRuntimeSupabaseClient();
    if (!client) return fallback;
    try {
      const data = await trySelect(client, tableName, "id,name,sort_order,active", "sort_order");
      if (!Array.isArray(data) || !data.length) return fallback;
      const list = data
        .filter((row) => normalizeText(row?.id || row?.name, "") && normalizeText(row?.id || row?.name, "") !== "Tất cả")
        .map((row) => normalizeText(row?.name || row?.id, ""))
        .filter(Boolean);
      return list.length ? list : fallback;
    } catch (_error) {
      return fallback;
    }
  }
  if (key === "ghr_toppings") {
    const client = getRuntimeSupabaseClient();
    if (!client) return fallback;
    const candidates = [
      "id,name,price,active,sort_order,metadata",
      "id,name,price,active,sort_order",
      "id,name,price"
    ];
    for (const columns of candidates) {
      try {
        const data = await trySelect(client, tableName, columns, "sort_order");
        if (!Array.isArray(data) || !data.length) return fallback;
        return data
          .filter((row) => {
            const metadata = row?.metadata;
            const kind = metadata && typeof metadata === "object" ? String(metadata.kind || "") : "";
            // Only expose standalone topping products in customer/menu topping list.
            return !kind || kind === "standalone_topping";
          })
          .map((row, index) => ({
          id: row?.id || `topping-${index + 1}`,
          name: row?.name || "",
          price: normalizeNumber(row?.price, 0),
          active: normalizeBoolean(row?.active, true),
          sortOrder: normalizeNumber(row?.sort_order, index),
          ...(row?.metadata && typeof row.metadata === "object" ? row.metadata : {})
          }));
      } catch (_error) {
        // Try next schema candidate
      }
    }
    return fallback;
  }
  if (key === "ghr_coupons") {
    return readStructuredCoupons(fallback);
  }
  return readJsonRows(tableName, fallback);
}

export async function readCatalogFromStandardTable(key, fallback, options = {}) {
  if (!options.force) {
    const cachedValue = getFreshCatalogCache(key);
    if (cachedValue !== null) return cachedValue ?? fallback;
    if (catalogInFlight.has(key)) return catalogInFlight.get(key);
  }

  const request = readCatalogFromStandardTableInternal(key, fallback)
    .then((value) => {
      setCatalogCache(key, value);
      return value;
    })
    .catch((error) => {
      if (isDev) {
        console.warn(`[catalogSupabaseRepository] fetch failed, fallback local: ${key}`, {
          message: error?.message || String(error || "")
        });
      }
      return fallback;
    })
    .finally(() => {
      catalogInFlight.delete(key);
    });

  if (isDev) console.info(`[catalogSupabaseRepository] background refresh scheduled: ${key}`);
  catalogInFlight.set(key, request);
  return request;
}

async function writeJsonRows(tableName, value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const rows = Array.isArray(value) ? value : [];

  // Keep implementation simple and deterministic for pilot phase.
  const { error: deleteError } = await client.from(tableName).delete().not("id", "is", null);
  if (deleteError) throw deleteError;

  if (!rows.length) return rows;
  const payload = rows.map((item) => ({ data: item }));
  const { error: insertError } = await client.from(tableName).insert(payload);
  if (insertError) throw insertError;
  return rows;
}

async function writeSingleJsonConfig(tableName, value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const { error } = await client
    .from(tableName)
    .upsert({ id: 1, value }, { onConflict: "id" });
  if (error) throw error;
  return value;
}

async function upsertCategoriesForProducts(products) {
  const client = getRuntimeSupabaseClient();
  if (!client) return;
  const categoryMap = new Map();
  for (const item of products) {
    const rawCategory = item?.category_id || item?.category;
    const categoryId = normalizeCategoryId(rawCategory);
    if (!categoryId) continue;
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: categoryId,
        name: categoryId,
        active: true
      });
    }
  }
  const categories = Array.from(categoryMap.values());
  if (!categories.length) return;
  const { error } = await client.from("categories").upsert(categories, { onConflict: "id" });
  if (error) throw error;
}

async function writeStructuredProducts(value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const rows = Array.isArray(value) ? value : [];
  const existingProductIds = new Set(
    (rows || []).map((item) => normalizeText(item?.id, "")).filter(Boolean)
  );
  await upsertCategoriesForProducts(rows);

  const payload = rows.map((item, index) => {
    const productId = normalizeText(item?.id, "");
    const categoryId = normalizeCategoryId(item?.category_id || item?.category);
    const row = {
      id: productId || crypto.randomUUID(),
      name: normalizeText(item?.name, ""),
      description: String(item?.description ?? ""),
      image: String(item?.image ?? ""),
      price: normalizeNumber(item?.price, 0),
      badge: String(item?.badge ?? ""),
      category_id: categoryId || null,
      visible: normalizeBoolean(item?.visible, true),
      active: normalizeBoolean(item?.active, true),
      sort_order: normalizeNumber(item?.sortOrder, index),
      metadata: item
    };
    const originalPriceRaw = item?.originalPrice;
    if (originalPriceRaw !== "" && originalPriceRaw !== null && originalPriceRaw !== undefined) {
      row.original_price = normalizeNumber(originalPriceRaw, 0);
    } else {
      row.original_price = null;
    }
    return row;
  });

  if (payload.length) {
    const { error } = await client.from("products").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  }

  const { data: dbProducts, error: dbProductsError } = await client.from("products").select("id");
  if (dbProductsError) throw dbProductsError;
  const staleProductIds = (dbProducts || [])
    .map((item) => normalizeText(item?.id, ""))
    .filter((id) => id && !existingProductIds.has(id));
  if (staleProductIds.length) {
    const { error: deleteStaleProductsError } = await client.from("products").delete().in("id", staleProductIds);
    if (deleteStaleProductsError) throw deleteStaleProductsError;
  }

  await syncProductToppingsFromProducts(rows);
  return rows;
}

async function syncProductToppingsFromProducts(products) {
  const client = getRuntimeSupabaseClient();
  if (!client) return;
  const rows = Array.isArray(products) ? products : [];
  const productIds = rows.map((item) => normalizeText(item?.id, "")).filter(Boolean);
  if (!productIds.length) return;

  const toppingMap = new Map();
  const relationRows = [];

  rows.forEach((product) => {
    const productId = normalizeText(product?.id, "");
    if (!productId) return;
    const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
    groups.forEach((group, groupIndex) => {
      const options = Array.isArray(group?.options) ? group.options : [];
      options.forEach((option, optionIndex) => {
        const toppingId = normalizeText(option?.id, "") || buildFallbackToppingId(option?.name || "", group?.id || "");
        const toppingName = normalizeText(option?.name, toppingId);
        const toppingPrice = normalizeNumber(option?.price, 0);

        if (!toppingMap.has(toppingId)) {
          toppingMap.set(toppingId, {
            id: toppingId,
            name: toppingName,
            price: toppingPrice,
            active: true,
            sort_order: optionIndex,
            metadata: {
              kind: "product_option",
              source: "option_group"
            }
          });
        }

        relationRows.push({
          product_id: productId,
          topping_id: toppingId,
          is_default: false,
          extra_price: toppingPrice,
          sort_order: groupIndex * 100 + optionIndex,
          metadata: {
            kind: "product_option",
            source: "option_group",
            groupId: group?.id || "",
            groupName: group?.name || "",
            required: Boolean(group?.required),
            maxSelect: normalizeNumber(group?.maxSelect, 1)
          }
        });
      });
    });
  });

  if (toppingMap.size) {
    const toppingPayload = Array.from(toppingMap.values());
    const { error: toppingUpsertError } = await client.from("toppings").upsert(toppingPayload, { onConflict: "id" });
    if (toppingUpsertError) throw toppingUpsertError;
  }

  const { error: deleteError } = await client.from("product_toppings").delete().in("product_id", productIds);
  if (deleteError) throw deleteError;

  if (!relationRows.length) return;
  const { error: relationInsertError } = await client.from("product_toppings").insert(relationRows);
  if (relationInsertError) throw relationInsertError;
}

async function writeStructuredCategories(value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const rows = Array.isArray(value) ? value : [];
  const cleaned = Array.from(
    new Set(
      rows
        .map((item) => normalizeText(item, ""))
        .filter((item) => item && item !== "Tất cả")
    )
  );
  if (!cleaned.length) return rows;
  const payload = cleaned.map((name, index) => ({
    id: name,
    name,
    sort_order: index,
    active: true
  }));
  const { error } = await client.from("categories").upsert(payload, { onConflict: "id" });
  if (error) throw error;

  const incomingSet = new Set(cleaned);
  const { data: dbCategories, error: dbCategoriesError } = await client.from("categories").select("id");
  if (dbCategoriesError) throw dbCategoriesError;
  const staleCategoryIds = (dbCategories || [])
    .map((item) => normalizeText(item?.id, ""))
    .filter((id) => id && id !== "Tất cả" && !incomingSet.has(id));
  if (staleCategoryIds.length) {
    // Keep data safe: do not hard-delete categories that still have products.
    const { data: relatedProducts, error: relatedProductsError } = await client
      .from("products")
      .select("category_id")
      .in("category_id", staleCategoryIds);
    if (relatedProductsError) throw relatedProductsError;
    const usedSet = new Set((relatedProducts || []).map((item) => normalizeText(item?.category_id, "")).filter(Boolean));
    const deletable = staleCategoryIds.filter((id) => !usedSet.has(id));
    if (deletable.length) {
      const { error: deleteCategoriesError } = await client.from("categories").delete().in("id", deletable);
      if (deleteCategoriesError) throw deleteCategoriesError;
    }
  }
  return cleaned;
}

async function writeStructuredToppings(value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const rows = (Array.isArray(value) ? value : []).filter((item) => normalizeText(item?.name, "") !== "");
  if (!rows.length) return rows;

  const basePayload = rows.map((item, index) => ({
    id: normalizeText(item?.id, "") || `topping-${Date.now()}-${index + 1}`,
    name: normalizeText(item?.name, ""),
    price: normalizeNumber(item?.price, 0),
    active: normalizeBoolean(item?.active, true),
    sort_order: normalizeNumber(item?.sortOrder, index),
    metadata: {
      ...(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}),
      kind: "standalone_topping"
    }
  }));

  try {
    const withMetadata = basePayload.map((row, index) => ({
      ...row,
      metadata: {
        ...(rows[index] && typeof rows[index] === "object" ? rows[index] : {}),
        kind: "standalone_topping"
      }
    }));
    const { error } = await client.from("toppings").upsert(withMetadata, { onConflict: "id" });
    if (error) throw error;
  } catch (_error) {
    const fallbackPayload = basePayload.map((row) => ({
      ...row,
      metadata: { kind: "standalone_topping" }
    }));
    const { error } = await client.from("toppings").upsert(fallbackPayload, { onConflict: "id" });
    if (error) throw error;
  }

  const incomingStandaloneIds = new Set(normalizeIdList(basePayload.map((item) => item.id)));
  const { data: dbToppings, error: dbToppingsError } = await client.from("toppings").select("id,metadata");
  if (dbToppingsError) throw dbToppingsError;
  const staleStandaloneIds = (dbToppings || [])
    .filter((row) => {
      const metadata = row?.metadata;
      const kind = metadata && typeof metadata === "object" ? String(metadata.kind || "") : "";
      return kind === "standalone_topping" || !kind;
    })
    .map((row) => normalizeText(row?.id, ""))
    .filter((id) => id && !incomingStandaloneIds.has(id));
  if (staleStandaloneIds.length) {
    const { error: deleteToppingsError } = await client.from("toppings").delete().in("id", staleStandaloneIds);
    if (deleteToppingsError) throw deleteToppingsError;
  }
  return rows;
}

async function readStructuredCoupons(fallback) {
  const client = getRuntimeSupabaseClient();
  if (!client) return fallback;
  const { data, error } = await client
    .from("coupons")
    .select("id,data,code,name,discount_type,value,max_discount,min_order,start_at,end_at,customer_type,usage_limit,per_user_limit,total_used,voucher_type,fulfillment_type,scope_type,scope_values,stackable,active,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data) || !data.length) return fallback;
  return data.map((row) => ({
    ...((row?.data && typeof row.data === "object") ? row.data : {}),
    id: String(((row?.data && typeof row.data === "object" ? row.data.id : null) || row?.id || row?.code || "")),
    code: String(((row?.data && typeof row.data === "object" ? row.data.code : null) || row?.code || "")).toUpperCase(),
    name: String(((row?.data && typeof row.data === "object" ? row.data.name : null) || row?.name || "")),
    discountType: (
      String((row?.data && typeof row.data === "object" ? row.data.discountType : row?.discount_type) || "fixed") === "percent"
      ? "percent"
      : "fixed"
    ),
    value: normalizeNumber(
      (row?.data && typeof row.data === "object" ? row.data.value : row?.value),
      0
    ),
    maxDiscount: normalizeNumber(
      (row?.data && typeof row.data === "object" ? row.data.maxDiscount : row?.max_discount),
      0
    ),
    minOrder: normalizeNumber(
      (row?.data && typeof row.data === "object" ? row.data.minOrder : row?.min_order),
      0
    ),
    startAt: String((row?.data && typeof row.data === "object" ? row.data.startAt : row?.start_at) || ""),
    endAt: String(
      (row?.data && typeof row.data === "object" ? (row.data.endAt || row.data.expiry) : row?.end_at) || ""
    ),
    expiry: String(
      (row?.data && typeof row.data === "object" ? (row.data.endAt || row.data.expiry) : row?.end_at) || ""
    ),
    customerType: String((row?.data && typeof row.data === "object" ? row.data.customerType : row?.customer_type) || "all"),
    usageLimit: normalizeNumber((row?.data && typeof row.data === "object" ? row.data.usageLimit : row?.usage_limit), 0),
    perUserLimit: Math.max(1, normalizeNumber((row?.data && typeof row.data === "object" ? row.data.perUserLimit : row?.per_user_limit), 1)),
    totalUsed: normalizeNumber((row?.data && typeof row.data === "object" ? row.data.totalUsed : row?.total_used), 0),
    voucherType: String((row?.data && typeof row.data === "object" ? row.data.voucherType : row?.voucher_type) || "checkout"),
    fulfillmentType: String((row?.data && typeof row.data === "object" ? row.data.fulfillmentType : row?.fulfillment_type) || "all"),
    scopeType: String((row?.data && typeof row.data === "object" ? row.data.scopeType : row?.scope_type) || "all"),
    scopeValues: String((row?.data && typeof row.data === "object" ? row.data.scopeValues : row?.scope_values) || ""),
    stackable: Boolean((row?.data && typeof row.data === "object" ? row.data.stackable : row?.stackable)),
    active: normalizeBoolean((row?.data && typeof row.data === "object" ? row.data.active : row?.active), true)
  }));
}

async function writeStructuredCoupons(value) {
  const client = getRuntimeSupabaseClient();
  if (!client) return value;
  const rows = Array.isArray(value) ? value : [];
  const payload = rows.map((item) => {
    const code = normalizeText(item?.code, "").toUpperCase();
    const normalized = {
      ...item,
      id: normalizeText(item?.id, "") || code || "",
      code,
      name: normalizeText(item?.name, "Mã giảm giá"),
      discountType: String(item?.discountType || "fixed") === "percent" ? "percent" : "fixed",
      value: normalizeNumber(item?.value, 0),
      maxDiscount: normalizeNumber(item?.maxDiscount, 0),
      minOrder: normalizeNumber(item?.minOrder, 0),
      startAt: normalizeText(item?.startAt, ""),
      endAt: normalizeText(item?.endAt || item?.expiry, ""),
      expiry: normalizeText(item?.endAt || item?.expiry, ""),
      customerType: normalizeText(item?.customerType, "all"),
      usageLimit: normalizeNumber(item?.usageLimit, 0),
      perUserLimit: Math.max(1, normalizeNumber(item?.perUserLimit, 1)),
      totalUsed: normalizeNumber(item?.totalUsed, 0),
      voucherType: normalizeText(item?.voucherType, "checkout"),
      fulfillmentType: normalizeText(item?.fulfillmentType, "all"),
      scopeType: normalizeText(item?.scopeType, "all"),
      scopeValues: normalizeText(item?.scopeValues, ""),
      stackable: Boolean(item?.stackable),
      active: normalizeBoolean(item?.active, true)
    };
    return {
      code: normalized.code || normalized.id || "",
      name: normalized.name,
      data: normalized
    };
  });

  const { error: deleteError } = await client.from("coupons").delete().not("id", "is", null);
  if (deleteError) throw deleteError;
  if (payload.length) {
    const { error: insertError } = await client.from("coupons").insert(payload);
    if (insertError) throw insertError;
  }
  return rows;
}

export async function writeCatalogToStandardTable(key, value) {
  if (!isSupabaseRuntimeReady()) return value;
  const tableName = CATALOG_TABLE_BY_KEY[key];
  if (!tableName) return value;

  if (key === "ghr_home_content") {
    return writeSingleJsonConfig(tableName, value);
  }
  if (key === "ghr_products") {
    return writeStructuredProducts(value);
  }
  if (key === "ghr_categories") {
    return writeStructuredCategories(value);
  }
  if (key === "ghr_toppings") {
    return writeStructuredToppings(value);
  }
  if (key === "ghr_coupons") {
    return writeStructuredCoupons(value);
  }
  return writeJsonRows(tableName, value);
}

function normalizeOptionGroupPresets(optionGroupPresets = []) {
  return (Array.isArray(optionGroupPresets) ? optionGroupPresets : [])
    .map((group, groupIndex) => ({
      id: normalizeText(group?.id, `group-${groupIndex + 1}`),
      name: normalizeText(group?.name, `Nhóm ${groupIndex + 1}`),
      required: Boolean(group?.required),
      maxSelect: Math.max(1, normalizeNumber(group?.maxSelect, 1)),
      active: group?.active !== false,
      sortOrder: normalizeNumber(group?.sortOrder, groupIndex),
      metadata: group && typeof group === "object" ? group : {},
      options: (Array.isArray(group?.options) ? group.options : [])
        .map((option, optionIndex) => ({
        id: normalizeText(option?.id, `${normalizeText(group?.id, `group-${groupIndex + 1}`)}-option-${optionIndex + 1}`),
        name: normalizeText(option?.name, ""),
        price: normalizeNumber(option?.price, 0),
        active: option?.active !== false,
        sortOrder: normalizeNumber(option?.sortOrder, optionIndex),
        metadata: option && typeof option === "object" ? option : {}
        }))
        .filter((option) => Boolean(option.name))
    }))
    .filter((group) => Boolean(group.id) && Array.isArray(group.options) && group.options.length > 0);
}

function resolveProductLinkedGroupIds(product = {}, optionGroupByName = new Map()) {
  const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
  const ids = groups
    .map((group) => normalizeText(group?.sourcePresetId, "") || optionGroupByName.get(normalizeText(group?.name, "").toLowerCase()) || "")
    .filter(Boolean);
  return normalizeIdList(ids);
}

export async function writeOptionGroupsSnapshotToTables({
  optionGroupPresets = [],
  products = []
} = {}) {
  if (!isSupabaseRuntimeReady()) return { ok: false, reason: "supabase_runtime_not_ready" };
  const client = getRuntimeSupabaseClient();
  if (!client) return { ok: false, reason: "missing_supabase_client" };

  const groups = normalizeOptionGroupPresets(optionGroupPresets);
  const optionGroupByName = new Map(
    groups.map((group) => [normalizeText(group.name, "").toLowerCase(), group.id])
  );

  const productGroupLinks = (Array.isArray(products) ? products : []).flatMap((product, productIndex) => {
    const productId = normalizeText(product?.id, "");
    if (!productId) return [];
    const groupIds = resolveProductLinkedGroupIds(product, optionGroupByName);
    return groupIds.map((groupId, linkIndex) => ({
      product_id: productId,
      group_id: groupId,
      sort_order: productIndex * 100 + linkIndex,
      metadata: {
        source: "product_option_groups",
        productName: normalizeText(product?.name, "")
      }
    }));
  });

  const groupRows = groups.map((group) => ({
    id: group.id,
    name: group.name,
    required: group.required,
    max_select: group.maxSelect,
    active: group.active,
    sort_order: group.sortOrder,
    metadata: group.metadata
  }));

  const optionRows = groups.flatMap((group) =>
    (group.options || []).map((option) => ({
      id: option.id,
      group_id: group.id,
      name: option.name,
      price: option.price,
      active: option.active,
      sort_order: option.sortOrder,
      metadata: option.metadata
    }))
  );

  const { error: deleteLinksError } = await client.from("product_option_groups").delete().not("id", "is", null);
  if (deleteLinksError) throw deleteLinksError;
  const { error: deleteOptionsError } = await client.from("option_group_options").delete().not("id", "is", null);
  if (deleteOptionsError) throw deleteOptionsError;
  const { error: deleteGroupsError } = await client.from("option_groups").delete().not("id", "is", null);
  if (deleteGroupsError) throw deleteGroupsError;

  if (groupRows.length) {
    const { error: insertGroupsError } = await client.from("option_groups").insert(groupRows);
    if (insertGroupsError) throw insertGroupsError;
  }
  if (optionRows.length) {
    const { error: insertOptionsError } = await client.from("option_group_options").insert(optionRows);
    if (insertOptionsError) throw insertOptionsError;
  }
  if (productGroupLinks.length) {
    const { error: insertLinksError } = await client.from("product_option_groups").insert(productGroupLinks);
    if (insertLinksError) throw insertLinksError;
  }

  return {
    ok: true,
    groups: groupRows.length,
    options: optionRows.length,
    links: productGroupLinks.length
  };
}

export function subscribeCatalogRealtime(key, onChange) {
  if (!isSupabaseRuntimeReady()) return () => {};
  const tableName = CATALOG_TABLE_BY_KEY[key];
  const client = getRuntimeSupabaseClient();
  if (!tableName || !client || typeof onChange !== "function") return () => {};

  const channelName = `ghr-catalog-${tableName}-${Date.now()}`;
  const channel = client
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      async () => {
        try {
          const nextValue = await readCatalogFromStandardTable(key, null, { force: true });
          if (nextValue !== null && nextValue !== undefined) {
            onChange(nextValue);
          }
        } catch (_error) {
          // Keep UI running when realtime refresh fails.
        }
      }
    )
    .subscribe();
  if (isDev) console.info(`[catalogSupabaseRepository] realtime subscribe active: ${key} -> ${tableName}`);

  return () => {
    try {
      client.removeChannel(channel);
    } catch (_error) {
      // noop
    }
  };
}

