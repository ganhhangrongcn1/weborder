import CustomerControl from "../../components/customer/CustomerControl.jsx";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProductCard from "../../components/ProductCard.jsx";
import Icon from "../../components/Icon.jsx";
import { isAllMenuCategory, sortCustomerMenuCategories } from "../../constants/menuCategoryConfig.js";
import { menuText } from "../../data/uiText.js";
import MenuCategorySections from "./components/MenuCategorySections.jsx";
import MenuLoadingState from "./components/MenuLoadingState.jsx";
import { buildMenuProductGroups, getMenuCategoryAnchorKey } from "./menuGrouping.js";
import { buildPromotionOffersForChannel } from "../../services/qrOfferService.js";
import MenuPromoRail from "./components/MenuPromoRail.jsx";
import { normalizeSearchText } from "./menuSearch.js";

export default function Menu({
  storefront = false,
  storefrontActive = true,
  activeCategory,
  setActiveCategory,
  categories,
  isMenuLoading = false,
  products,
  smartPromotions = [],
  checkoutPreset = {},
  openProduct,
  openOptionModal,
  cart = [],
  setCart
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const categorySectionRefs = useRef(new Map());
  const categoryChipRefs = useRef(new Map());
  const categoryRailRef = useRef(null);
  const stickyToolsRef = useRef(null);
  const catalogTopRef = useRef(null);
  const initialCategoryScrollHandledRef = useRef(false);
  const syncedCategoryKeyRef = useRef(getMenuCategoryAnchorKey(activeCategory));
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

  const displayCategories = useMemo(() => {
    return sortCustomerMenuCategories(categories);
  }, [categories]);

  const displayProducts = useMemo(() => {
    const keyword = normalizeSearchText(deferredSearchTerm.trim());
    const sourceProducts = (Array.isArray(products) ? products : []).filter((product) => product?.visible !== false);

    return sourceProducts.filter((product) => {
      const name = normalizeSearchText(product?.name);
      const short = normalizeSearchText(product?.short || product?.description);
      const category = normalizeSearchText(product?.category);
      const badge = normalizeSearchText(product?.badge);
      return !keyword || [name, short, category, badge].some((value) => value.includes(keyword));
    });
  }, [deferredSearchTerm, products]);

  const promoRailItems = useMemo(() => {
    const menuChannel = isQrCounterMenu ? "qr" : "web";
    const availableProducts = (Array.isArray(products) ? products : []).filter(
      (product) => product?.visible !== false && product?.active !== false
    );
    const promotionOffers = buildPromotionOffersForChannel({
      smartPromotions,
      products: availableProducts,
      channel: menuChannel
    }).filter(
      (offer) => Number(offer?.originalPrice || 0) > Number(offer?.currentPrice || 0)
    );

    const seenProductIds = new Set();
    const promotionItems = promotionOffers
      .map((offer) => {
        const product = availableProducts.find(
          (item) => String(item?.id || "") === String(offer?.productId || "")
        );
        if (!product) return null;
        if (seenProductIds.has(product.id)) return null;
        seenProductIds.add(product.id);
        return { id: `${offer.id}-${product.id}`, offer, product };
      })
      .filter(Boolean);

    const pricedSaleItems = availableProducts
      .filter((product) => {
        const currentPrice = Number(product?.price || 0);
        const originalPrice = Number(product?.originalPrice || 0);
        return originalPrice > currentPrice && currentPrice > 0;
      })
      .map((product) => {
        if (seenProductIds.has(product.id)) return null;
        seenProductIds.add(product.id);
        return {
          id: `menu-sale-${product.id}`,
          product,
          offer: {
            eyebrow: product?.flashPromoId ? "Flash Sale" : "Đang giảm",
            detail: "Giá ưu đãi đang áp dụng",
            currentPrice: Number(product.price || 0),
            originalPrice: Number(product.originalPrice || 0)
          }
        };
      })
      .filter(Boolean);

    return [...promotionItems, ...pricedSaleItems].slice(0, 8);
  }, [isQrCounterMenu, products, smartPromotions]);

  const promotionCategory = promoRailItems.some((item) => item.offer.source === "flash_sale" || item.product.flashPromoId) ? "Flash sale" : "Ưu đãi hôm nay";
  const productGroups = useMemo(() => {
    const groups = buildMenuProductGroups(displayCategories, displayProducts);
    return storefront && promoRailItems.length ? [{ key: getMenuCategoryAnchorKey(promotionCategory), category: promotionCategory, products: promoRailItems.map((item) => item.product), promoItems: promoRailItems }, ...groups] : groups;
  }, [displayCategories, displayProducts, storefront, promoRailItems, promotionCategory]);
  const navigationCategories = storefront && promoRailItems.length
    ? [promotionCategory, ...displayCategories.filter((category) => !isAllMenuCategory(category))]
    : displayCategories;

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

  const registerCategoryRef = useCallback((category, node) => {
    const key = getMenuCategoryAnchorKey(category);
    if (node) categorySectionRefs.current.set(key, node);
    else categorySectionRefs.current.delete(key);
  }, []);

  const registerCategoryChipRef = useCallback((category, node) => {
    const key = getMenuCategoryAnchorKey(category);
    if (node) categoryChipRefs.current.set(key, node);
    else categoryChipRefs.current.delete(key);
  }, []);

  const scrollCategoryChipIntoView = useCallback((category, behavior = "smooth") => {
    const rail = categoryRailRef.current;
    const chip = categoryChipRefs.current.get(getMenuCategoryAnchorKey(category));
    if (!rail || !chip) return;

    if (storefront) {
      const top = chip.offsetTop - rail.offsetTop - (rail.clientHeight - chip.offsetHeight) / 2;
      rail.scrollTo({ top: Math.max(0, top), behavior });
      return;
    }
    const centeredLeft = chip.offsetLeft - ((rail.clientWidth - chip.offsetWidth) / 2);
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    rail.scrollTo({
      left: Math.min(Math.max(0, centeredLeft), maxLeft),
      behavior
    });
  }, [storefront]);

  const scrollToCategory = useCallback((category, behavior = "smooth") => {
    const target = isAllMenuCategory(category)
      ? catalogTopRef.current
      : categorySectionRefs.current.get(getMenuCategoryAnchorKey(category));
    if (!target) return;
    const stickyBottom = storefront ? Math.max(0,Math.round(document.querySelector(".customer-install-banner")?.getBoundingClientRect().bottom || 0)) : Math.round(stickyToolsRef.current?.getBoundingClientRect().bottom || 98);
    const stickyOffset = stickyBottom + 8;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior });
  }, [storefront]);

  const handleCategorySelect = (category) => {
    setSearchTerm("");
    syncedCategoryKeyRef.current = getMenuCategoryAnchorKey(category);
    setActiveCategory(category);
    scrollCategoryChipIntoView(category);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToCategory(category));
    });
  };

  useEffect(() => {
    if (!storefrontActive || initialCategoryScrollHandledRef.current || !productGroups.length) return undefined;
    initialCategoryScrollHandledRef.current = true;
    if (isAllMenuCategory(activeCategory)) return undefined;
    const frame = window.requestAnimationFrame(() => scrollToCategory(activeCategory, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [activeCategory, productGroups.length, scrollToCategory, storefrontActive]);

  useEffect(() => {
    syncedCategoryKeyRef.current = getMenuCategoryAnchorKey(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!storefrontActive) return undefined;
    let animationFrame = 0;
    const syncCategoryFromScroll = () => {
      animationFrame = 0;
      const stickyTools = stickyToolsRef.current;
      const installBanner = document.querySelector(".customer-install-banner");
      const stickyTop = Math.max(0, Math.round(installBanner?.getBoundingClientRect().bottom || 0));
      stickyTools?.style.setProperty("--menu-sticky-top", `${stickyTop}px`);

      if (!productGroups.length || searchTerm) return;
      const activationLine = Math.round(stickyTools?.getBoundingClientRect().bottom || 112) + 12;
      let nextCategory = storefront ? productGroups[0]?.category : displayCategories.find(isAllMenuCategory) || displayCategories[0] || productGroups[0]?.category;

      for (const group of productGroups) {
        const section = categorySectionRefs.current.get(getMenuCategoryAnchorKey(group.category));
        if (!section || section.getBoundingClientRect().top > activationLine) break;
        nextCategory = group.category;
      }

      // The last section may be too short to reach the sticky activation line.
      // Keep its category selected when scrolling has reached the page end.
      const atPageEnd = window.scrollY > 0 &&
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
      if (atPageEnd) nextCategory = productGroups[productGroups.length - 1]?.category || nextCategory;

      const nextKey = getMenuCategoryAnchorKey(nextCategory);
      if (syncedCategoryKeyRef.current === nextKey) return;
      syncedCategoryKeyRef.current = nextKey;
      setActiveCategory(nextCategory);
      scrollCategoryChipIntoView(nextCategory);
    };

    const scheduleSync = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(syncCategoryFromScroll);
    };

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [displayCategories, productGroups, scrollCategoryChipIntoView, searchTerm, setActiveCategory, storefrontActive, storefront]);

  const categoryNavigation = (
    <nav className="menu-side-categories" aria-label="Danh mục món">
      <div ref={categoryRailRef} className="menu-side-categories__scroll">
        {navigationCategories.map((category) => (
          <CustomerControl key={category} ref={(node) => registerCategoryChipRef(category, node)} type="button" onClick={() => handleCategorySelect(category)} aria-pressed={activeCategory === category && !searchTerm}>{category}</CustomerControl>
        ))}
      </div>
    </nav>
  );

  const fixedMenuTools = (
    <div ref={stickyToolsRef} className={`menu-sticky-tools ${storefront ? "menu-sticky-tools--storefront" : "menu-sticky-tools--fixed"}`}>
      {!storefront && <div className="menu-search">
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
          <CustomerControl type="button" onClick={() => setSearchTerm("")} className="menu-search-clear" aria-label="Xóa tìm kiếm">
            ×
          </CustomerControl>
        ) : null}
      </div>}

      {!storefront && <nav className="menu-chip-row-wrap" aria-label="Danh mục món">
        <div ref={categoryRailRef} className="no-scrollbar menu-chip-row">
          {displayCategories.map((category) => (
            <CustomerControl
              key={category}
              ref={(node) => registerCategoryChipRef(category, node)}
              type="button"
              onClick={() => handleCategorySelect(category)}
              className={`chip ${activeCategory === category && !searchTerm ? "chip-active" : ""} ${isAllMenuCategory(category) ? "chip-pinned-all" : ""}`}
              aria-pressed={activeCategory === category && !searchTerm}
            >
              {category}
            </CustomerControl>
          ))}
        </div>
      </nav>}
    </div>
  );

  return (
    <section className={`menu-page ${storefront ? "menu-page--storefront" : ""}`}>
      {storefront || typeof document === "undefined" ? fixedMenuTools : createPortal(fixedMenuTools, document.body)}
      <div className="menu-page-content space-y-4 px-4 pb-32">
        {!storefront && <div className="menu-sticky-tools-spacer" aria-hidden="true" />}

        <div ref={catalogTopRef} className="menu-catalog-anchor" aria-hidden="true" />

        {!storefront && !searchTerm ? (
          <MenuPromoRail
            items={promoRailItems}
            onOpen={openProduct}
          />
        ) : null}

        {!isQrCounterMenu ? (
          <div className="menu-result-row" role="status" aria-live="polite">
            <span>{displayProducts.length} món</span>
            {searchTerm ? <strong>Đang tìm “{searchTerm}” trong toàn bộ menu</strong> : <strong>{productGroups.length} danh mục</strong>}
          </div>
        ) : null}

        <div className={storefront ? "menu-catalog-columns" : undefined}>
        {storefront && categoryNavigation}
        <div className="menu-catalog-products">
        {isMenuLoading ? (
          <MenuLoadingState />
        ) : displayProducts.length ? (
          searchTerm ? (
            <div className="menu-product-list menu-product-list--search">
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
            <MenuCategorySections
              groups={productGroups}
              registerCategoryRef={registerCategoryRef}
              selectedCounts={cartProductCount}
              onRemove={removeOneByKey}
              onOpenProduct={openProduct}
              onAddProduct={openOptionModal}
            />
          )
        ) : (
          <div className="menu-empty-state">
            <strong>Chưa có món phù hợp</strong>
            <span>Thử đổi danh mục hoặc tìm bằng tên món khác.</span>
          </div>
        )}
        </div>
        </div>
      </div>
    </section>
  );
}
