export const ALL_CATEGORY = "Tất cả";

export function buildCategoryStats(adminCategories, products) {
  const map = new Map();
  adminCategories.forEach((category) => map.set(category, { total: 0, hidden: 0 }));
  products.forEach((product) => {
    const key = product.category || adminCategories[0];
    const row = map.get(key) || { total: 0, hidden: 0 };
    row.total += 1;
    if (product.visible === false) row.hidden += 1;
    map.set(key, row);
  });
  return map;
}

export function filterAdminProducts({ products, productSearch, selectedAdminCategory, viewFilter }) {
  return products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedAdminCategory === ALL_CATEGORY || product.category === selectedAdminCategory || product.badge === selectedAdminCategory;
    const matchesView = viewFilter === "all" || (viewFilter === "visible" ? product.visible !== false : product.visible === false);
    return matchesSearch && matchesCategory && matchesView;
  });
}

export function filterPresets(optionGroupPresets, groupSearch) {
  const q = groupSearch.trim().toLowerCase();
  if (!q) return optionGroupPresets;
  return optionGroupPresets.filter((item) => String(item.name || "").toLowerCase().includes(q));
}

export function normalizePresetDraft(editingPresetDraft) {
  return {
    ...editingPresetDraft,
    name: String(editingPresetDraft.name || "").trim() || "Nhóm tùy chọn",
    maxSelect: Math.max(1, Number(editingPresetDraft.maxSelect || 1)),
    options: (editingPresetDraft.options || []).map((opt) => ({
      ...opt,
      name: String(opt.name || "").trim() || "Tùy chọn",
      price: Math.max(0, Number(opt.price || 0))
    }))
  };
}
