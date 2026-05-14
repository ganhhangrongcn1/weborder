import { useEffect, useMemo, useState } from "react";
import { defaultBranches, defaultCampaigns, defaultHomeBanners, defaultStoreHours } from "../data/storeDefaults.js";
import {
  catalogConfigRepository,
  CATALOG_CONFIG_KEYS,
  INITIAL_CATALOG_CONFIG_KEYS
} from "../services/repositories/catalogConfigRepository.js";
import { subscribeCatalogRealtime } from "../services/repositories/catalogSupabaseRepository.js";
import { adminConfigRepository } from "../services/repositories/adminConfigRepository.js";
import { getDataSource } from "../services/repositories/dataSource.js";
import { initSupabaseRuntimeClient } from "../services/supabase/supabaseRuntimeClient.js";
import {
  isMenuSchemaBridgeMigrationEnabled,
  isSupabaseConfigSyncEnabled,
  isSupabaseSeedMigrationEnabled,
  isSupabaseStrictModeEnabled
} from "../services/supabase/runtimeFlags.js";
import {
  legacyCategoriesFromMenuSchema,
  legacyProductsFromMenuSchema,
  legacyToppingsFromMenuSchema,
  loadMenuSchema,
  saveMenuSchemaFromLegacy
} from "../services/menuSchemaService.js";

function parseIdCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isDateInRange(startAt, endAt, now = new Date()) {
  const startDate = startAt ? new Date(`${startAt}T00:00:00`) : null;
  const endDate = endAt ? new Date(`${endAt}T23:59:59`) : null;
  if (startDate && !Number.isNaN(startDate.getTime()) && now.getTime() < startDate.getTime()) return false;
  if (endDate && !Number.isNaN(endDate.getTime()) && now.getTime() > endDate.getTime()) return false;
  return true;
}

