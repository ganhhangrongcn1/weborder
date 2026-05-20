import { useMemo, useState } from "react";
import ProductCard from "../../components/ProductCard.jsx";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import { products as productSeed } from "../../data/products.js";
import { menuText, suggestText } from "../../data/uiText.js";
import ToppingMenuCard from "./components/ToppingMenuCard.jsx";

export default function Menu({
  navigate,
  activeCategory,
  setActiveCategory,
  categories,
  filteredProducts,
  products,
  toppings,
  openProduct,
  openOptionModal,
  addToCart,
  cart = [],
  setCart
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const cartProductCount = useMemo(() => {
    return cart.reduce((map, item) => {
      const key = String(item.id || "").replace(/^addon-/, "");
      return {
        ...map,
        [key]: (map[key] || 0) + (item.quantity || 1)
      };
    }, {});
  }, [cart]);

  const sortedToppings = useMemo(
    () => [...toppings].sort((first, second) => Number(second.price || 0) - Number(first.price || 0)),
    [toppings]
  );

  const displayCategories = useMemo(() => {
    const allLabel = "Tất cả";
    const cleaned = (categories || []).map((item) => String(item || "").trim()).filter(Boolean);
    const withoutAll = cleaned.filter((item) => item !== allLabel);
    return cleaned.includes(allLabel) ? [allLabel, ...withoutAll] : cleaned;
  }, [categories]);

  const displayProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return filteredProducts.filter((product) => {
      const name = String(product?.name || "").toLowerCase();
      const short = String(product?.short || product?.description || "").toLowerCase();
      const category = String(product?.category || "").toLowerCase();
      const badge = String(product?.badge || "").toLowerCase();
      return !keyword || [name, short, category, badge].some((value) => value.includes(keyword));
    });
  }, [filteredProducts, searchTerm]);

  const removeOneByKey = (rawKey) => {
    const key = String(rawKey || "").replace(/^addon-/, "");
    setCart((items) => {
      const index = items.findIndex((item) => String(item.id || "").replace(/^addon-/, "") === key);
      if (index < 0) return items;
      const next = [...items];
      const item = next[index];
      if ((item.quantity || 1) > 1) {
        const quantity = item.quantity - 1;
        next[index] = {
          ...item,
          quantity,
          lineTotal: item.unitTotal * quantity
        };
      } else {
        next.splice(index, 1);
      }
      return next;
    });
  };

  const addToppingAsItem = (topping) => {
    addToCart({
      product: {
        id: `addon-${topping.id}`,
        name: topping.name,
        short: menuText.addonShort,
        description: menuText.addonDescription,
        price: Number(topping.price) || 0,
        category: suggestText.addonSpice,
        badge: "Topping",
        image: topping.image || productSeed[0].image
      },
      spice: menuText.addonSpice,
      toppings: [],
      note: menuText.addonNote,
      quantity: 1
    });
  };

  return (
    <section>
      <AppHeader title={menuText.title} subtitle="Chọn món, thêm topping rồi thanh toán" onBack={() => navigate("home", "home")} />
      <div className="space-y-4 px-4 pb-32">
        <div className="menu-sticky-tools">
          <div className="menu-search">
            <Icon name="search" size={17} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-brown/35"
              placeholder={menuText.searchPlaceholder}
            />
            {searchTerm ? (
              <button type="button" onClick={() => setSearchTerm("")} className="menu-search-clear" aria-label="Xóa tìm kiếm">
                ×
              </button>
            ) : null}
          </div>

          <div className="menu-chip-row-wrap">
            <div className="no-scrollbar menu-chip-row">
              {displayCategories.map((category, index) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`chip ${activeCategory === category ? "chip-active" : ""} ${index === 0 && category === "Tất cả" ? "chip-pinned-all" : ""}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="menu-result-row">
          <span>{displayProducts.length} món</span>
          {searchTerm ? <strong>Đang tìm “{searchTerm}”</strong> : <strong>{activeCategory}</strong>}
        </div>

        {displayProducts.length ? (
          <div className="menu-product-list">
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                compact
                selectedCount={cartProductCount[product.id] || 0}
                onOpen={openProduct}
                onAdd={openOptionModal}
                onRemove={() => removeOneByKey(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="menu-empty-state">
            <strong>Chưa có món phù hợp</strong>
            <span>Thử đổi danh mục hoặc tìm bằng tên món khác.</span>
          </div>
        )}

        <div className="menu-addon-section">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p>{menuText.addonSectionEyebrow}</p>
              <h2>{menuText.addonSectionTitle}</h2>
            </div>
            <span>{menuText.addonSectionHint}</span>
          </div>
          <div className="no-scrollbar menu-addon-scroll">
            {sortedToppings.map((topping) => (
              <ToppingMenuCard
                key={topping.id}
                topping={topping}
                onAdd={() => addToppingAsItem(topping)}
                onRemove={() => removeOneByKey(topping.id)}
                selectedCount={cartProductCount[topping.id] || 0}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
