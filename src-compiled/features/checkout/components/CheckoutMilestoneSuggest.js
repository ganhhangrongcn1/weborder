import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { products as productSeed } from "../../../data/products.js";
import { freeshipMinSubtotal } from "../../../constants/storeConfig.js";
import { formatMoney } from "../../../utils/format.js";
import CheckoutCard from "./CheckoutCard.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const suggestText = {
  title: "Gợi ý đạt ưu đãi",
  nearLabel: "Sắp đạt ưu đãi",
  doneLabel: "Đã đạt ưu đãi",
  addMore: "Thêm",
  toGet: "để nhận",
  reached: "Bạn đã đạt mốc",
  toppingTitle: "Topping thêm",
  quickAdd: "Chọn nhanh",
  mainTitle: "Món chính",
  chooseMore: "Chọn thêm món",
  addonSpice: "Thêm cho đủ vị",
  defaultSpice: "Vừa cay",
  freeshipTitle: "Freeship",
  addonShort: "Topping riêng từ mục Thêm cho đủ vị.",
  addonDescription: "Món thêm giúp đơn đủ vị hơn."
};
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
export default function CheckoutMilestoneSuggest({
  subtotal,
  addToCart,
  openOptionModal,
  products = [],
  toppings = [],
  coupons = [],
  smartPromotions = []
}) {
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const showMilestoneBox = true;
  const couponMilestones = coupons.filter(coupon => coupon && coupon.active !== false && String(coupon.voucherType || "checkout") !== "loyalty").filter(coupon => isDateInRange(coupon.startAt, coupon.endAt || coupon.expiry)).map(coupon => ({
    amount: Number(coupon.minOrder || 0),
    title: `Mã ${coupon.code || coupon.id || ""}`.trim(),
    reward: `Giảm ${formatMoney(Number(coupon.value || 0))}`,
    sourceType: "coupon"
  }));
  const promotionMilestones = smartPromotions.filter(promotion => promotion && promotion.active !== false).filter(promotion => isDateInRange(promotion.startAt, promotion.endAt)).filter(promotion => Number(promotion?.condition?.minSubtotal || 0) > 0).filter(promotion => promotion?.type !== "free_shipping" && promotion?.reward?.type !== "shipping_discount").filter(promotion => promotion?.type !== "coupon_hint").map(promotion => {
    const minSubtotal = Number(promotion.condition.minSubtotal || 0);
    const rewardType = promotion?.reward?.type;
    const rewardValue = Number(promotion?.reward?.value || 0);
    const giftProduct = rewardType === "gift" ? products.find(item => item?.id === promotion?.reward?.productId && item?.visible !== false) : null;
    const rewardText = rewardType === "shipping_discount" ? `Giảm ship ${formatMoney(rewardValue)}` : rewardType === "percent_discount" ? `Giảm ${rewardValue}%` : rewardType === "voucher" ? "Nhận voucher" : rewardType === "gift" ? giftProduct ? `Tặng ${giftProduct.name}` : "Nhận quà tặng" : "Ưu đãi";
    return {
      amount: minSubtotal,
      title: promotion.name || "Ưu đãi",
      reward: rewardText,
      sourceType: "promotion"
    };
  });
  const freeShipPromotion = (smartPromotions || []).filter(promotion => promotion && promotion.active !== false).filter(promotion => isDateInRange(promotion.startAt, promotion.endAt)).filter(promotion => promotion?.type === "free_shipping" || promotion?.reward?.type === "shipping_discount").sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99))[0];
  const freeShipMilestone = freeShipPromotion ? {
    amount: Number(freeShipPromotion?.condition?.minSubtotal || freeshipMinSubtotal),
    title: suggestText.freeshipTitle,
    reward: `Đơn món từ ${formatMoney(Number(freeShipPromotion?.condition?.minSubtotal || freeshipMinSubtotal))} miễn phí giao hàng`,
    sourceType: "promotion"
  } : null;
  const milestones = useMemo(() => {
    const mergedMilestones = [freeShipMilestone, ...couponMilestones, ...promotionMilestones].filter(Boolean);
    return mergedMilestones.filter(item => Number(item.amount) >= 0).sort((a, b) => Number(a.amount) - Number(b.amount)).filter((item, index, list) => list.findIndex(other => Number(other.amount) === Number(item.amount) && String(other.title) === String(item.title)) === index);
  }, [couponMilestones, freeShipMilestone, promotionMilestones]);
  const progressMilestones = milestones.filter(item => Number(item.amount) > 0);
  const nextMilestone = progressMilestones.find(milestone => subtotal < milestone.amount) || progressMilestones[progressMilestones.length - 1] || milestones[0] || {
    amount: 0,
    title: "",
    reward: ""
  };
  const missing = Math.max(Number(nextMilestone.amount || 0) - subtotal, 0);
  const progress = nextMilestone.amount > 0 ? Math.min(subtotal / nextMilestone.amount * 100, 100) : 0;
  const mainSuggestions = products.filter(product => product.visible !== false && product.price <= Math.max(missing + 35000, 45000)).sort((first, second) => Number(second.price) - Number(first.price)).slice(0, 8);
  const toppingSuggestions = [...toppings].sort((first, second) => Number(second.price) - Number(first.price)).slice(0, 8);
  const toppingBaseProduct = products.find(product => product.visible !== false) || products[0];
  const makeAddonProduct = topping => ({
    id: `addon-${topping.id}`,
    name: topping.name,
    short: topping.description || suggestText.addonShort,
    description: topping.description || suggestText.addonDescription,
    price: Number(topping.price) || 0,
    category: suggestText.addonSpice,
    badge: "Topping",
    rating: 4.9,
    reviews: "120",
    sold: "1.000+",
    image: topping.image || toppingBaseProduct?.image || productSeed[0].image
  });
  return /*#__PURE__*/_jsxs(CheckoutCard, {
    title: suggestText.title,
    children: [showMilestoneBox && /*#__PURE__*/_jsxs("button", {
      type: "button",
      onClick: () => setIsMilestoneModalOpen(true),
      className: "milestone-box milestone-box-v2 w-full text-left",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "milestone-copy",
        children: [/*#__PURE__*/_jsx("span", {
          children: missing > 0 ? suggestText.nearLabel : suggestText.doneLabel
        }), /*#__PURE__*/_jsx("strong", {
          children: missing > 0 ? `${suggestText.addMore} ${formatMoney(missing)} ${suggestText.toGet} ${nextMilestone.title}` : `${suggestText.reached} ${nextMilestone.title}`
        }), /*#__PURE__*/_jsx("small", {
          children: nextMilestone.reward
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "milestone-gift",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "gift",
          size: 18
        })
      }), /*#__PURE__*/_jsx("div", {
        className: "milestone-track",
        children: /*#__PURE__*/_jsx("div", {
          style: {
            width: `${progress}%`
          }
        })
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "suggestion-section suggestion-section-v2",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "suggestion-row-title",
        children: [/*#__PURE__*/_jsx("strong", {
          children: suggestText.toppingTitle
        }), /*#__PURE__*/_jsx("span", {
          children: suggestText.quickAdd
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "no-scrollbar suggestion-slider suggestion-slider-v2",
        children: toppingSuggestions.map(topping => /*#__PURE__*/_jsxs("button", {
          type: "button",
          onClick: () => addToCart({
            product: makeAddonProduct(topping),
            spice: suggestText.addonSpice,
            toppings: [],
            note: "",
            quantity: 1
          }),
          className: "suggestion-chip suggestion-chip-v2",
          children: [/*#__PURE__*/_jsx("span", {
            children: topping.name
          }), /*#__PURE__*/_jsxs("strong", {
            children: ["+", formatMoney(topping.price)]
          })]
        }, topping.id))
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "suggestion-section suggestion-section-v2",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "suggestion-row-title",
        children: [/*#__PURE__*/_jsx("strong", {
          children: suggestText.mainTitle
        }), /*#__PURE__*/_jsx("span", {
          children: suggestText.chooseMore
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "no-scrollbar suggestion-slider suggestion-slider-v2 main-suggest-slider",
        children: mainSuggestions.map(product => /*#__PURE__*/_jsxs("button", {
          type: "button",
          onClick: () => openOptionModal(product),
          className: "suggestion-chip suggestion-chip-v2 suggestion-main-chip",
          children: [/*#__PURE__*/_jsx("img", {
            src: product.image,
            alt: product.name
          }), /*#__PURE__*/_jsx("span", {
            children: product.name
          }), /*#__PURE__*/_jsxs("strong", {
            children: ["+", formatMoney(product.price)]
          })]
        }, product.id))
      })]
    }), isMilestoneModalOpen && /*#__PURE__*/createPortal(/*#__PURE__*/_jsx(CustomerBottomSheet, {
      title: "C\xE1c m\u1ED1c \u01B0u \u0111\xE3i \u0111ang \xE1p d\u1EE5ng",
      subtitle: "T\u1EF1 \u0111\u1ED9ng c\u1EADp nh\u1EADt t\u1EEB c\u1EA5u h\xECnh khuy\u1EBFn m\xE3i b\xEAn admin.",
      ariaLabel: "M\u1ED1c \u01B0u \u0111\xE3i",
      onClose: () => setIsMilestoneModalOpen(false),
      className: "promo-sheet",
      children: /*#__PURE__*/_jsx("div", {
        className: "space-y-2",
        children: milestones.map((item, index) => {
          const reached = subtotal >= Number(item.amount || 0);
          const statusText = reached ? item.sourceType === "coupon" ? "Có thể áp dụng" : "Đã đạt mốc" : `Còn ${formatMoney(Math.max(Number(item.amount || 0) - subtotal, 0))}`;
          return /*#__PURE__*/_jsxs("div", {
            className: `milestone-modal-item rounded-2xl border px-3 py-2 ${reached ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"}`,
            children: [/*#__PURE__*/_jsxs("div", {
              className: "flex items-center justify-between gap-2",
              children: [/*#__PURE__*/_jsx("strong", {
                className: "text-sm font-black text-brown",
                children: item.title
              }), /*#__PURE__*/_jsx("span", {
                className: `rounded-full px-2 py-1 text-[11px] font-bold ${reached ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`,
                children: statusText
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-xs text-brown/70",
              children: item.reward
            }), /*#__PURE__*/_jsxs("p", {
              className: "mt-1 text-xs font-semibold text-brown/60",
              children: ["M\u1ED1c \u0111\u01A1n: ", formatMoney(item.amount)]
            })]
          }, `${item.title}-${item.amount}-${index}`);
        })
      })
    }), document.body)]
  });
}