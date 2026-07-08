import { useMemo } from "react";
import Icon from "../../../components/Icon.jsx";
import { CustomerButton, CustomerEmptyState } from "../../../components/customer/CustomerUI.jsx";
import { buildQrCouponOffers, buildQrOfferItems } from "../../../services/qrOfferService.js";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";
import { getActiveVouchers } from "../../../utils/pureHelpers.js";
import { formatMoney } from "../../../utils/format.js";

function resolveQrBranch(branches = [], checkoutPreset = {}) {
  const key = String(checkoutPreset?.qrBranchId || checkoutPreset?.selectedBranch || "").trim().toLowerCase();
  if (!key) return null;
  return resolveBranchFromCandidates([key], branches);
}

function getCompactBranchName(branch = {}) {
  const fullName = String(branch?.name || branch?.branchName || "").trim();
  if (!fullName) return "";
  const compactName = fullName.replace(/^(gánh hàng rong|ganh hang rong)\s*[-–—]\s*/i, "").trim();
  return compactName || fullName;
}

function getSavingAmount(offer = {}) {
  const originalPrice = Number(offer?.originalPrice || 0);
  const currentPrice = Number(offer?.currentPrice || 0);
  return originalPrice > currentPrice ? originalPrice - currentPrice : 0;
}

function getOfferLabel(offer = {}) {
  if (offer?.source === "coupon") return "Voucher";
  if (offer?.source === "flash_sale") return "Flash sale";
  if (offer?.source === "gift_threshold") return "Quà tặng";
  return offer?.eyebrow || "Ưu đãi";
}

function getCouponCodeFromLabel(codeLabel = "") {
  return String(codeLabel || "")
    .replace(/^mã:\s*/i, "")
    .trim()
    .toUpperCase();
}

function parseDateValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const parsed = new Date(text.length > 10 ? text : `${text.slice(0, 10)}T23:59:59`).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function formatVoucherValue(voucher = {}) {
  const value = Number(voucher?.value || voucher?.rawValue || 0);
  if (!value) return String(voucher?.title || voucher?.name || "Mã ưu đãi").trim();
  if (String(voucher?.discountType || "") === "percent") return `Giảm ${value}%`;
  return `Giảm ${formatMoney(value)}`;
}

function formatVoucherMeta(voucher = {}) {
  const parts = [formatVoucherValue(voucher)];
  const minOrder = Number(voucher?.minOrder || 0);
  if (minOrder > 0) parts.push(`Đơn từ ${formatMoney(minOrder)}`);
  return parts.filter(Boolean).join(" • ");
}

