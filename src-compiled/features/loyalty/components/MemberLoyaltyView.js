import { useMemo, useState } from "react";
import AppSectionTitle from "../../../components/app/SectionTitle.js";
import AppEmptyState from "../../../components/app/EmptyState.js";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.js";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.js";
import CouponList from "../../../pages/customer/loyalty/CouponList.js";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";
import { getLoyaltyRulesRows, getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import LuckyVoucherModal from "./LuckyVoucherModal.js";
import CheckinCard from "./CheckinCard.js";
import PointHistoryList from "./PointHistoryList.js";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function MemberLoyaltyView({
  loyalty,
  userProfile,
  luckyVoucher,
  setLuckyVoucher,
  today,
  checkedInToday,
  comebackStreak,
  comebackActive,
  checkinReward,
  nextMilestone,
  progressPercent,
  recentDays,
  handleCheckin
}) {
  const loyaltyText = getLoyaltyText();
  const loyaltyRulesRows = Array.isArray(getLoyaltyRulesRows()) ? getLoyaltyRulesRows() : [];
  const safePointHistory = Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : [];
  const safeVoucherHistory = Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : [];
  const shouldShowVoucherSection = rewardFeatureFlags.enableLuckyDraw || safeVoucherHistory.length > 0;
  const [voucherExpanded, setVoucherExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const voucherHeader = useMemo(() => {
    const total = safeVoucherHistory.length;
    return total > 0 ? `Voucher của bạn (${total})` : "Voucher của bạn";
  }, [safeVoucherHistory.length]);
  const historyHeader = useMemo(() => {
    const total = safePointHistory.length;
    return total > 0 ? `Lịch sử tích điểm (${total})` : "Lịch sử tích điểm";
  }, [safePointHistory.length]);
  return /*#__PURE__*/_jsxs("section", {
    className: "pb-6",
    children: [/*#__PURE__*/_jsx(LoyaltySummary, {
      title: loyaltyText.memberPointsTitle,
      pointsValue: loyalty.totalPoints.toLocaleString("vi-VN"),
      subtitle: loyaltyText.memberPointsSubtitle,
      ratioText: `${loyaltyText.ratioPrefix}${loyaltyText.ratioFixed}`
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pt-4",
      children: [/*#__PURE__*/_jsx(CheckinCard, {
        loyalty: loyalty,
        today: today,
        checkedInToday: checkedInToday,
        comebackStreak: comebackStreak,
        comebackActive: comebackActive,
        checkinReward: checkinReward,
        nextMilestone: nextMilestone,
        progressPercent: progressPercent,
        recentDays: recentDays,
        handleCheckin: handleCheckin
      }), /*#__PURE__*/_jsx(PointsCard, {
        rows: loyaltyRulesRows
      }), shouldShowVoucherSection ? /*#__PURE__*/_jsx(_Fragment, {
        children: /*#__PURE__*/_jsxs("div", {
          className: "rounded-2xl bg-white px-4 py-3 shadow-soft",
          children: [/*#__PURE__*/_jsxs("button", {
            type: "button",
            className: "flex w-full items-center justify-between text-left",
            onClick: () => setVoucherExpanded(prev => !prev),
            children: [/*#__PURE__*/_jsx("span", {
              className: "text-sm font-black text-brown",
              children: voucherHeader
            }), /*#__PURE__*/_jsx("span", {
              className: "text-xs font-bold text-orange-600",
              children: voucherExpanded ? "Thu gọn" : "Xem"
            })]
          }), voucherExpanded ? /*#__PURE__*/_jsx("div", {
            className: "mt-3",
            children: /*#__PURE__*/_jsx(CouponList, {
              vouchers: safeVoucherHistory,
              isVoucherExpired: isVoucherExpired,
              EmptyState: /*#__PURE__*/_jsx(AppEmptyState, {
                icon: null,
                message: "Ch\u01B0a c\xF3 voucher"
              })
            })
          }) : null]
        })
      }) : null, /*#__PURE__*/_jsxs("div", {
        className: "rounded-2xl bg-white px-4 py-3 shadow-soft",
        children: [/*#__PURE__*/_jsxs("button", {
          type: "button",
          className: "flex w-full items-center justify-between text-left",
          onClick: () => setHistoryExpanded(prev => !prev),
          children: [/*#__PURE__*/_jsx("span", {
            className: "text-sm font-black text-brown",
            children: historyHeader
          }), /*#__PURE__*/_jsx("span", {
            className: "text-xs font-bold text-orange-600",
            children: historyExpanded ? "Thu gọn" : "Xem"
          })]
        }), historyExpanded ? /*#__PURE__*/_jsx("div", {
          className: "mt-3",
          children: /*#__PURE__*/_jsx(PointHistoryList, {
            entries: safePointHistory
          })
        }) : null]
      })]
    }), rewardFeatureFlags.enableLuckyDraw ? /*#__PURE__*/_jsx(LuckyVoucherModal, {
      luckyVoucher: luckyVoucher,
      onClose: () => setLuckyVoucher(null)
    }) : null]
  });
}