// Balance actual chip widths, not the number of category names.
// Order stays stable inside each row; the first category remains on the first row.
export function buildBalancedCategoryRows(categories = [], widths = {}, gap = 8) {
  if (categories.length < 2) return [categories];
  const weights = categories.map((name) => Math.ceil(widths[name] || 190) + gap);
  const target = Math.floor(weights.reduce((sum, width) => sum + width, 0) / 2);
  const combinations = new Map([[0, []]]);
  weights.forEach((weight, index) => {
    for (const [sum, indexes] of Array.from(combinations.entries())) {
      const next = sum + weight;
      if (next <= target && !combinations.has(next)) combinations.set(next, [...indexes, index]);
    }
  });
  const best = Math.max(...combinations.keys());
  const selected = new Set(combinations.get(best));
  const rows = [[], []];
  categories.forEach((name, index) => rows[selected.has(index) ? 0 : 1].push(name));
  if (!rows[0].includes(categories[0])) rows.reverse();
  return rows.filter((row) => row.length);
}

export function getCategoryRowWidth(row = [], widths = {}, gap = 8) {
  return row.reduce((sum, name) => sum + Math.ceil(widths[name] || 190), 0)
    + Math.max(0, row.length - 1) * gap;
}
