import { adminConfigRepository } from "./repositories/adminConfigRepository.js";

export const MENU_SCHEMA_KEY = "ghr_menu_schema";
export const MENU_SCHEMA_VERSION = 1;

function cleanText(value, fallback = "") {
  const text = String(value ?? "").normalize("NFC").trim();
  return text || fallback;
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function slugify(value, fallback = "item") {
  const slug = cleanText(value, fallback)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function uniqueRows(rows, getKey) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = getKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeMenuCategory(category, index = 0) {
  const name = typeof category === "string" ? category : category?.name || category?.id;
  const normalizedName = cleanText(name, "Danh mục");
  return {
    id: cleanText(category?.id, slugify(normalizedName)),
    name: normalizedName,
    sortOrder: cleanNumber(category?.sortOrder ?? category?.sort_order, index),
    active: category?.active !== false
  };
}

export function normalizeMenuTopping(topping, index = 0) {
  const name = cleanText(topping?.name, "Topping");
  return {
    id: cleanText(topping?.id, `topping-${slugify(name)}-${index + 1}`),
    name,
    price: cleanNumber(topping?.price, 0),
    active: topping?.active !== false,
    sortOrder: cleanNumber(topping?.sortOrder ?? topping?.sort_order, index),
    metadata: { ...(topping || {}) }
  };
}

export function normalizeMenuProduct(product, index = 0) {
  const name = cleanText(product?.name, "Món ăn");
  const categoryId = cleanText(product?.categoryId || product?.category_id || product?.category, "");
  return {
    id: cleanText(product?.id, `product-${slugify(name)}-${index + 1}`),
    name,
    short: String(product?.short ?? ""),
    description: String(product?.description ?? ""),
    image: String(product?.image ?? ""),
    price: cleanNumber(product?.price, 0),
    oldPrice: product?.oldPrice === "" || product?.oldPrice === undefined ? "" : cleanNumber(product?.oldPrice, 0),
    originalPrice: product?.originalPrice === "" || product?.originalPrice === undefined ? "" : cleanNumber(product?.originalPrice, 0),
    badge: String(product?.badge ?? ""),
    categoryId,
    visible: product?.visible !== false,
    active: product?.active !== false,
    sortOrder: cleanNumber(product?.sortOrder ?? product?.sort_order, index),
    metadata: { ...(product || {}) }
  };
}

export function normalizeMenuOptionGroup(group, index = 0) {
  const name = cleanText(group?.name, "Nhóm tùy chọn");
  return {
    id: cleanText(group?.id, `option-group-${slugify(name)}-${index + 1}`),
    name,
    required: Boolean(group?.required),
    maxSelect: Math.max(1, cleanNumber(group?.maxSelect, 1)),
    active: group?.active !== false,
    sortOrder: cleanNumber(group?.sortOrder ?? group?.sort_order, index),
    metadata: { ...(group || {}), options: undefined }
  };
}

export function normalizeMenuOptionItem(option, groupId, index = 0) {
  const name = cleanText(option?.name, "Tùy chọn");
  return {
    id: cleanText(option?.id, `${groupId}-${slugify(name)}-${index + 1}`),
    optionGroupId: groupId,
    name,
    price: cleanNumber(option?.price, 0),
    active: option?.active !== false,
    sortOrder: cleanNumber(option?.sortOrder ?? option?.sort_order, index),
    metadata: { ...(option || {}) }
  };
}

function buildProductOptionGroups(products = [], optionGroups = []) {
  const groupById = new Map(optionGroups.map((group) => [group.id, group]));
  const groupByName = new Map(optionGroups.map((group) => [cleanText(group.name).toLowerCase(), group]));
  const rows = [];

  products.forEach((product) => {
    const productId = cleanText(product?.id, "");
    if (!productId) return;
    const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
    groups.forEach((group, index) => {
      const sourceId = cleanText(group?.sourcePresetId || group?.optionGroupId || group?.id, "");
      const matchedGroup = groupById.get(sourceId) || groupByName.get(cleanText(group?.name).toLowerCase());
      const optionGroupId = matchedGroup?.id || sourceId;
      if (!optionGroupId) return;
      rows.push({
        id: `${productId}-${optionGroupId}`,
        productId,
        optionGroupId,
        sortOrder: index,
        required: group?.required ?? matchedGroup?.required ?? false,
        maxSelect: Math.max(1, cleanNumber(group?.maxSelect ?? matchedGroup?.maxSelect, 1))
      });
    });
  });

  return uniqueRows(rows, (row) => row.id);
}

export function buildMenuSchema({
  products = [],
  categories = [],
  toppings = [],
  optionGroupPresets = []
} = {}) {
  const normalizedCategories = uniqueRows(
    categories.map((category, index) => normalizeMenuCategory(category, index)),
    (category) => category.id
  );
  const normalizedProducts = uniqueRows(
    products.map((product, index) => normalizeMenuProduct(product, index)),
    (product) => product.id
  );
  const normalizedToppings = uniqueRows(
    toppings.map((topping, index) => normalizeMenuTopping(topping, index)),
    (topping) => topping.id
  );
  const normalizedOptionGroups = uniqueRows(
    optionGroupPresets.map((group, index) => normalizeMenuOptionGroup(group, index)),
    (group) => group.id
  );
  const optionGroupItems = normalizedOptionGroups.flatMap((group) => {
    const sourceGroup = optionGroupPresets.find((item) => cleanText(item?.id) === group.id) || {};
    return (sourceGroup.options || []).map((option, index) => normalizeMenuOptionItem(option, group.id, index));
  });

  return {
    version: MENU_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    categories: normalizedCategories,
    products: normalizedProducts,
    toppings: normalizedToppings,
    optionGroups: normalizedOptionGroups,
    optionGroupItems,
    productOptionGroups: buildProductOptionGroups(products, normalizedOptionGroups)
  };
}

function isValidMenuSchema(schema) {
  return Boolean(schema && typeof schema === "object" && Array.isArray(schema.products));
}

export function loadMenuSchema() {
  // Customer runtime should read menu schema from local cache only.
  // Remote sync for this key is handled by explicit admin flows.
  const saved = adminConfigRepository.getLocal(MENU_SCHEMA_KEY, null);
  return isValidMenuSchema(saved) ? saved : null;
}

export function saveMenuSchema(schema) {
  const normalized = {
    version: MENU_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    categories: Array.isArray(schema?.categories) ? schema.categories : [],
    products: Array.isArray(schema?.products) ? schema.products : [],
    toppings: Array.isArray(schema?.toppings) ? schema.toppings : [],
    optionGroups: Array.isArray(schema?.optionGroups) ? schema.optionGroups : [],
    optionGroupItems: Array.isArray(schema?.optionGroupItems) ? schema.optionGroupItems : [],
    productOptionGroups: Array.isArray(schema?.productOptionGroups) ? schema.productOptionGroups : []
  };
  return adminConfigRepository.set(MENU_SCHEMA_KEY, normalized);
}

export async function saveMenuSchemaAsync(schema) {
  const saved = saveMenuSchema(schema);
  await adminConfigRepository.setAsync(MENU_SCHEMA_KEY, saved);
  return saved;
}

export function saveMenuSchemaFromLegacy(payload = {}) {
  const current = loadMenuSchema();
  const next = buildMenuSchema({
    products: payload.products ?? legacyProductsFromMenuSchema(current),
    categories: payload.categories ?? legacyCategoriesFromMenuSchema(current),
    toppings: payload.toppings ?? legacyToppingsFromMenuSchema(current),
    optionGroupPresets: payload.optionGroupPresets ?? legacyOptionGroupPresetsFromMenuSchema(current)
  });
  return saveMenuSchema(next);
}

export async function saveMenuSchemaFromLegacyAsync(payload = {}) {
  const saved = saveMenuSchemaFromLegacy(payload);
  await adminConfigRepository.setAsync(MENU_SCHEMA_KEY, saved);
  return saved;
}

export function legacyCategoriesFromMenuSchema(schema) {
  if (!isValidMenuSchema(schema)) return [];
  return [...(schema.categories || [])]
    .filter((category) => category.active !== false)
    .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
    .map((category) => category.name || category.id)
    .filter(Boolean);
}

export function legacyToppingsFromMenuSchema(schema) {
  if (!isValidMenuSchema(schema)) return [];
  return [...(schema.toppings || [])]
    .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
    .map((topping) => ({
      ...(topping.metadata || {}),
      id: topping.id,
      name: topping.name,
      price: topping.price,
      active: topping.active
    }));
}

export function legacyOptionGroupPresetsFromMenuSchema(schema) {
  if (!isValidMenuSchema(schema)) return [];
  const itemsByGroup = new Map();
  (schema.optionGroupItems || []).forEach((item) => {
    const list = itemsByGroup.get(item.optionGroupId) || [];
    list.push(item);
    itemsByGroup.set(item.optionGroupId, list);
  });

  return [...(schema.optionGroups || [])]
    .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
    .map((group) => ({
      ...(group.metadata || {}),
      id: group.id,
      name: group.name,
      required: Boolean(group.required),
      maxSelect: Math.max(1, cleanNumber(group.maxSelect, 1)),
      active: group.active,
      options: [...(itemsByGroup.get(group.id) || [])]
        .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
        .map((item) => ({
          ...(item.metadata || {}),
          id: item.id,
          name: item.name,
          price: item.price,
          active: item.active
        }))
    }));
}

export function legacyProductsFromMenuSchema(schema) {
  if (!isValidMenuSchema(schema)) return [];
  const optionGroups = legacyOptionGroupPresetsFromMenuSchema(schema);
  const optionGroupById = new Map(optionGroups.map((group) => [group.id, group]));
  const productGroupsByProductId = new Map();
  (schema.productOptionGroups || []).forEach((row) => {
    const list = productGroupsByProductId.get(row.productId) || [];
    list.push(row);
    productGroupsByProductId.set(row.productId, list);
  });

  return [...(schema.products || [])]
    .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
    .map((product) => {
      const linkedGroups = [...(productGroupsByProductId.get(product.id) || [])]
        .sort((a, b) => cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
        .map((row) => {
          const preset = optionGroupById.get(row.optionGroupId);
          if (!preset) return null;
          return {
            id: `option-group-${preset.id}`,
            sourcePresetId: preset.id,
            name: preset.name,
            type: Math.max(1, cleanNumber(row.maxSelect ?? preset.maxSelect, 1)) === 1 ? "single" : "multiple",
            required: Boolean(row.required ?? preset.required),
            maxSelect: Math.max(1, cleanNumber(row.maxSelect ?? preset.maxSelect, 1)),
            options: (preset.options || [])
              .filter((option) => option.active !== false)
              .map((option) => ({
                id: `${preset.id}-${option.id}`,
                name: option.name,
                price: option.price
              }))
          };
        })
        .filter(Boolean);

      return {
        ...(product.metadata || {}),
        id: product.id,
        name: product.name,
        short: product.short,
        description: product.description,
        image: product.image,
        price: product.price,
        oldPrice: product.oldPrice,
        originalPrice: product.originalPrice,
        badge: product.badge,
        category: product.categoryId,
        visible: product.visible,
        active: product.active,
        optionGroups: linkedGroups.length ? linkedGroups : product.metadata?.optionGroups
      };
    });
}
