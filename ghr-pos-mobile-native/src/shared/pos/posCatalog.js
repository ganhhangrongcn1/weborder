export const ALL_CATEGORY = "Tất cả";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeSearchText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildPosCatalog({ products = [], categories = [] } = {}) {
  const normalizedProducts = (Array.isArray(products) ? products : [])
    .map((product) => ({
      ...product,
      id: toText(product.id),
      name: toText(product.name),
      category: toText(product.category) || "Khác",
      price: Number(product.price || 0),
      active: product.active !== false,
      visible: product.visible !== false
    }))
    .filter((product) => product.id && product.name && product.active && product.visible);

  const productCategorySet = new Set();
  normalizedProducts.forEach((product) => {
    if (product.category) productCategorySet.add(product.category);
  });

  const orderedCategories = [];
  const seenCategories = new Set();

  (Array.isArray(categories) ? categories : [])
    .map(toText)
    .filter(Boolean)
    .filter((category) => category !== ALL_CATEGORY)
    .forEach((category) => {
      if (!productCategorySet.has(category) || seenCategories.has(category)) return;
      orderedCategories.push(category);
      seenCategories.add(category);
    });

  normalizedProducts.forEach((product) => {
    if (!product.category || seenCategories.has(product.category)) return;
    orderedCategories.push(product.category);
    seenCategories.add(product.category);
  });

  return {
    products: normalizedProducts,
    categories: [...orderedCategories, ALL_CATEGORY]
  };
}

export function filterPosProducts(products = [], { category = ALL_CATEGORY, search = "" } = {}) {
  const activeCategory = toText(category) || ALL_CATEGORY;
  const searchKey = normalizeSearchText(search);

  return (Array.isArray(products) ? products : []).filter((product) => {
    const matchesCategory = activeCategory === ALL_CATEGORY || product.category === activeCategory;
    if (!matchesCategory) return false;
    if (!searchKey) return true;

    return normalizeSearchText([
      product.name,
      product.short,
      product.description,
      product.category
    ].join(" ")).includes(searchKey);
  });
}
