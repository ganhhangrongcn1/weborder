export const ALL_MENU_CATEGORY_LABEL = "Tất cả";
export const DEFAULT_MENU_CATEGORY_LABEL = "Set Bánh Tráng";

export function normalizeMenuCategoryLabel(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isAllMenuCategory(category) {
  return normalizeMenuCategoryLabel(category) === normalizeMenuCategoryLabel(ALL_MENU_CATEGORY_LABEL);
}

export function findMenuCategory(categories = [], target = DEFAULT_MENU_CATEGORY_LABEL) {
  const targetKey = normalizeMenuCategoryLabel(target);
  return (categories || []).find((category) => normalizeMenuCategoryLabel(category) === targetKey) || "";
}

export function hasMenuCategory(categories = [], target = "") {
  if (!target) return false;
  return Boolean(findMenuCategory(categories, target));
}

export function sortCustomerMenuCategories(categories = []) {
  const cleaned = [];
  const seen = new Set();

  (categories || []).forEach((category) => {
    const label = String(category || "").trim();
    const key = normalizeMenuCategoryLabel(label);
    if (!label || seen.has(key)) return;
    cleaned.push(label);
    seen.add(key);
  });

  const allCategory = cleaned.find(isAllMenuCategory);
  const regularCategories = cleaned.filter((category) => !isAllMenuCategory(category));
  return allCategory ? [...regularCategories, allCategory] : regularCategories;
}

export function resolveDefaultMenuCategory(categories = []) {
  const preferredCategory = findMenuCategory(categories, DEFAULT_MENU_CATEGORY_LABEL);
  if (preferredCategory) return preferredCategory;

  const firstRegularCategory = (categories || []).find((category) => category && !isAllMenuCategory(category));
  return firstRegularCategory || findMenuCategory(categories, ALL_MENU_CATEGORY_LABEL) || ALL_MENU_CATEGORY_LABEL;
}