function parseTimeToMinutes(value) {
  const parts = String(value || "").split(":");
  if (parts.length < 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function isTimeWindowActive(promotion, now = new Date()) {
  const useTimeWindow = Boolean(promotion?.condition?.useTimeWindow);
  if (!useTimeWindow) return true;
  const startMinutes = parseTimeToMinutes(promotion?.condition?.startTime);
  const endMinutes = parseTimeToMinutes(promotion?.condition?.endTime);
  if (startMinutes === null || endMinutes === null) return true;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes <= endMinutes) return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function applyRoundMode(value, mode) {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

function normalizeHomeContent(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return Array.isArray(fallback) ? fallback : [];

  // Backward compatibility: recover from accidentally saved object-shaped payloads.
  if (Array.isArray(value.items)) return value.items;
  const objectValues = Object.values(value).filter((item) => item && typeof item === "object");
  if (objectValues.length) return objectValues;

  return Array.isArray(fallback) ? fallback : [];
}

function normalizeHours(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return { ...fallback, ...value };
}

function canApplyToProduct(promotion, product) {
  const scope = promotion?.condition?.applyScope || "all";
  if (scope === "all") return true;
  if (scope === "category") {
    const categoryIds = parseIdCsv(promotion?.condition?.categoryIds);
    return categoryIds.includes(String(product?.category || ""));
  }
  if (scope === "product") {
    const productIds = parseIdCsv(promotion?.condition?.productIds);
    return productIds.includes(String(product?.id || ""));
  }
  return true;
}

function calcFinalStrikePrice(productPrice, promotion) {
  const rewardType = promotion?.reward?.type;
  const rewardValue = Number(promotion?.reward?.value || 0);
  const minFinalPrice = Number(promotion?.condition?.minFinalPrice || 0);
  const minDiscountToShow = Number(promotion?.condition?.minDiscountToShow || 0);

  const discountValue = rewardType === "percent_discount"
    ? (productPrice * rewardValue) / 100
    : rewardValue;
  const rawFinalPrice = Math.max(productPrice - discountValue, 0);
  const roundedFinalPrice = Math.max(applyRoundMode(rawFinalPrice, promotion?.reward?.roundMode), 0);
  const finalPrice = Math.max(roundedFinalPrice, minFinalPrice);
  const percentDiscount = productPrice > 0 ? ((productPrice - finalPrice) / productPrice) * 100 : 0;

  if (finalPrice >= productPrice) return null;
  if (percentDiscount < minDiscountToShow) return null;

  return {
    finalPrice,
    originalPrice: productPrice,
    discountPercent: Math.round(percentDiscount),
    discountValue: productPrice - finalPrice
  };
}

function resolveMenuRuntimeValue(catalogValue, schemaValue, seedValue) {
  if (Array.isArray(catalogValue) && catalogValue.length) return catalogValue;
  return seedValue;
}

function resolveStrictCatalogFallback(key, fallback, strictMode) {
  if (!strictMode) return fallback;
  if (key === CATALOG_CONFIG_KEYS.hours) return {};
  return [];
}

function getRouteLazyKeys(pathname = "/") {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/checkout") || path.startsWith("/cart")) {
    return [CATALOG_CONFIG_KEYS.coupons, CATALOG_CONFIG_KEYS.zones];
  }
  if (path.startsWith("/admin")) {
    return [CATALOG_CONFIG_KEYS.coupons, CATALOG_CONFIG_KEYS.zones, CATALOG_CONFIG_KEYS.campaigns];
  }
  return [];
}

function getActiveRealtimeKeys(currentPage, pathname = "/") {
  const page = String(currentPage || "").toLowerCase();
  const path = String(pathname || "").toLowerCase();
  if (page === "menu") {
    return [
      CATALOG_CONFIG_KEYS.products,
      CATALOG_CONFIG_KEYS.categories,
      CATALOG_CONFIG_KEYS.toppings
    ];
  }
  if (page !== "admin") return [];
  if (path.includes("/admin/menu")) {
    return [
      CATALOG_CONFIG_KEYS.products,
      CATALOG_CONFIG_KEYS.categories,
      CATALOG_CONFIG_KEYS.toppings
    ];
  }
  if (path.includes("/admin/promo")) {
    return [
      CATALOG_CONFIG_KEYS.promos,
      CATALOG_CONFIG_KEYS.smartPromotions,
      CATALOG_CONFIG_KEYS.coupons,
      CATALOG_CONFIG_KEYS.campaigns,
      CATALOG_CONFIG_KEYS.banners,
      CATALOG_CONFIG_KEYS.homeContent
    ];
  }
  if (path.includes("/admin/store")) {
    return [
      CATALOG_CONFIG_KEYS.branches,
      CATALOG_CONFIG_KEYS.zones,
      CATALOG_CONFIG_KEYS.homeContent,
      CATALOG_CONFIG_KEYS.banners
    ];
  }
  return [];
}

export default function useProductList({
  productSeed,
  toppingSeed,
  promoSeed,
  defaultHomeContent,
  defaultSmartPromotions,
  categories,
  defaultDeliveryZones,
  normalizeSmartPromotion,
  buildHomePromoCards,
  activeCategory,
  currentPage
}) {
  const menuSchema = loadMenuSchema();
  const schemaProducts = legacyProductsFromMenuSchema(menuSchema);
  const schemaToppings = legacyToppingsFromMenuSchema(menuSchema);
  const schemaCategories = legacyCategoriesFromMenuSchema(menuSchema);
  const isSupabaseMode = getDataSource() === "supabase";
  const isStrictSupabaseMode = isSupabaseMode && isSupabaseStrictModeEnabled();
  const canRunSchemaBridge = !isSupabaseMode || isMenuSchemaBridgeMigrationEnabled() || isSupabaseSeedMigrationEnabled();

  useEffect(() => {
    if (!canRunSchemaBridge) return;
    const hasLocalProducts = Array.isArray(adminConfigRepository.getLocal(CATALOG_CONFIG_KEYS.products, null));
    const hasLocalToppings = Array.isArray(adminConfigRepository.getLocal(CATALOG_CONFIG_KEYS.toppings, null));
    const hasLocalCategories = Array.isArray(adminConfigRepository.getLocal(CATALOG_CONFIG_KEYS.categories, null));

    if (!hasLocalProducts && schemaProducts.length) {
      catalogConfigRepository.set(CATALOG_CONFIG_KEYS.products, schemaProducts);
    }
    if (!hasLocalToppings && schemaToppings.length) {
      catalogConfigRepository.set(CATALOG_CONFIG_KEYS.toppings, schemaToppings);
    }
    if (!hasLocalCategories && schemaCategories.length) {
      catalogConfigRepository.set(CATALOG_CONFIG_KEYS.categories, schemaCategories);
    }
  }, [canRunSchemaBridge, schemaProducts, schemaToppings, schemaCategories]);

  const [storeProducts, setStoreProducts] = useState(() =>
    resolveMenuRuntimeValue(
      catalogConfigRepository.get(
        CATALOG_CONFIG_KEYS.products,
        resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.products, productSeed, isStrictSupabaseMode)
      ),
      schemaProducts,
      resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.products, productSeed, isStrictSupabaseMode)
    )
  );
  const [storeToppings, setStoreToppings] = useState(() =>
    resolveMenuRuntimeValue(
      catalogConfigRepository.get(
        CATALOG_CONFIG_KEYS.toppings,
        resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.toppings, toppingSeed, isStrictSupabaseMode)
      ),
      schemaToppings,
      resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.toppings, toppingSeed, isStrictSupabaseMode)
    )
  );
  const [storePromos, setStorePromos] = useState(() =>
    catalogConfigRepository.get(CATALOG_CONFIG_KEYS.promos, resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.promos, promoSeed, isStrictSupabaseMode))
  );
  const [homeContent, setHomeContent] = useState(() =>
    catalogConfigRepository.get(
      CATALOG_CONFIG_KEYS.homeContent,
      resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.homeContent, defaultHomeContent, isStrictSupabaseMode)
    )
  );
  const [homeBanners, setHomeBanners] = useState(() =>
    catalogConfigRepository.get(
      CATALOG_CONFIG_KEYS.banners,
      resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.banners, defaultHomeBanners, isStrictSupabaseMode)
    )
  );
  const [adminCoupons, setAdminCoupons] = useState(() =>
    catalogConfigRepository.get(CATALOG_CONFIG_KEYS.coupons, resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.coupons, [], isStrictSupabaseMode))
  );
  const [smartPromotions, setSmartPromotions] = useState(() =>
    catalogConfigRepository
      .get(
        CATALOG_CONFIG_KEYS.smartPromotions,
        resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.smartPromotions, defaultSmartPromotions, isStrictSupabaseMode)
      )
      .map(normalizeSmartPromotion)
  );
  const [campaigns, setCampaigns] = useState(() => resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.campaigns, defaultCampaigns, isStrictSupabaseMode));
  const [branches, setBranches] = useState(() =>
    catalogConfigRepository.get(CATALOG_CONFIG_KEYS.branches, resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.branches, defaultBranches, isStrictSupabaseMode))
  );
  const [hours, setHours] = useState(() =>
    catalogConfigRepository.get(CATALOG_CONFIG_KEYS.hours, resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.hours, defaultStoreHours, isStrictSupabaseMode))
  );
  const [deliveryZones, setDeliveryZones] = useState(() => resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.zones, defaultDeliveryZones, isStrictSupabaseMode));
  const [adminCategories, setAdminCategories] = useState(() =>
    resolveMenuRuntimeValue(
      catalogConfigRepository.get(
        CATALOG_CONFIG_KEYS.categories,
        resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.categories, categories, isStrictSupabaseMode)
      ),
      schemaCategories,
      resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.categories, categories, isStrictSupabaseMode)
    )
  );
  const [lazyLoadedKeys, setLazyLoadedKeys] = useState(() => new Set());
  const supabaseConfigSyncEnabled = isSupabaseConfigSyncEnabled();
  const shouldForceSupabaseCatalogRead = getDataSource() === "supabase";

  useEffect(() => {
    if (!supabaseConfigSyncEnabled && !shouldForceSupabaseCatalogRead) return;
    let disposed = false;

    catalogConfigRepository
      .getManyAsync([
        { key: CATALOG_CONFIG_KEYS.products, fallback: productSeed },
        { key: CATALOG_CONFIG_KEYS.toppings, fallback: toppingSeed },
        { key: CATALOG_CONFIG_KEYS.promos, fallback: promoSeed },
        { key: CATALOG_CONFIG_KEYS.homeContent, fallback: defaultHomeContent },
        { key: CATALOG_CONFIG_KEYS.banners, fallback: defaultHomeBanners },
        { key: CATALOG_CONFIG_KEYS.smartPromotions, fallback: defaultSmartPromotions },
        { key: CATALOG_CONFIG_KEYS.branches, fallback: defaultBranches },
        { key: CATALOG_CONFIG_KEYS.hours, fallback: defaultStoreHours },
        { key: CATALOG_CONFIG_KEYS.categories, fallback: categories }
      ].map((entry) => ({
        ...entry,
        fallback: resolveStrictCatalogFallback(entry.key, entry.fallback, isStrictSupabaseMode)
      })).filter(({ key }) => INITIAL_CATALOG_CONFIG_KEYS.includes(key)))
      .then((remoteValues) => {
        if (disposed) return;
        const remoteProducts = remoteValues[CATALOG_CONFIG_KEYS.products];
        const remoteToppings = remoteValues[CATALOG_CONFIG_KEYS.toppings];
        const remotePromos = remoteValues[CATALOG_CONFIG_KEYS.promos];
        const remoteHomeContent = remoteValues[CATALOG_CONFIG_KEYS.homeContent];
        const remoteBanners = remoteValues[CATALOG_CONFIG_KEYS.banners];
        const remoteSmartPromotions = remoteValues[CATALOG_CONFIG_KEYS.smartPromotions];
        const remoteBranches = remoteValues[CATALOG_CONFIG_KEYS.branches];
        const remoteHours = remoteValues[CATALOG_CONFIG_KEYS.hours];
        const remoteCategories = remoteValues[CATALOG_CONFIG_KEYS.categories];
        if (Array.isArray(remoteProducts)) setStoreProducts(remoteProducts);
        if (Array.isArray(remoteToppings)) setStoreToppings(remoteToppings);
        if (Array.isArray(remotePromos)) setStorePromos(remotePromos);
        if (remoteHomeContent && typeof remoteHomeContent === "object") {
          setHomeContent(normalizeHomeContent(remoteHomeContent, defaultHomeContent));
        }
        if (Array.isArray(remoteBanners)) setHomeBanners(remoteBanners);
        if (Array.isArray(remoteSmartPromotions)) setSmartPromotions(remoteSmartPromotions.map(normalizeSmartPromotion));
        if (Array.isArray(remoteBranches)) setBranches(remoteBranches);
        if (remoteHours && typeof remoteHours === "object") {
          setHours(normalizeHours(remoteHours, defaultStoreHours));
        }
        if (Array.isArray(remoteCategories)) setAdminCategories(remoteCategories);
      })
      .catch(() => {});

    return () => {
      disposed = true;
    };
  }, [
    supabaseConfigSyncEnabled,
    shouldForceSupabaseCatalogRead,
    productSeed,
    toppingSeed,
    promoSeed,
    defaultHomeContent,
    defaultSmartPromotions,
    categories,
    normalizeSmartPromotion
    ,
    isStrictSupabaseMode
  ]);

  useEffect(() => {
    if (!supabaseConfigSyncEnabled && !shouldForceSupabaseCatalogRead) return undefined;
    let disposed = false;
    let timerId = null;

    const hydrateFromStandardTables = async () => {
      await initSupabaseRuntimeClient();
      if (disposed) return;
      catalogConfigRepository
        .getManyAsync([
          { key: CATALOG_CONFIG_KEYS.branches, fallback: defaultBranches },
          { key: CATALOG_CONFIG_KEYS.hours, fallback: defaultStoreHours }
        ].map((entry) => ({
          ...entry,
          fallback: resolveStrictCatalogFallback(entry.key, entry.fallback, isStrictSupabaseMode)
        })))
        .then((remoteValues) => {
          if (disposed) return;
          const remoteBranches = remoteValues[CATALOG_CONFIG_KEYS.branches];
          const remoteHours = remoteValues[CATALOG_CONFIG_KEYS.hours];
          if (Array.isArray(remoteBranches)) setBranches(remoteBranches);
          if (remoteHours && typeof remoteHours === "object") {
            setHours(normalizeHours(remoteHours, defaultStoreHours));
          }
        })
        .catch(() => {});
    };

    hydrateFromStandardTables();
    timerId = window.setTimeout(hydrateFromStandardTables, 1500);

    return () => {
      disposed = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [supabaseConfigSyncEnabled, shouldForceSupabaseCatalogRead, defaultBranches, defaultStoreHours, isStrictSupabaseMode]);

  useEffect(() => {
    if (!supabaseConfigSyncEnabled && !shouldForceSupabaseCatalogRead) return undefined;
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const activeKeys = getActiveRealtimeKeys(currentPage, path);
    if (!activeKeys.length) return undefined;

    const handlers = {
      [CATALOG_CONFIG_KEYS.products]: (next) => {
        if (Array.isArray(next)) setStoreProducts(next);
      },
      [CATALOG_CONFIG_KEYS.categories]: (next) => {
        if (Array.isArray(next)) setAdminCategories(next);
      },
      [CATALOG_CONFIG_KEYS.toppings]: (next) => {
        if (Array.isArray(next)) setStoreToppings(next);
      },
      [CATALOG_CONFIG_KEYS.promos]: (next) => {
        if (Array.isArray(next)) setStorePromos(next);
      },
      [CATALOG_CONFIG_KEYS.smartPromotions]: (next) => {
        if (Array.isArray(next)) setSmartPromotions(next.map(normalizeSmartPromotion));
      },
      [CATALOG_CONFIG_KEYS.coupons]: (next) => {
        if (Array.isArray(next)) setAdminCoupons(next);
      },
      [CATALOG_CONFIG_KEYS.campaigns]: (next) => {
        if (Array.isArray(next)) setCampaigns(next);
      },
      [CATALOG_CONFIG_KEYS.homeContent]: (next) => {
        if (next && typeof next === "object") setHomeContent(normalizeHomeContent(next, defaultHomeContent));
      },
      [CATALOG_CONFIG_KEYS.banners]: (next) => {
        if (Array.isArray(next)) setHomeBanners(next);
      },
      [CATALOG_CONFIG_KEYS.branches]: (next) => {
        if (Array.isArray(next)) setBranches(next);
      },
      [CATALOG_CONFIG_KEYS.zones]: (next) => {
        if (Array.isArray(next)) setDeliveryZones(next);
      }
    };

    const unsubscribers = activeKeys.map((key) => subscribeCatalogRealtime(key, handlers[key]));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [currentPage, defaultHomeContent, normalizeSmartPromotion, supabaseConfigSyncEnabled, shouldForceSupabaseCatalogRead]);

  useEffect(() => {
    const syncHomeContentFromStorage = (event) => {
      if (event.key !== CATALOG_CONFIG_KEYS.homeContent) return;
      const nextHomeContent = catalogConfigRepository.get(
        CATALOG_CONFIG_KEYS.homeContent,
        resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.homeContent, defaultHomeContent, isStrictSupabaseMode)
      );
      setHomeContent(normalizeHomeContent(nextHomeContent, defaultHomeContent));
    };

    window.addEventListener("storage", syncHomeContentFromStorage);
    return () => window.removeEventListener("storage", syncHomeContentFromStorage);
  }, [defaultHomeContent, isStrictSupabaseMode]);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const routeKeys = new Set(getRouteLazyKeys(path));
    if (currentPage === "checkout") {
      routeKeys.add(CATALOG_CONFIG_KEYS.coupons);
      routeKeys.add(CATALOG_CONFIG_KEYS.zones);
    }
    if (!routeKeys.size) return;
    const pendingKeys = Array.from(routeKeys).filter((key) => !lazyLoadedKeys.has(key));
    if (!pendingKeys.length) return;

    const nextLoaded = new Set(lazyLoadedKeys);
    pendingKeys.forEach((key) => nextLoaded.add(key));
    setLazyLoadedKeys(nextLoaded);

    pendingKeys.forEach((key) => {
      if (key === CATALOG_CONFIG_KEYS.coupons) {
        const localCoupons = catalogConfigRepository.get(
          CATALOG_CONFIG_KEYS.coupons,
          resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.coupons, [], isStrictSupabaseMode)
        );
        if (Array.isArray(localCoupons)) setAdminCoupons(localCoupons);
        if (supabaseConfigSyncEnabled) {
          catalogConfigRepository
            .getAsync(
              CATALOG_CONFIG_KEYS.coupons,
              resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.coupons, [], isStrictSupabaseMode)
            )
            .then((remoteCoupons) => {
              if (Array.isArray(remoteCoupons)) setAdminCoupons(remoteCoupons);
            })
            .catch(() => {});
        }
      }
      if (key === CATALOG_CONFIG_KEYS.zones) {
        const localZones = catalogConfigRepository.get(
          CATALOG_CONFIG_KEYS.zones,
          resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.zones, defaultDeliveryZones, isStrictSupabaseMode)
        );
        if (Array.isArray(localZones)) setDeliveryZones(localZones);
        if (supabaseConfigSyncEnabled) {
          catalogConfigRepository
            .getAsync(
              CATALOG_CONFIG_KEYS.zones,
              resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.zones, defaultDeliveryZones, isStrictSupabaseMode)
            )
            .then((remoteZones) => {
              if (Array.isArray(remoteZones)) setDeliveryZones(remoteZones);
            })
            .catch(() => {});
        }
      }
      if (key === CATALOG_CONFIG_KEYS.campaigns) {
        const localCampaigns = catalogConfigRepository.get(
          CATALOG_CONFIG_KEYS.campaigns,
          resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.campaigns, defaultCampaigns, isStrictSupabaseMode)
        );
        if (Array.isArray(localCampaigns)) setCampaigns(localCampaigns);
        if (supabaseConfigSyncEnabled) {
          catalogConfigRepository
            .getAsync(
              CATALOG_CONFIG_KEYS.campaigns,
              resolveStrictCatalogFallback(CATALOG_CONFIG_KEYS.campaigns, defaultCampaigns, isStrictSupabaseMode)
            )
            .then((remoteCampaigns) => {
              if (Array.isArray(remoteCampaigns)) setCampaigns(remoteCampaigns);
            })
            .catch(() => {});
        }
      }
    });
  }, [currentPage, lazyLoadedKeys, defaultDeliveryZones, defaultCampaigns, supabaseConfigSyncEnabled, isStrictSupabaseMode]);

  const customerProducts = useMemo(() => {
    const activeStrikePromotions = [...smartPromotions]
      .filter((item) => item?.type === "strike_price" && item?.active !== false)
      .filter((item) => isDateInRange(item?.startAt, item?.endAt))
      .filter((item) => isTimeWindowActive(item))
      .sort((first, second) => Number(first?.priority || 99) - Number(second?.priority || 99));

    if (!activeStrikePromotions.length) {
      return storeProducts.map((product) => ({
        ...product,
        originalPrice: undefined,
        discountPercent: undefined,
        discountValue: undefined
      }));
    }

    return storeProducts.map((product) => {
      const basePrice = Number(product?.price || 0);
      if (basePrice <= 0) return product;

      const matchedPromotion = activeStrikePromotions.find((promotion) => canApplyToProduct(promotion, product));
      if (!matchedPromotion) {
        return {
          ...product,
          originalPrice: undefined,
          discountPercent: undefined,
          discountValue: undefined
        };
      }

      const strikePrice = calcFinalStrikePrice(basePrice, matchedPromotion);
      if (!strikePrice) {
        return {
          ...product,
          originalPrice: undefined,
          discountPercent: undefined,
          discountValue: undefined
        };
      }

      return {
        ...product,
        price: strikePrice.finalPrice,
        originalPrice: strikePrice.originalPrice,
        discountPercent: strikePrice.discountPercent,
        discountValue: strikePrice.discountValue,
        strikePromotionId: matchedPromotion.id
      };
    });
  }, [smartPromotions, storeProducts]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === categories[0]) return customerProducts.filter((product) => product.visible !== false);
    return customerProducts.filter(
      (product) => product.visible !== false && (product.category === activeCategory || product.badge === activeCategory)
    );
  }, [activeCategory, categories, customerProducts]);

  const customerCategories = useMemo(() => {
    const cleanCategories = adminCategories.filter(Boolean);
    return cleanCategories.includes(categories[0]) ? cleanCategories : [categories[0], ...cleanCategories];
  }, [adminCategories, categories]);

  const customerPromoCards = useMemo(
    () => buildHomePromoCards(storePromos, smartPromotions),
    [storePromos, smartPromotions, buildHomePromoCards]
  );

  useEffect(() => {
    // Avoid continuous app_configs writes on customer pages.
    // Bridge sync is only needed while working in menu/admin contexts.
    if (!canRunSchemaBridge) return;
    if (!["menu", "admin"].includes(String(currentPage || "").toLowerCase())) return;
    saveMenuSchemaFromLegacy({
      products: storeProducts,
      categories: adminCategories,
      toppings: storeToppings
    });
  }, [canRunSchemaBridge, currentPage, storeProducts, adminCategories, storeToppings]);

  return {
    storeProducts,
    setStoreProducts,
    storeToppings,
    setStoreToppings,
    storePromos,
    setStorePromos,
    customerProducts,
    homeContent,
    setHomeContent,
    homeBanners,
    setHomeBanners,
    adminCoupons,
    setAdminCoupons,
    smartPromotions,
    setSmartPromotions,
    campaigns,
    setCampaigns,
    branches,
    setBranches,
    hours,
    setHours,
    deliveryZones,
    setDeliveryZones,
    adminCategories,
    setAdminCategories,
    filteredProducts,
    customerCategories,
    customerPromoCards
  };
}
