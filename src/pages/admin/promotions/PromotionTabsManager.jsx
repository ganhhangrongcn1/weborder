import { useEffect, useMemo, useRef, useState } from "react";
import CouponManager from "./CouponManager.jsx";
import { AdminButton, AdminPanel } from "../ui/AdminCommon.jsx";
import StrikePriceTab from "./StrikePriceTab.jsx";
import GiftThresholdTab from "./GiftThresholdTab.jsx";
import FlashSaleTab from "./FlashSaleTab.jsx";
import FreeshipManager from "./FreeshipManager.jsx";
import { promoTabs } from "./promotionConfig.js";
import usePromotionTabsState from "./usePromotionTabsState.js";
import { catalogConfigRepository, syncPromotionCatalogToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { normalizeLoyaltyProgramConfig } from "../../../services/loyaltyProgramConfigService.js";
import { getLoyaltyRuleConfigAsync } from "../../../services/loyaltyService.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isDateBeforeToday(dateText) {
  if (!dateText) return false;
  const date = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function isDateAfterToday(dateText) {
  if (!dateText) return false;
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() > Date.now();
}

function hasDisplayPlace(promotion, place) {
  const places = Array.isArray(promotion?.displayPlaces) ? promotion.displayPlaces : [];
  return !places.length || places.includes(place);
}

function getLifecycleCode(item = {}) {
  if (item.active === false) return "off";
  const endAt = item.endAt || item.expiry || item.expiredAt;
  if (isDateBeforeToday(endAt)) return "expired";
  if (isDateAfterToday(item.startAt)) return "upcoming";
  return "running";
}

function countByLifecycle(items = []) {
  return items.reduce(
    (total, item) => {
      const code = getLifecycleCode(item);
      total[code] += 1;
      return total;
    },
    { running: 0, upcoming: 0, expired: 0, off: 0 }
  );
}

function buildPromotionOverview({ promos, coupons, smartPromotions }) {
  const safePromos = toArray(promos);
  const safeCoupons = toArray(coupons);
  const safeSmartPromotions = toArray(smartPromotions);
  const allPrograms = [...safeCoupons, ...safeSmartPromotions];
  const lifecycle = countByLifecycle(allPrograms);
  const activeCoupons = safeCoupons.filter((coupon) => getLifecycleCode(coupon) === "running");
  const activeSmartPromotions = safeSmartPromotions.filter((promotion) => getLifecycleCode(promotion) === "running");

  return {
    lifecycle,
    totalPrograms: allPrograms.length,
    impactCards: [
      {
        label: "Checkout",
        value: activeCoupons.length + activeSmartPromotions.filter((item) => hasDisplayPlace(item, "checkout")).length
      },
      {
        label: "Menu",
        value: activeSmartPromotions.filter((item) => item.type === "strike_price" || item.type === "flash_sale" || hasDisplayPlace(item, "menu")).length
      },
      {
        label: "Trang chủ",
        value: safePromos.length + activeSmartPromotions.filter((item) => hasDisplayPlace(item, "home")).length
      },
      {
        label: "Loyalty",
        value: safeCoupons.filter((coupon) => String(coupon?.voucherType || "") === "loyalty").length
      }
    ]
  };
}

function PromotionOverview({ overview }) {
  const lifecycleCards = [
    { key: "running", label: "Đang chạy", tone: "is-running" },
    { key: "upcoming", label: "Sắp chạy", tone: "is-upcoming" },
    { key: "expired", label: "Hết hạn", tone: "is-expired" },
    { key: "off", label: "Đang tắt", tone: "is-off" }
  ];

  return (
    <section className="admin-promo-overview" aria-label="Tổng quan khuyến mãi">
      <div className="admin-promo-overview__main">
        <div>
          <span>Trung tâm khuyến mãi</span>
          <h3>{overview.totalPrograms} chương trình đang quản lý</h3>
        </div>
        <div className="admin-promo-health-grid">
          {lifecycleCards.map((item) => (
            <article key={item.key} className={`admin-promo-health-card ${item.tone}`}>
              <strong>{overview.lifecycle[item.key]}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-promo-impact-grid">
        {overview.impactCards.map((item) => (
          <article key={item.label} className="admin-promo-impact-card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PromotionSaveButton({ hasUnsavedChanges, isSaving, onSave }) {
  return (
    <AdminButton
      type="button"
      onClick={onSave}
      disabled={!hasUnsavedChanges || isSaving}
    >
      {isSaving ? "Đang lưu..." : hasUnsavedChanges ? "Lưu thay đổi" : "Đã đồng bộ"}
    </AdminButton>
  );
}

export default function PromotionTabsManager({
  products,
  promos,
  campaigns,
  coupons,
  setCoupons,
  smartPromotions,
  setSmartPromotions,
  normalizeSmartPromotion,
  onSaveLoyaltyConfig
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const initialLoyaltyConfig = useMemo(() => normalizeLoyaltyProgramConfig({}), []);
  const [draftCoupons, setDraftCouponsState] = useState(() => toArray(coupons));
  const [savedCoupons, setSavedCoupons] = useState(() => toArray(coupons));
  const [draftSmartPromotions, setDraftSmartPromotionsState] = useState(() => toArray(smartPromotions));
  const [savedSmartPromotions, setSavedSmartPromotions] = useState(() => toArray(smartPromotions));
  const [statusSmartPromotions, setStatusSmartPromotions] = useState(() => toArray(smartPromotions));
  const [loyaltyConfig, setLoyaltyConfigState] = useState(initialLoyaltyConfig);
  const [savedLoyaltyConfig, setSavedLoyaltyConfig] = useState(initialLoyaltyConfig);
  const draftCouponsRef = useRef(draftCoupons);
  const draftSmartPromotionsRef = useRef(draftSmartPromotions);
  const loyaltyConfigRef = useRef(loyaltyConfig);
  const couponDraftDirtyRef = useRef(false);
  const smartPromotionDraftDirtyRef = useRef(false);
  const loyaltyDraftDirtyRef = useRef(false);

  const setDraftCoupons = (nextValue) => {
    const resolved = typeof nextValue === "function"
      ? nextValue(draftCouponsRef.current)
      : nextValue;
    const nextCoupons = toArray(resolved);
    couponDraftDirtyRef.current = true;
    draftCouponsRef.current = nextCoupons;
    setDraftCouponsState(nextCoupons);
    setSaveMessage("");
  };

  const setDraftSmartPromotions = (nextValue) => {
    const resolved = typeof nextValue === "function"
      ? nextValue(draftSmartPromotionsRef.current)
      : nextValue;
    const nextPromotions = toArray(resolved);
    smartPromotionDraftDirtyRef.current = true;
    draftSmartPromotionsRef.current = nextPromotions;
    setDraftSmartPromotionsState(nextPromotions);
    setStatusSmartPromotions((current) => {
      const knownIds = new Set(current.map((item) => String(item?.id || "")));
      const additions = nextPromotions.filter((item) => !knownIds.has(String(item?.id || "")));
      return additions.length ? [...current, ...additions] : current;
    });
    setSaveMessage("");
  };

  const setDraftLoyaltyConfig = (nextValue) => {
    const resolved = typeof nextValue === "function"
      ? nextValue(loyaltyConfigRef.current)
      : nextValue;
    const nextConfig = normalizeLoyaltyProgramConfig(resolved || {});
    loyaltyDraftDirtyRef.current = true;
    loyaltyConfigRef.current = nextConfig;
    setLoyaltyConfigState(nextConfig);
    setSaveMessage("");
  };

  const {
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
  } = usePromotionTabsState({
    products,
    smartPromotions: draftSmartPromotions,
    setSmartPromotions: setDraftSmartPromotions,
    normalizeSmartPromotion
  });

  const currentSignature = useMemo(
    () => JSON.stringify({
      promos: promos || [],
      campaigns: campaigns || [],
      coupons: draftCoupons,
      smartPromotions: draftSmartPromotions
    }),
    [promos, campaigns, draftCoupons, draftSmartPromotions]
  );
  const savedSignature = useMemo(
    () => JSON.stringify({
      promos: promos || [],
      campaigns: campaigns || [],
      coupons: savedCoupons,
      smartPromotions: savedSmartPromotions
    }),
    [promos, campaigns, savedCoupons, savedSmartPromotions]
  );
  const loyaltyConfigSignature = useMemo(
    () => JSON.stringify(loyaltyConfig || {}),
    [loyaltyConfig]
  );
  const savedLoyaltyConfigSignature = useMemo(
    () => JSON.stringify(savedLoyaltyConfig || {}),
    [savedLoyaltyConfig]
  );
  const hasUnsavedChanges = currentSignature !== savedSignature || loyaltyConfigSignature !== savedLoyaltyConfigSignature;
  const overview = useMemo(
    () => buildPromotionOverview({ promos, coupons: savedCoupons, smartPromotions: savedSmartPromotions }),
    [promos, savedCoupons, savedSmartPromotions]
  );
  const tabCounts = useMemo(
    () => ({
      coupon: draftCoupons.length,
      free_shipping: freeShippingPromo ? 1 : 0,
      strike_price: strikePromos.length,
      flash_sale: flashSalePromos.length,
      gift_threshold: giftPromo ? 1 : 0
    }),
    [draftCoupons.length, freeShippingPromo, strikePromos.length, flashSalePromos.length, giftPromo]
  );

  const couponsPropSignature = useMemo(() => JSON.stringify(toArray(coupons)), [coupons]);
  const smartPromotionsPropSignature = useMemo(
    () => JSON.stringify(toArray(smartPromotions)),
    [smartPromotions]
  );

  useEffect(() => {
    if (couponDraftDirtyRef.current) return;
    const nextCoupons = toArray(coupons);
    draftCouponsRef.current = nextCoupons;
    setDraftCouponsState(nextCoupons);
    setSavedCoupons(nextCoupons);
  }, [coupons, couponsPropSignature]);

  useEffect(() => {
    if (smartPromotionDraftDirtyRef.current) return;
    const nextPromotions = toArray(smartPromotions);
    draftSmartPromotionsRef.current = nextPromotions;
    setDraftSmartPromotionsState(nextPromotions);
    setSavedSmartPromotions(nextPromotions);
    setStatusSmartPromotions(nextPromotions);
  }, [smartPromotions, smartPromotionsPropSignature]);

  useEffect(() => {
    let cancelled = false;

    async function loadLoyaltyConfig() {
      try {
        const loaded = normalizeLoyaltyProgramConfig(await getLoyaltyRuleConfigAsync());
        if (cancelled) return;
        if (loyaltyDraftDirtyRef.current) return;
        loyaltyConfigRef.current = loaded;
        loyaltyDraftDirtyRef.current = false;
        setLoyaltyConfigState(loaded);
        setSavedLoyaltyConfig(loaded);
      } catch (error) {
        console.warn("[PromotionTabsManager] load loyalty config failed", error);
      }
    }

    loadLoyaltyConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavePromotions = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      await Promise.all([
        catalogConfigRepository.setAsync("ghr_promos", promos || []),
        catalogConfigRepository.setAsync("ghr_campaigns", campaigns || []),
        catalogConfigRepository.setAsync("ghr_coupons", draftCoupons),
        catalogConfigRepository.setAsync("ghr_smart_promotions", draftSmartPromotions),
        Promise.resolve(onSaveLoyaltyConfig?.(loyaltyConfig))
      ]);
      await syncPromotionCatalogToSupabase({
        promos,
        campaigns,
        coupons: draftCoupons,
        smartPromotions: draftSmartPromotions
      });

      couponDraftDirtyRef.current = false;
      smartPromotionDraftDirtyRef.current = false;
      loyaltyDraftDirtyRef.current = false;
      setSavedCoupons(draftCoupons);
      setSavedSmartPromotions(draftSmartPromotions);
      setStatusSmartPromotions(draftSmartPromotions);
      setSavedLoyaltyConfig(loyaltyConfig);
      setCoupons(draftCoupons);
      setSmartPromotions(draftSmartPromotions);
      setSaveMessage("Đã lưu và đồng bộ Web, QR và POS.");
    } catch (error) {
      console.warn("[PromotionTabsManager] save promotions failed", error);
      setSaveMessage("Lưu khuyến mãi thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    couponDraftDirtyRef.current = false;
    smartPromotionDraftDirtyRef.current = false;
    loyaltyDraftDirtyRef.current = false;
    draftCouponsRef.current = savedCoupons;
    draftSmartPromotionsRef.current = savedSmartPromotions;
    loyaltyConfigRef.current = savedLoyaltyConfig;
    setDraftCouponsState(savedCoupons);
    setDraftSmartPromotionsState(savedSmartPromotions);
    setStatusSmartPromotions(savedSmartPromotions);
    setLoyaltyConfigState(savedLoyaltyConfig);
    setSaveMessage("Đã hủy các thay đổi chưa lưu.");
  };

  const renderNotConfigured = (type) => (
    <AdminPanel
      title="Chưa có cấu hình"
      description="Tạo nhanh một cấu hình mặc định để bắt đầu chỉnh sửa."
      className="admin-promo-empty-panel"
      action={(
        <AdminButton type="button" onClick={() => createPromotion(type)}>
          Tạo cấu hình mặc định
        </AdminButton>
      )}
    >
      <p className="admin-promo-empty-copy">Sau khi tạo, anh có thể chỉnh điều kiện, thời gian và trạng thái ngay trong tab này.</p>
    </AdminPanel>
  );

  return (
    <AdminPanel
      title="Khuyến mãi"
      description="Quản lý voucher, hỗ trợ ship, giảm giá món, flash sale và tặng món trong cùng một màn hình."
      className="admin-promo-v2 admin-promo-page"
      bodyClassName="admin-promo-page-body"
    >
      <PromotionOverview overview={overview} />

      {saveMessage ? <p className="admin-promo-save-message" aria-live="polite">{saveMessage}</p> : null}

      <div className="admin-menu-tabs admin-promo-tabs">
        {promoTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? "active" : ""}
            aria-label={`Mở tab ${tab.label}`}
          >
            <span>
              {tab.label}
              <b>{tabCounts[tab.id] || 0}</b>
            </span>
            <small>{tab.description}</small>
          </button>
        ))}
      </div>

      {activeTab === "coupon" && (
        <CouponManager
          coupons={draftCoupons}
          setCoupons={setDraftCoupons}
          loyaltyConfig={loyaltyConfig}
          setLoyaltyConfig={setDraftLoyaltyConfig}
        />
      )}

      {activeTab === "free_shipping" && (
        <FreeshipManager
          freeShippingPromo={freeShippingPromo}
          createPromotion={createPromotion}
          updatePromotion={updatePromotion}
        />
      )}

      {activeTab === "strike_price" && (
        strikePromos.length ? (
          <StrikePriceTab
            strikePromos={strikePromos}
            selectedStrikePromo={selectedStrikePromo}
            setSelectedStrikePromoId={setSelectedStrikePromoId}
            createPromotion={createPromotion}
            preview={preview}
            updatePromotion={updatePromotion}
            activeCategories={activeCategories}
            activeProducts={activeProducts}
            statusPromotions={statusSmartPromotions}
            setSmartPromotions={setDraftSmartPromotions}
            smartPromotions={draftSmartPromotions}
          />
        ) : renderNotConfigured("strike_price")
      )}

      {activeTab === "flash_sale" && (
        flashSalePromos.length ? (
          <FlashSaleTab
            flashSalePromos={flashSalePromos}
            selectedFlashPromo={selectedFlashPromo}
            setSelectedFlashPromoId={setSelectedFlashPromoId}
            createPromotion={createPromotion}
            nowTick={nowTick}
            updatePromotion={updatePromotion}
            activeCategories={activeCategories}
            activeProducts={activeProducts}
            statusPromotions={statusSmartPromotions}
            setSmartPromotions={setDraftSmartPromotions}
            smartPromotions={draftSmartPromotions}
          />
        ) : renderNotConfigured("flash_sale")
      )}

      {activeTab === "gift_threshold" && (
        giftPromo ? (
          <GiftThresholdTab
            giftPromo={giftPromo}
            updatePromotion={updatePromotion}
            activeProducts={activeProducts}
          />
        ) : renderNotConfigured("gift_threshold")
      )}

      <div className={`admin-promo-save-dock ${hasUnsavedChanges ? "is-dirty" : "is-clean"}`}>
        <div>
          <strong>{hasUnsavedChanges ? "Có thay đổi chưa lưu" : "Khuyến mãi đã đồng bộ"}</strong>
          <span>
            {hasUnsavedChanges
              ? "Chỉ sau khi lưu, trạng thái và cấu hình mới được cập nhật cho Web, QR và POS."
              : "Chỉnh form để bắt đầu một bản nháp mới."}
          </span>
        </div>
        <div className="admin-promo-save-actions">
          <AdminButton
            type="button"
            variant="secondary"
            onClick={handleDiscardChanges}
            disabled={!hasUnsavedChanges || isSaving}
          >
            Hủy thay đổi
          </AdminButton>
          <PromotionSaveButton
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            onSave={handleSavePromotions}
          />
        </div>
      </div>
    </AdminPanel>
  );
}
