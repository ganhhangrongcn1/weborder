import { useEffect, useMemo, useState } from "react";
import {
  calcPreviewPrice as calcPreviewPriceBase,
  normalizeFlashPromo as normalizeFlashPromoBase,
  normalizeStrikePromo as normalizeStrikePromoBase,
  toIdList
} from "./promotionTabUtils.js";
import { promoDefaults } from "./promotionConfig.js";

const normalizeStrikePromo = (promo) => normalizeStrikePromoBase(promo, promoDefaults.strike_price);
const calcPreviewPrice = (promo, sampleOriginal = 35000) => calcPreviewPriceBase(promo, promoDefaults.strike_price, sampleOriginal);
const normalizeFlashPromo = (promo) => normalizeFlashPromoBase(promo, promoDefaults.flash_sale);

export default function usePromotionTabsState({
  products,
  smartPromotions,
  setSmartPromotions,
  normalizeSmartPromotion,
  initialTab = "coupon"
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedStrikePromoId, setSelectedStrikePromoId] = useState("");
  const [selectedFlashPromoId, setSelectedFlashPromoId] = useState("");
  const [selectedGiftPromoId, setSelectedGiftPromoId] = useState("");
  const [selectedFreeShippingPromoId, setSelectedFreeShippingPromoId] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab]);

  const activeProducts = useMemo(() => products.filter((item) => item.visible !== false), [products]);
  const activeCategories = useMemo(
    () => Array.from(new Set(activeProducts.map((item) => String(item.category || "").trim()).filter(Boolean))),
    [activeProducts]
  );

  const updatePromotion = (id, patch) => {
    setSmartPromotions(smartPromotions.map((item) => (item.id === id ? normalizeSmartPromotion({ ...item, ...patch }) : item)));
  };

  const createPromotion = (type, overrides = {}) => {
    const defaults = promoDefaults[type];
    if (!defaults) return null;
    const created = normalizeSmartPromotion({
      id: `promo-${type}-${Date.now()}`,
      type,
      ...defaults,
      ...overrides,
      condition: {
        ...defaults.condition,
        ...(overrides.condition || {})
      },
      reward: {
        ...defaults.reward,
        productId: type === "gift_threshold" ? activeProducts[0]?.id || "" : defaults.reward.productId || "",
        ...(overrides.reward || {})
      }
    });
    const nextPromotions = type === "free_shipping" && created.active
      ? [created, ...smartPromotions.map((item) => item.type === "free_shipping" ? normalizeSmartPromotion({ ...item, active: false }) : item)]
      : [created, ...smartPromotions];
    setSmartPromotions(nextPromotions);
    if (type === "strike_price") {
      setSelectedStrikePromoId(created.id);
    }
    if (type === "flash_sale") {
      setSelectedFlashPromoId(created.id);
    }
    if (type === "gift_threshold") {
      setSelectedGiftPromoId(created.id);
    }
    if (type === "free_shipping") {
      setSelectedFreeShippingPromoId(created.id);
    }
    setActiveTab(type);
    return created;
  };

  const strikePromos = useMemo(
    () => smartPromotions.filter((item) => item.type === "strike_price").map((item) => normalizeStrikePromo(item)).sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)),
    [smartPromotions]
  );

  useEffect(() => {
    if (!strikePromos.length) {
      setSelectedStrikePromoId("");
      return;
    }
    if (!selectedStrikePromoId || !strikePromos.some((item) => item.id === selectedStrikePromoId)) {
      setSelectedStrikePromoId(strikePromos[0].id);
    }
  }, [strikePromos, selectedStrikePromoId]);

  const selectedStrikePromo = strikePromos.find((item) => item.id === selectedStrikePromoId) || strikePromos[0] || null;
  const previewProduct = useMemo(() => {
    if (!selectedStrikePromo) return null;
    const scope = selectedStrikePromo.condition?.applyScope || "all";
    if (scope === "product") {
      const productIds = toIdList(selectedStrikePromo.condition?.productIds);
      return activeProducts.find((product) => productIds.includes(String(product.id || ""))) || null;
    }
    if (scope === "category") {
      const categoryIds = toIdList(selectedStrikePromo.condition?.categoryIds);
      return activeProducts.find((product) => categoryIds.includes(String(product.category || ""))) || null;
    }
    return activeProducts[0] || null;
  }, [activeProducts, selectedStrikePromo]);
  const previewPrice = Number(previewProduct?.price || 0);
  const preview = selectedStrikePromo
    ? calcPreviewPrice(selectedStrikePromo, previewPrice > 0 ? previewPrice : 35000)
    : null;

  const flashSalePromos = useMemo(
    () => smartPromotions
      .filter((item) => item.type === "flash_sale")
      .map((item) => normalizeFlashPromo(item))
      .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)),
    [smartPromotions]
  );

  const selectedFlashPromo = flashSalePromos.find((item) => item.id === selectedFlashPromoId) || flashSalePromos[0] || null;
  const giftPromos = useMemo(
    () => smartPromotions.filter((item) => item.type === "gift_threshold").sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)),
    [smartPromotions]
  );
  const freeShippingPromos = useMemo(
    () => smartPromotions.filter((item) => item.type === "free_shipping").sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)),
    [smartPromotions]
  );
  const giftPromo = giftPromos.find((item) => item.id === selectedGiftPromoId) || giftPromos[0] || null;
  const freeShippingPromo = freeShippingPromos.find((item) => item.id === selectedFreeShippingPromoId) || freeShippingPromos[0] || null;

  useEffect(() => {
    if (!flashSalePromos.length) {
      setSelectedFlashPromoId("");
      return;
    }
    if (!selectedFlashPromoId || !flashSalePromos.some((item) => item.id === selectedFlashPromoId)) {
      setSelectedFlashPromoId(flashSalePromos[0].id);
    }
  }, [flashSalePromos, selectedFlashPromoId]);

  useEffect(() => {
    if (!giftPromos.length) {
      setSelectedGiftPromoId("");
      return;
    }
    if (!selectedGiftPromoId || !giftPromos.some((item) => item.id === selectedGiftPromoId)) {
      setSelectedGiftPromoId(giftPromos[0].id);
    }
  }, [giftPromos, selectedGiftPromoId]);

  useEffect(() => {
    if (!freeShippingPromos.length) {
      setSelectedFreeShippingPromoId("");
      return;
    }
    if (!selectedFreeShippingPromoId || !freeShippingPromos.some((item) => item.id === selectedFreeShippingPromoId)) {
      setSelectedFreeShippingPromoId(freeShippingPromos[0].id);
    }
  }, [freeShippingPromos, selectedFreeShippingPromoId]);

  const setExclusiveFreeShippingActive = (id, active) => {
    setSmartPromotions(smartPromotions.map((item) => {
      if (item.type !== "free_shipping") return item;
      const nextActive = item.id === id ? active : active ? false : item.active;
      return normalizeSmartPromotion({ ...item, active: nextActive });
    }));
  };

  useEffect(() => {
    if (activeTab !== "flash_sale") return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    nowTick,
    activeProducts,
    activeCategories,
    updatePromotion,
    createPromotion,
    strikePromos,
    selectedStrikePromo,
    setSelectedStrikePromoId,
    preview,
    flashSalePromos,
    selectedFlashPromo,
    setSelectedFlashPromoId,
    giftPromos,
    selectedGiftPromoId,
    setSelectedGiftPromoId,
    freeShippingPromos,
    selectedFreeShippingPromoId,
    setSelectedFreeShippingPromoId,
    setExclusiveFreeShippingActive,
    freeShippingPromo,
    giftPromo
  };
}
