import { isAllMenuCategory, normalizeMenuCategoryLabel } from "../../constants/menuCategoryConfig.js";

export function getMenuCategoryAnchorKey(category = "") {
  return normalizeMenuCategoryLabel(category)
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mon-khac";
}

export function buildMenuProductGroups(categories = [], products = []) {
  const orderedCategories = (Array.isArray(categories) ? categories : [])
    .filter((category) => category && !isAllMenuCategory(category));
  const groups = orderedCategories.map((category) => ({
    key: getMenuCategoryAnchorKey(category),
    matchKey: normalizeMenuCategoryLabel(category),
    category,
    products: []
  }));
  const groupByKey = new Map(groups.map((group) => [group.matchKey, group]));
  const extraGroupByKey = new Map();

  (Array.isArray(products) ? products : []).forEach((product) => {
    const categoryLabel = String(product?.category || "").trim();
    const badgeLabel = String(product?.badge || "").trim();
    const categoryKey = normalizeMenuCategoryLabel(categoryLabel);
    const badgeKey = normalizeMenuCategoryLabel(badgeLabel);
    const matchedGroup = groupByKey.get(categoryKey) || groupByKey.get(badgeKey);

    if (matchedGroup) {
      matchedGroup.products.push(product);
      return;
    }

    const fallbackLabel = categoryLabel || "Món khác";
    const fallbackKey = getMenuCategoryAnchorKey(fallbackLabel);
    let fallbackGroup = extraGroupByKey.get(fallbackKey);
    if (!fallbackGroup) {
      fallbackGroup = {
        key: fallbackKey,
        matchKey: normalizeMenuCategoryLabel(fallbackLabel),
        category: fallbackLabel,
        products: []
      };
      extraGroupByKey.set(fallbackKey, fallbackGroup);
    }
    fallbackGroup.products.push(product);
  });

  return [...groups, ...extraGroupByKey.values()].filter((group) => group.products.length > 0);
}
