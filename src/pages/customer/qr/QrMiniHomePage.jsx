import { useMemo } from "react";
import Icon from "../../../components/Icon.jsx";
import { CustomerButton, CustomerEmptyState } from "../../../components/customer/CustomerUI.jsx";
import { buildQrCouponOffers, buildQrOfferItems } from "../../../services/qrOfferService.js";
import { getActiveVouchers } from "../../../utils/pureHelpers.js";
import { formatMoney } from "../../../utils/format.js";

function matchBranchByQrKey(branch = {}, key = "") {
  const normalizedKey = String(key || "").trim().toLowerCase();
  if (!normalizedKey) return false;

  const candidates = [
    branch?.branch_code,
    branch?.branchCode,
    branch?.branch_uuid,
    branch?.branchUuid,
    branch?.slug,
    branch?.id
  ];

  return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedKey);
}

function resolveQrBranch(branches = [], checkoutPreset = {}) {
  const key = String(checkoutPreset?.qrBranchId || checkoutPreset?.selectedBranch || "").trim().toLowerCase();
  if (!key) return null;
  return (Array.isArray(branches) ? branches : []).find((branch) => matchBranchByQrKey(branch, key)) || null;
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

function OfferImageCard({ offer, fallbackImage, onClick }) {
  if (!offer) return null;

  const hasSalePrice = Number(offer?.originalPrice || 0) > Number(offer?.currentPrice || 0);
  const hasGiftThreshold = Number(offer?.thresholdAmount || 0) > 0;
  const savingAmount = getSavingAmount(offer);

  return (
    <button type="button" className="qr-mini-offer-image-card" onClick={onClick}>
      <span className="qr-mini-offer-image-card__photo">
        {offer.image || fallbackImage ? <img src={offer.image || fallbackImage} alt={offer.productName || offer.title} /> : null}
      </span>
      <span className="qr-mini-offer-image-card__copy">
        <small>{getOfferLabel(offer)}</small>
        <strong>{offer.title}</strong>
        <em>{offer.productName || offer.detail}</em>
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
      </span>
    </button>
  );
}

function VoucherHintCard({ onClick }) {
  return (
    <button type="button" className="qr-mini-home__voucher-hint" onClick={onClick}>
      <span className="qr-mini-home__voucher-hint-icon">
        <Icon name="tag" size={17} />
      </span>
      <span className="qr-mini-home__voucher-hint-copy">
        <small>Khuyến mãi cho bạn</small>
        <strong>Khi quán bật voucher QR, khách sẽ thấy ngay tại đây</strong>
        <em>Khối này ưu tiên hiện mã cá nhân trước, rồi tới mã chung của quán.</em>
      </span>
    </button>
  );
}

export default function QrMiniHomePage({
  navigate,
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
        limit: 6
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

  const primaryOffer = promotionOffers[0] || offerItems[0] || null;
  const heroImage = primaryOffer?.image || products.find((product) => product?.visible !== false)?.image || "";
  const primarySaving = getSavingAmount(primaryOffer);
  const hasHeroSale = Number(primaryOffer?.originalPrice || 0) > Number(primaryOffer?.currentPrice || 0);
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

  const remainingOffers = useMemo(() => {
    if (!primaryOffer) return [];
    const sourceOffers = promotionOffers.length ? promotionOffers : offerItems;
    return sourceOffers.filter((offer) => offer?.id !== primaryOffer.id);
  }, [offerItems, primaryOffer, promotionOffers]);

  const gridOffers = remainingOffers.slice(0, 2);
  const shouldShowVoucherHint = !voucherCards.length;

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
                </span>
              ) : (
                <span>{primaryOffer.detail || primaryOffer.text || "Áp dụng hôm nay"}</span>
              )}
            </div>
          ) : null}

          <div className="qr-mini-home__actions">
            <CustomerButton
              size="md"
              variant="secondary"
              className="qr-mini-home__action-menu"
              onClick={() => navigate("menu", "menu")}
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

      {gridOffers.length ? (
        <div className={`qr-mini-home__quick-grid${gridOffers.length === 1 ? " is-single" : ""}`}>
          {gridOffers.map((offer) => (
            <OfferImageCard
              key={offer.id || offer.title}
              offer={offer}
              fallbackImage={heroImage}
              onClick={() => navigate("menu", "menu")}
            />
          ))}
        </div>
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
            <strong>Đăng ký thành viên để xem điểm và lưu mã ưu đãi</strong>
            <small>Không bắt buộc khi đặt món.</small>
          </div>
          <button type="button" onClick={() => navigate("account", "account")}>Đăng ký ngay</button>
        </section>
      ) : null}
    </section>
  );
}