function formatExpiryLabel(value = "") {
  const text = String(value || "").trim();
  if (!text) return "Dùng khi xác nhận đơn";

  const date = new Date(text.length > 10 ? text : `${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Dùng khi xác nhận đơn";

  return `HSD ${date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit"
  })}`;
}

function buildVoucherCards(memberVouchers = [], qrCoupons = []) {
  const memberCards = memberVouchers.map((voucher, index) => ({
    id: `member-${String(voucher?.id || voucher?.code || index)}`,
    priority: 0,
    expirySort: parseDateValue(voucher?.expiredAt || voucher?.endAt || voucher?.expiry),
    valueSort: Number(voucher?.value || 0),
    icon: "gift",
    badge: "Voucher cá nhân",
    mode: "Ưu tiên",
    title: String(voucher?.title || voucher?.campaignLabel || voucher?.code || "Ưu đãi dành cho bạn").trim(),
    code: String(voucher?.code || "").trim().toUpperCase(),
    meta: formatVoucherMeta(voucher),
    note: formatExpiryLabel(voucher?.expiredAt || voucher?.endAt || voucher?.expiry)
  }));

  const couponCards = qrCoupons.map((coupon, index) => ({
    id: `coupon-${String(coupon?.id || index)}`,
    priority: 1,
    expirySort: parseDateValue(coupon?.endAt || coupon?.expiry),
    valueSort: Number(coupon?.rawValue || 0),
    icon: "tag",
    badge: "Khách đặt QR",
    mode: "Nhập mã",
    title: String(coupon?.title || "Voucher tại quầy").trim(),
    code: getCouponCodeFromLabel(coupon?.codeLabel),
    meta: String(coupon?.value || coupon?.detail || "Áp dụng cho đơn QR").trim(),
    note: formatExpiryLabel(coupon?.endAt || coupon?.expiry)
  }));

  return [...memberCards, ...couponCards].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.expirySort !== b.expirySort) return a.expirySort - b.expirySort;
    return b.valueSort - a.valueSort;
  });
}

function findProductForOffer(offer = {}, products = []) {
  const safeProducts = Array.isArray(products) ? products : [];
  const preferredId = String(offer?.productId || "").trim();
  if (preferredId) {
    const matchedById = safeProducts.find((product) => String(product?.id || "").trim() === preferredId);
    if (matchedById) return matchedById;
  }

  const productName = String(offer?.productName || offer?.title || "").trim().toLowerCase();
  if (!productName) return null;
  return safeProducts.find((product) => String(product?.name || "").trim().toLowerCase() === productName) || null;
}

function OfferImageCard({ offer, fallbackImage, onClick, actionLabel = "Mua nhanh" }) {
  if (!offer) return null;

  const hasSalePrice = Number(offer?.originalPrice || 0) > Number(offer?.currentPrice || 0);
  const hasGiftThreshold = Number(offer?.thresholdAmount || 0) > 0;
  const savingAmount = getSavingAmount(offer);
  const displayTitle = offer?.productName || offer?.title;
  const displaySubtitle = offer?.productDescription || offer?.text || offer?.detail;

  return (
    <button type="button" className="qr-mini-offer-image-card" onClick={onClick}>
      <span className="qr-mini-offer-image-card__photo">
        {offer.image || fallbackImage ? <img src={offer.image || fallbackImage} alt={displayTitle} /> : null}
        <small className="qr-mini-offer-image-card__badge">{getOfferLabel(offer)}</small>
      </span>
      <span className="qr-mini-offer-image-card__copy">
        <strong>{displayTitle}</strong>
        <em>{displaySubtitle}</em>
        {hasSalePrice ? (
          <span className="qr-mini-offer-image-card__price">
            <span className="qr-mini-offer-image-card__price-label">Hôm nay</span>
            <span className="qr-mini-offer-image-card__price-current">{formatMoney(Number(offer.currentPrice || 0))}</span>
            <span className="qr-mini-offer-image-card__price-meta">
              <span className="qr-mini-offer-image-card__price-old">{formatMoney(Number(offer.originalPrice || 0))}</span>
              {savingAmount > 0 ? <span className="qr-mini-offer-image-card__price-save">Tiết kiệm {formatMoney(savingAmount)}</span> : null}
            </span>
          </span>
        ) : hasGiftThreshold ? (
          <span className="qr-mini-offer-image-card__perk">
            <span className="qr-mini-offer-image-card__perk-threshold">Đơn từ {formatMoney(Number(offer.thresholdAmount || 0))}</span>
            <span className="qr-mini-offer-image-card__perk-value">{offer.rewardSummary || offer.value}</span>
            <span className="qr-mini-offer-image-card__perk-note">Tự áp dụng</span>
          </span>
        ) : (
          <span className="qr-mini-offer-image-card__summary">{offer.rewardSummary || offer.value}</span>
        )}
        <span className="qr-mini-offer-image-card__foot">
          <span className="qr-mini-offer-image-card__action">{actionLabel}</span>
          <span className="qr-mini-offer-image-card__add">+</span>
        </span>
      </span>
    </button>
  );
}

function QrOfferSection({ title, count, items = [], fallbackImage, onOpenMenu, onOfferAction, actionLabel = "Mua nhanh", variant = "" }) {
  if (!items.length) return null;

  return (
    <section className={`qr-mini-home__offer-section ${variant}`.trim()}>
      <div className="qr-mini-home__offer-section-head">
        <div>
          <small>{title}</small>
          <strong>{count ? `${count} ưu đãi` : "Đang áp dụng"}</strong>
        </div>
        <button type="button" onClick={onOpenMenu}>Xem menu</button>
      </div>
      <div className={`qr-mini-home__offer-grid${items.length === 1 ? " is-single" : ""}`}>
        {items.map((offer) => (
          <OfferImageCard
            key={offer.id || offer.title}
            offer={offer}
            fallbackImage={fallbackImage}
            actionLabel={actionLabel}
            onClick={() => {
              if (typeof onOfferAction === "function") {
                onOfferAction(offer);
                return;
              }
              onOpenMenu?.();
            }}
          />
        ))}
      </div>
    </section>
  );
}

function VoucherHintCard({ onClick }) {
  return (
    <button type="button" className="qr-mini-home__voucher-hint" onClick={onClick}>
      <span className="qr-mini-home__voucher-hint-icon">
        <Icon name="tag" size={17} />
      </span>
      <span className="qr-mini-home__voucher-hint-copy">
        <small>Voucher của bạn</small>
        <strong>Voucher sẽ hiện ở đây nếu có</strong>
      </span>
    </button>
  );
}

export default function QrMiniHomePage({
  navigate,
  openOptionModal,
  coupons = [],
  checkoutCoupons = [],
  smartPromotions = [],
  checkoutSmartPromotions = [],
  products = [],
  branches = [],
  checkoutPreset = {},
  demoLoyalty = {},
  isRegisteredCustomer = false,
  hasCustomerAuthSession = false
}) {
  const offerItems = useMemo(
    () =>
      buildQrOfferItems({
        coupons: checkoutCoupons.length ? checkoutCoupons : coupons,
        smartPromotions: checkoutSmartPromotions.length ? checkoutSmartPromotions : smartPromotions,
        products,
        limit: 12
      }),
    [checkoutCoupons, checkoutSmartPromotions, coupons, products, smartPromotions]
  );

  const qrCouponOffers = useMemo(
    () =>
      buildQrCouponOffers({
        coupons: checkoutCoupons.length ? checkoutCoupons : coupons
      }),
    [checkoutCoupons, coupons]
  );

  const promotionOffers = useMemo(
    () => offerItems.filter((offer) => offer?.source !== "coupon"),
    [offerItems]
  );

  const flashSaleOffers = useMemo(
    () => promotionOffers.filter((offer) => offer?.source === "flash_sale"),
    [promotionOffers]
  );

  const giftOffers = useMemo(
    () => promotionOffers.filter((offer) => offer?.source === "gift_threshold"),
    [promotionOffers]
  );

  const otherPromotionOffers = useMemo(
    () => promotionOffers.filter((offer) => !["flash_sale", "gift_threshold"].includes(String(offer?.source || ""))),
    [promotionOffers]
  );

  const primaryOffer = flashSaleOffers[0] || giftOffers[0] || otherPromotionOffers[0] || offerItems[0] || null;
  const heroImage = primaryOffer?.image || products.find((product) => product?.visible !== false)?.image || "";
  const primarySaving = getSavingAmount(primaryOffer);
  const hasHeroSale = Number(primaryOffer?.originalPrice || 0) > Number(primaryOffer?.currentPrice || 0);
  const heroSummary = flashSaleOffers.length
    ? `${flashSaleOffers.length} món đang áp dụng`
    : primaryOffer?.detail || primaryOffer?.text || "Áp dụng hôm nay";
  const qrBranch = useMemo(() => resolveQrBranch(branches, checkoutPreset), [branches, checkoutPreset]);
  const compactBranchName = useMemo(() => getCompactBranchName(qrBranch), [qrBranch]);

  const activeMemberVouchers = useMemo(() => {
    const vouchers = getActiveVouchers(demoLoyalty || { voucherHistory: [] });
    return vouchers.filter((voucher) => String(voucher?.code || "").trim());
  }, [demoLoyalty]);

  const voucherCards = useMemo(
    () => buildVoucherCards(
      (isRegisteredCustomer || hasCustomerAuthSession) ? activeMemberVouchers : [],
      qrCouponOffers
    ),
    [activeMemberVouchers, hasCustomerAuthSession, isRegisteredCustomer, qrCouponOffers]
  );

  const shouldShowVoucherHint = !voucherCards.length;
  const primaryOfferProduct = useMemo(() => {
    return findProductForOffer(primaryOffer, products);
  }, [primaryOffer, products]);

  const openProductOptionsInMenu = (product) => {
    if (!product || typeof openOptionModal !== "function") {
      navigate("menu", "menu");
      return;
    }
    navigate("menu", "menu");
    openOptionModal(product);
  };

  const handleQuickAddPrimaryOffer = () => {
    openProductOptionsInMenu(primaryOfferProduct);
  };

  const handleQuickBuyOffer = (offer) => {
    if (offer?.source !== "flash_sale") {
      navigate("menu", "menu");
      return;
    }
    openProductOptionsInMenu(findProductForOffer(offer, products));
  };

  return (
    <section className="qr-mini-home">
      <div className="qr-mini-home__hero">
        <div className="qr-mini-home__hero-copy">
          <span className="qr-mini-home__badge">
            <Icon name="dish" size={15} />
            <span>QR tại quầy</span>
            {compactBranchName ? <strong>{compactBranchName}</strong> : null}
          </span>
          <h1>Ưu đãi tại quầy</h1>
          <p>Chọn món, nhập voucher và theo dõi đơn ngay trên điện thoại.</p>

          {primaryOffer ? (
            <div className="qr-mini-home__hero-highlight">
              <small>{primaryOffer.title || "Ưu đãi hôm nay"}</small>
              <strong>{hasHeroSale ? formatMoney(Number(primaryOffer.currentPrice || 0)) : (primaryOffer.rewardSummary || primaryOffer.value)}</strong>
              {hasHeroSale ? (
                <span>
                  <em>{formatMoney(Number(primaryOffer.originalPrice || 0))}</em>
                  {primarySaving > 0 ? ` • Tiết kiệm ${formatMoney(primarySaving)}` : ""}
                  {flashSaleOffers.length ? ` • ${heroSummary}` : ""}
                </span>
              ) : (
                <span>{heroSummary}</span>
              )}
            </div>
          ) : null}

          <div className="qr-mini-home__actions">
            <CustomerButton
              size="md"
              variant="secondary"
              className="qr-mini-home__action-menu"
              onClick={handleQuickAddPrimaryOffer}
              icon="dish"
            >
              Đặt ngay
            </CustomerButton>
            <CustomerButton
              size="md"
              variant="ghost"
              className="qr-mini-home__action-rewards"
              onClick={() => navigate("loyalty", "rewards")}
              icon="gift"
            >
              Ưu đãi
            </CustomerButton>
          </div>
        </div>

        <div className="qr-mini-home__hero-photo">
          {heroImage ? <img src={heroImage} alt={primaryOffer?.productName || primaryOffer?.title || "Món đang ưu đãi"} /> : null}
        </div>
      </div>

      <QrOfferSection
        title="Flash Sale hôm nay"
        count={flashSaleOffers.length}
        items={flashSaleOffers}
        fallbackImage={heroImage}
        onOpenMenu={() => navigate("menu", "menu")}
        onOfferAction={handleQuickBuyOffer}
        actionLabel="Chọn món"
      />

      <QrOfferSection
        title="Quà tặng theo đơn"
        count={giftOffers.length}
        items={giftOffers}
        fallbackImage={heroImage}
        onOpenMenu={() => navigate("menu", "menu")}
        actionLabel="Xem menu"
        variant="is-gift"
      />

      <QrOfferSection
        title="Ưu đãi khác"
        count={otherPromotionOffers.length}
        items={otherPromotionOffers}
        fallbackImage={heroImage}
        onOpenMenu={() => navigate("menu", "menu")}
        actionLabel="Xem menu"
      />

      {voucherCards.length ? (
        <section className="qr-mini-home__voucher-strip">
          <div className="qr-mini-home__voucher-strip-head">
            <div className="qr-mini-home__voucher-strip-title">
              <Icon name="tag" size={16} />
              <strong>Khuyến mãi cho bạn</strong>
            </div>
            <span>{voucherCards.length}</span>
          </div>

          <div className="qr-mini-home__voucher-slider" aria-label="Danh sách voucher">
            {voucherCards.map((voucher) => (
              <article
                key={voucher.id}
                className={`qr-mini-home__voucher-card${voucher.priority === 0 ? " is-member" : ""}`}
              >
                <span className="qr-mini-home__voucher-card-icon">
                  <Icon name={voucher.icon} size={18} />
                </span>
                <div className="qr-mini-home__voucher-card-copy">
                  <div className="qr-mini-home__voucher-card-badges">
                    <small>{voucher.badge}</small>
                    <em>{voucher.note}</em>
                  </div>
                  <strong>{voucher.title}</strong>
                  <p>{voucher.meta}</p>
                  <div className="qr-mini-home__voucher-card-footer">
                    {voucher.code ? <b>{voucher.code}</b> : <span>{voucher.mode}</span>}
                    <CustomerButton
                      size="sm"
                      className="qr-mini-home__voucher-card-cta"
                      onClick={() => navigate("menu", "menu")}
                      aria-label={`Đặt ngay với ${voucher.title}`}
                    >
                      Đặt
                    </CustomerButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {shouldShowVoucherHint ? <VoucherHintCard onClick={() => navigate("loyalty", "rewards")} /> : null}

      {!offerItems.length ? (
        <CustomerEmptyState
          icon="gift"
          title="Chưa có ưu đãi đang bật"
          message="Bạn vẫn có thể vào menu đặt món tại quầy."
          actionText="Đặt ngay"
          onAction={() => navigate("menu", "menu")}
        />
      ) : null}

      {!isRegisteredCustomer ? (
        <section className="qr-mini-home__member">
          <span><Icon name="star" size={18} /></span>
          <div>
            <strong>Đăng ký để sử dụng điểm tích lũy và ưu đãi</strong>
            <small>Tích điểm, voucher hàng tháng, theo dõi đơn hàng</small>
          </div>
          <button type="button" onClick={() => navigate("account", "account")}>Đăng ký ngay</button>
        </section>
      ) : null}
    </section>
  );
}
