import { useMemo } from "react";
import Icon from "../Icon.js";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
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
  const activePromotionMilestones = (smartPromotions || []).filter(promotion => promotion && promotion.active !== false).filter(promotion => isDateInRange(promotion.startAt, promotion.endAt)).filter(promotion => Number(promotion?.condition?.minSubtotal || 0) > 0).filter(promotion => promotion?.type !== "free_shipping" && promotion?.reward?.type !== "shipping_discount").filter(promotion => promotion?.type !== "coupon_hint").map(promotion => {
    const amount = Number(promotion?.condition?.minSubtotal || 0);
    const rewardType = promotion?.reward?.type;
    const giftProduct = (products || []).find(item => item?.id === promotion?.reward?.productId && item?.visible !== false);
    const rewardText = rewardType === "gift" ? giftProduct ? giftProduct.name : "Quà tặng" : promotion?.name || "Ưu đãi";
    return {
      kind: rewardType === "gift" ? "gift" : "other",
      amount,
      reward: rewardText
    };
  });
  const freeShipPromotion = (smartPromotions || []).filter(promotion => promotion && promotion.active !== false).filter(promotion => isDateInRange(promotion.startAt, promotion.endAt)).filter(promotion => promotion?.type === "free_shipping" || promotion?.reward?.type === "shipping_discount").sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99))[0];
  const freeShipMilestone = freeShipPromotion ? [{
    kind: "freeship",
    amount: Number(freeShipPromotion?.condition?.minSubtotal || freeshipMinSubtotal),
    reward: "Freeship"
  }] : [];
  return [...activePromotionMilestones, ...freeShipMilestone].filter(item => Number(item?.amount || 0) > 0).sort((a, b) => Number(a.amount) - Number(b.amount));
}
export default function FloatingCartBar({
  count,
  subtotal,
  onClick,
  formatMoney,
  products = [],
  smartPromotions = []
}) {
  const milestoneState = useMemo(() => {
    const milestones = buildMilestones(products, smartPromotions);
    if (!milestones.length) return null;
    const currentSubtotal = Number(subtotal || 0);
    const reachedGift = [...milestones].filter(item => item.kind === "gift" && currentSubtotal >= Number(item.amount || 0)).sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;
    const nextMilestone = milestones.find(item => currentSubtotal < Number(item.amount || 0)) || null;
    return {
      reachedGift,
      nextMilestone,
      nextMissing: nextMilestone ? Math.max(Number(nextMilestone.amount) - currentSubtotal, 0) : 0
    };
  }, [products, smartPromotions, subtotal]);
  return /*#__PURE__*/_jsx("div", {
    className: "floating-cart-stack",
    "aria-live": "polite",
    children: /*#__PURE__*/_jsxs("div", {
      className: "floating-cart-combo-card",
      children: [milestoneState ? /*#__PURE__*/_jsxs("div", {
        className: "floating-cart-milestone-card",
        children: [milestoneState.reachedGift ? /*#__PURE__*/_jsxs("p", {
          children: ["B\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c ", /*#__PURE__*/_jsxs("span", {
            className: "cart-milestone-reward is-gift",
            children: ["1 ", milestoneState.reachedGift.reward]
          }), " mi\u1EC5n ph\xED."]
        }) : null, milestoneState.nextMilestone ? /*#__PURE__*/_jsxs("p", {
          children: ["\u0110\u1EB7t th\xEAm ", /*#__PURE__*/_jsx("b", {
            children: formatMoney(milestoneState.nextMissing)
          }), " \u0111\u1EC3 nh\u1EADn ngay:", " ", /*#__PURE__*/_jsx("span", {
            className: `cart-milestone-reward ${milestoneState.nextMilestone.kind === "gift" ? "is-gift" : milestoneState.nextMilestone.kind === "freeship" ? "is-freeship" : "is-other"}`,
            children: milestoneState.nextMilestone.reward
          })]
        }) : /*#__PURE__*/_jsx("p", {
          children: "B\u1EA1n \u0111\xE3 \u0111\u1EA1t t\u1EA5t c\u1EA3 m\u1ED1c \u01B0u \u0111\xE3i \u0111ang \xE1p d\u1EE5ng."
        })]
      }) : null, /*#__PURE__*/_jsxs("button", {
        type: "button",
        onClick: onClick,
        className: "floating-cart-bar",
        "aria-label": "M\u1EDF thanh to\xE1n",
        children: [/*#__PURE__*/_jsx("span", {
          className: "cart-glass-icon",
          children: /*#__PURE__*/_jsx(Icon, {
            name: "cart",
            size: 18
          })
        }), /*#__PURE__*/_jsxs("span", {
          className: "min-w-0 flex-1 text-left",
          children: [/*#__PURE__*/_jsxs("strong", {
            children: [count, " m\xF3n \u0111\xE3 ch\u1ECDn"]
          }), /*#__PURE__*/_jsxs("small", {
            children: ["T\u1EA1m t\xEDnh ", formatMoney(subtotal)]
          })]
        }), /*#__PURE__*/_jsx("span", {
          className: "cart-glass-cta",
          children: "Thanh to\xE1n"
        })]
      })]
    })
  });
}