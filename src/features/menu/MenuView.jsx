import { useMemo, useState } from "react";
import ProductCard from "../../components/ProductCard.jsx";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import { isAllMenuCategory, sortCustomerMenuCategories } from "../../constants/menuCategoryConfig.js";
import { products as productSeed } from "../../data/products.js";
import { menuText, suggestText } from "../../data/uiText.js";
import ToppingMenuCard from "./components/ToppingMenuCard.jsx";
import { buildQrPromotionOffers } from "../../services/qrOfferService.js";
import { formatMoney } from "../../utils/format.js";
import { getDefaultOrderChoices } from "../../utils/pureHelpers.js";

function MenuPromoRail({ items = [], onOpen, onQuickAdd }) {
  if (!items.length) return null;

  return (
    <section className="menu-promo-rail">
      <div className="menu-promo-rail__scroll no-scrollbar" aria-label="Món đang giảm giá">
        {items.map((item) => (
          <article key={item.id} className="menu-promo-card">
            <div className="menu-promo-card__main">
              <button
                type="button"
                className="menu-promo-card__image"
                onClick={() => onOpen(item.product)}
                aria-label={`Xem ưu đãi ${item.product.name}`}
              >
                <img src={item.product.image} alt={item.product.name} loading="lazy" />
                <em>{item.offer.eyebrow || "Flash Sale"}</em>
              </button>
              <span className="menu-promo-card__copy">
                <strong>{item.product.name}</strong>
                <small>{item.product.short || item.offer.detail || "Đang áp dụng tại quầy"}</small>
                <span className="menu-promo-card__price">
                  <b>{formatMoney(Number(item.offer.currentPrice || item.product.price || 0))}</b>
                  <span>
                    <del>{formatMoney(Number(item.offer.originalPrice || item.product.originalPrice || item.product.price || 0))}</del>
                    <button type="button" className="menu-promo-card__cta" onClick={() => onQuickAdd(item.product)}>
                      Mua ngay
                    </button>
                  </span>
                </span>
              </span>
              <span className="menu-promo-card__discount">
                -{Math.max(1, Math.round(((Number(item.offer.originalPrice || item.product.originalPrice || 0) - Number(item.offer.currentPrice || item.product.price || 0)) / Math.max(Number(item.offer.originalPrice || item.product.originalPrice || 1), 1)) * 100))}%
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Menu({
  navigate,
  activeCategory,
  setActiveCategory,
  categories,
  filteredProducts,
  products,
  toppings,
  smartPromotions = [],
  checkoutPreset = {},
  openProduct,
  openOptionModal,
  addToCart,
  cart = [],
  setCart
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddonOpen, setIsAddonOpen] = useState(false);
  const isQrCounterMenu =
    String(checkoutPreset?.orderSource || checkoutPreset?.source || "").toLowerCase() === "qr_counter" ||
    (typeof window !== "undefined" && /^\/qr\/[^/]+/i.test(window.location.pathname || ""));

  const cartProductCount = useMemo(() => {
    const counts = {};
    cart.forEach((item) => {
      const key = String(item.id || "").replace(/^addon-/, "");
      counts[key] = (counts[key] || 0) + (item.quantity || 1);
    });
    return counts;
  }, [cart]);

  const sortedToppings = useMemo(
    () => [...toppings].sort((first, second) => Number(second.price || 0) - Number(first.price || 0)),
    [toppings]
  );

  const displayCategories = useMemo(() => {
    return sortCustomerMenuCategories(categories);
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

  const promoRailItems = useMemo(() => {
    if (!isQrCounterMenu) return [];
    const promotionOffers = buildQrPromotionOffers({ smartPromotions, products }).filter(
      (offer) => Number(offer?.originalPrice || 0) > Number(offer?.currentPrice || 0)
    );

    const seenProductIds = new Set();
    return promotionOffers
      .map((offer) => {
        const product = products.find((item) => String(item?.id || "") === String(offer?.productId || ""));
        if (!product) return null;
        if (seenProductIds.has(product.id)) return null;
        seenProductIds.add(product.id);
        return { id: `${offer.id}-${product.id}`, offer, product };
      })
      .filter(Boolean)
      .slice(0, 8);
  }, [isQrCounterMenu, products, smartPromotions]);

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

  const addMenuProductQuick = (product) => {
    const defaults = getDefaultOrderChoices(product);
    addToCart({
      product,
      spice: defaults.spice,
      toppings: defaults.toppings,
      quantity: 1,
      note: ""
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
              type="search"
              name="menuSearch"
              autoComplete="off"
              aria-label="Tìm món trong menu"
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
        </div>

        {!isQrCounterMenu ? (
          <div className="menu-result-row" role="status" aria-live="polite">
            <span>{displayProducts.length} món</span>
            {searchTerm ? <strong>Đang tìm “{searchTerm}”</strong> : <strong>{activeCategory}</strong>}
          </div>
        ) : null}

        {!searchTerm ? (
          <MenuPromoRail
            items={promoRailItems}
            onOpen={openProduct}
            onQuickAdd={addMenuProductQuick}
          />
        ) : null}

        <div className="menu-chip-row-wrap menu-chip-row-wrap--after-promo">
          <div className="no-scrollbar menu-chip-row">
            {displayCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`chip ${activeCategory === category ? "chip-active" : ""} ${isAllMenuCategory(category) ? "chip-pinned-all" : ""}`}
                aria-pressed={activeCategory === category}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {!searchTerm && sortedToppings.length ? (
          <section className={`menu-addon-section${isAddonOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="menu-addon-toggle"
              onClick={() => setIsAddonOpen((current) => !current)}
              aria-expanded={isAddonOpen}
            >
              <span>
                <small>{menuText.addonSectionEyebrow}</small>
                <strong>{menuText.addonSectionTitle}</strong>
              </span>
              <span className="menu-addon-toggle__meta">
                {isAddonOpen ? "Thu gọn" : menuText.addonSectionHint}
                <Icon name="back" size={15} className={isAddonOpen ? "is-open" : ""} />
              </span>
            </button>

            {isAddonOpen ? (
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
            ) : null}
          </section>
        ) : null}

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

      </div>
    </section>
  );
}
