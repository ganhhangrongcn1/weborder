import AppSectionTitle from "../../../components/app/SectionTitle.js";
import AppEmptyState from "../../../components/app/EmptyState.js";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.js";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.js";
import { getLoyaltySimpleGuestRows, getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SimpleRewardsView({
  navigate,
  isRegisteredCustomer,
  currencyPerPoint,
  pointPerUnit,
  demoLoyalty,
  userProfile
}) {
  const loyaltyText = getLoyaltyText();
  const pointHistory = Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : [];
  if (!isRegisteredCustomer) {
    return /*#__PURE__*/_jsxs("section", {
      className: "pb-6",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "reward-hero",
        children: [/*#__PURE__*/_jsx("h1", {
          children: loyaltyText.rewardHeroTitle
        }), /*#__PURE__*/_jsx("strong", {
          children: "--"
        }), /*#__PURE__*/_jsx("p", {
          children: loyaltyText.signedOutRewardMessage
        }), /*#__PURE__*/_jsxs("span", {
          children: [currencyPerPoint.toLocaleString("vi-VN"), "\u0111 = ", pointPerUnit, " \u0111i\u1EC3m"]
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => navigate("account", "account"),
          className: "mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft",
          children: loyaltyText.authCta
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "space-y-4 px-4 pt-4",
        children: /*#__PURE__*/_jsx(AppEmptyState, {
          icon: null,
          message: loyaltyText.signedOutPointHistoryMessage
        })
      })]
    });
  }
  return /*#__PURE__*/_jsxs("section", {
    className: "pb-6",
    children: [/*#__PURE__*/_jsx(LoyaltySummary, {
      title: loyaltyText.memberPointsTitle,
      pointsValue: (demoLoyalty?.totalPoints || userProfile?.points || 0).toLocaleString("vi-VN"),
      subtitle: loyaltyText.memberPointsSubtitle,
      ratioText: `${currencyPerPoint.toLocaleString("vi-VN")}đ = ${pointPerUnit} điểm`
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pt-4",
      children: [/*#__PURE__*/_jsx(PointsCard, {
        rows: getLoyaltySimpleGuestRows(currencyPerPoint, pointPerUnit)
      }), /*#__PURE__*/_jsx(AppSectionTitle, {
        title: loyaltyText.pointsHistoryTitle
      }), /*#__PURE__*/_jsxs("div", {
        className: "space-y-2",
        children: [pointHistory.slice(0, 10).map(entry => /*#__PURE__*/_jsxs("div", {
          className: "rounded-2xl bg-white px-4 py-3 text-sm shadow-soft",
          children: [/*#__PURE__*/_jsx("span", {
            className: "block text-brown",
            children: entry.title
          }), /*#__PURE__*/_jsxs("strong", {
            className: "text-orange-600",
            children: ["+", entry.points, " \u0111i\u1EC3m"]
          })]
        }, entry.id)), !pointHistory.length && /*#__PURE__*/_jsx(AppEmptyState, {
          icon: null,
          message: loyaltyText.noPointHistory
        })]
      })]
    })]
  });
}