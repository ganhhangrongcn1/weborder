import { useMemo, useState } from "react";
import { ALL_CATEGORY, buildPosCatalog, filterPosProducts } from "../services/posService.js";

export default function usePosCatalog({ products = [], categories = [] } = {}) {
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");

  const catalog = useMemo(
    () => buildPosCatalog({ products, categories }),
    [products, categories]
  );

  const defaultCategory = useMemo(
    () => catalog.categories.find((category) => category !== ALL_CATEGORY) || ALL_CATEGORY,
    [catalog.categories]
  );

  const effectiveCategory = catalog.categories.includes(activeCategory) ? activeCategory : defaultCategory;

  const visibleProducts = useMemo(
    () => filterPosProducts(catalog.products, { category: effectiveCategory, search }),
    [catalog.products, effectiveCategory, search]
  );

  return {
    activeCategory: effectiveCategory,
    setActiveCategory,
    search,
    setSearch,
    categories: catalog.categories,
    products: catalog.products,
    visibleProducts
  };
}
