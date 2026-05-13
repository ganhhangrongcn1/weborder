import { useEffect, useMemo, useState } from "react";
import {
  calcPreviewPrice as calcPreviewPriceBase,
  normalizeFlashPromo as normalizeFlashPromoBase,
  normalizeStrikePromo as normalizeStrikePromoBase
} from "./promotionTabUtils.js";
import { promoDefaults } from "./promotionConfig.js";

const normalizeStrikePromo = (promo) => normalizeStrikePromoBase(promo, promoDefaults.strike_price);
const calcPreviewPrice = (promo, sampleOriginal = 35000) => calcPreviewPriceBase(promo, promoDefaults.strike_price, sampleOriginal);
const normalizeFlashPromo = (promo) => normalizeFlashPromoBase(promo, promoDefaults.flash_sale);

export default function usePromotionTabsState({
  products,
  smartPromotions,
  setSmartPromotions,
  normalizeSmartPromotion
}) {
  const [activeTab, setActiveTab] = useState("coupon");
  const [selectedStrikePromoId, setSelectedStrikePromoId] = useState("");
  const [selectedFlashPromoId, setSelectedFlashPromoId] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const activeProducts = useMemo(() => products.filter((item) => item.visible !== false), [products]);
  const activeCategories = useMemo(
    () => Array.from(new Set(activeProducts.map((item) => String(item.category || "").trim()).filter(Boolean))),
    [activeProducts]
  );

  const updatePromotion = (id, patch) => {
    setSmartPromotions(smartPromotions.map((item) => (item.id === id ? normalizeSmartPromotion({ ...item, ...patch }) : item)));
  };

  const getPromotionByType = (type) => smartPromotions.find((item) => item.type === type);

  const createPromotion = (type) => {
    const defaults = promoDefaults[type];
    if (!defaults) return;
    const created = normalizeSmartPromotion({
      id: `promo-${type}-${Date.now()}`,
      type,
      ...defaults,
      reward: {
        ...defaults.reward,
        productId: type === "gift_threshold" ? activeProducts[0]?.id || "" : defaults.reward.productId || ""
      }
    });
    setSmartPromotions([created, ...smartPromotions]);
    if (type === "strike_price") {
      setSelectedStrikePromoId(created.id);
      setActiveTab("strike_price");
      return;
    }
    if (type === "flash_sale") {
      setSelectedFlashPromoId(created.id);
      setActiveTab("flash_sale");
      return;
    }
    if (type === "free_shipping") {
      setActiveTab("free_shipping");
    }
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
  const preview = selectedStrikePromo ? calcPreviewPrice(selectedStrikePromo, 35000) : null;

  const flashSalePromos = useMemo(
    () => smartPromotions
      .filter((item) => item.type === "flash_sale")
      .map((item) => normalizeFlashPromo(item))
      .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)),
    [smartPromotions]
  );

  const selectedFlashPromo = flashSalePromos.find((item) => item.id === selectedFlashPromoId) || flashSalePromos[0] || null;
  const freeShippingPromo = smartPromotions.find((item) => item.type === "free_shipping") || null;
  const giftPromo = getPromotionByType("gift_threshold");

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
    freeShippingPromo,
    giftPromo
  };
}
