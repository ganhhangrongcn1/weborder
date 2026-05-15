import { useMemo } from "react";
import Icon from "../Icon.jsx";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInRange(startAt, endAt) {
  const nowKey = getDateKey();
  const start = String(startAt || "").slice(0, 10);
  const end = String(endAt || "").slice(0, 10);
  if (start && start > nowKey) return false;
  if (end && end < nowKey) return false;
  return true;
}

function buildMilestones(products, smartPromotions) {
  const activePromotionMilestones = (smartPromotions || [])
    .filter((promotion) => promotion && promotion.active !== false)
    .filter((promotion) => isDateInRange(promotion.startAt, promotion.endAt))
    .filter((promotion) => Number(promotion?.condition?.minSubtotal || 0) > 0)
    .filter((promotion) => promotion?.type !== "free_shipping" && promotion?.reward?.type !== "shipping_discount")
    .filter((promotion) => promotion?.type !== "coupon_hint")
    .map((promotion) => {
      const amount = Number(promotion?.condition?.minSubtotal || 0);
      const rewardType = promotion?.reward?.type;
      const giftProduct = (products || []).find((item) => item?.id === promotion?.reward?.productId && item?.visible !== false);
      const rewardText = rewardType === "gift"
        ? (giftProduct ? giftProduct.name : "Quà tặng")
        : (promotion?.name || "Ưu đãi");

      return {
        kind: rewardType === "gift" ? "gift" : "other",
        amount,
        reward: rewardText
      };
    });

  const freeShipPromotion = (smartPromotions || [])
    .filter((promotion) => promotion && promotion.active !== false)
    .filter((promotion) => isDateInRange(promotion.startAt, promotion.endAt))
    .filter((promotion) => promotion?.type === "free_shipping" || promotion?.reward?.type === "shipping_discount")
    .sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99))[0];

  const freeShipMilestone = freeShipPromotion
    ? [{
        kind: "freeship",
        amount: Number(freeShipPromotion?.condition?.minSubtotal || freeshipMinSubtotal),
        reward: "Freeship"
      }]
    : [];

  return [...activePromotionMilestones, ...freeShipMilestone]
    .filter((item) => Number(item?.amount || 0) > 0)
    .sort((a, b) => Number(a.amount) - Number(b.amount));
}

export default function FloatingCartBar({ count, subtotal, onClick, formatMoney, products = [], smartPromotions = [] }) {
  const milestoneState = useMemo(() => {
    const milestones = buildMilestones(products, smartPromotions);
    if (!milestones.length) return null;

    const currentSubtotal = Number(subtotal || 0);
    const reachedGift = [...milestones]
      .filter((item) => item.kind === "gift" && currentSubtotal >= Number(item.amount || 0))
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;

    const nextMilestone = milestones.find((item) => currentSubtotal < Number(item.amount || 0)) || null;

    return {
      reachedGift,
      nextMilestone,
      nextMissing: nextMilestone ? Math.max(Number(nextMilestone.amount) - currentSubtotal, 0) : 0
    };
  }, [products, smartPromotions, subtotal]);

  return (
    <div className="floating-cart-stack" aria-live="polite">
      <div className="floating-cart-combo-card">
        {milestoneState ? (
          <div className="floating-cart-milestone-card">
            {milestoneState.reachedGift ? (
              <p>
                Bạn đã được <span className="cart-milestone-reward is-gift">1 {milestoneState.reachedGift.reward}</span> miễn phí.
              </p>
            ) : null}

            {milestoneState.nextMilestone ? (
              <p>
                Đặt thêm <b>{formatMoney(milestoneState.nextMissing)}</b> để nhận ngay:{" "}
                <span className={`cart-milestone-reward ${milestoneState.nextMilestone.kind === "gift" ? "is-gift" : milestoneState.nextMilestone.kind === "freeship" ? "is-freeship" : "is-other"}`}>
                  {milestoneState.nextMilestone.reward}
                </span>
              </p>
            ) : (
              <p>Bạn đã đạt tất cả mốc ưu đãi đang áp dụng.</p>
            )}
          </div>
        ) : null}

        <button type="button" onClick={onClick} className="floating-cart-bar" aria-label="Mở thanh toán">
          <span className="cart-glass-icon"><Icon name="cart" size={18} /></span>
          <span className="min-w-0 flex-1 text-left">
            <strong>{count} món đã chọn</strong>
            <small>Tạm tính {formatMoney(subtotal)}</small>
          </span>
          <span className="cart-glass-cta">Thanh toán</span>
        </button>
      </div>
    </div>
  );
}
