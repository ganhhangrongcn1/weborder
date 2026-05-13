import Icon from "../../../components/Icon.js";
import AppSectionTitle from "../../../components/app/SectionTitle.js";
import AppEmptyState from "../../../components/app/EmptyState.js";
import { getLoyaltyRulesRows, getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function GuestLoyaltyView({
  navigate,
  loyaltyBonusDisplay
}) {
  const loyaltyText = getLoyaltyText();
  const loyaltyRulesRows = Array.isArray(getLoyaltyRulesRows()) ? getLoyaltyRulesRows() : [];
  const safeBonusDisplay = Array.isArray(loyaltyBonusDisplay) ? loyaltyBonusDisplay : [];
  return /*#__PURE__*/_jsxs("section", {
    className: "pb-6",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "reward-hero",
      children: [/*#__PURE__*/_jsx("div", {
        className: "flex items-center justify-between",
        children: /*#__PURE__*/_jsx("h1", {
          children: loyaltyText.rewardHeroSignedOutTitle
        })
      }), /*#__PURE__*/_jsx("strong", {
        children: "--"
      }), /*#__PURE__*/_jsxs("p", {
        children: [/*#__PURE__*/_jsx(Icon, {
          name: "star",
          size: 14
        }), " ", loyaltyText.signedOutMessage]
      }), /*#__PURE__*/_jsxs("span", {
        children: [loyaltyText.ratioPrefix, loyaltyText.ratioFixed]
      }), /*#__PURE__*/_jsx("button", {
        onClick: () => navigate("account", "account"),
        className: "mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft",
        children: loyaltyText.authCta
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pt-4",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "checkin-card",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center justify-between gap-3",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "flex items-center gap-2",
            children: [/*#__PURE__*/_jsx("span", {
              className: "reward-icon",
              children: /*#__PURE__*/_jsx(Icon, {
                name: "gift",
                size: 17
              })
            }), /*#__PURE__*/_jsx("h2", {
              children: loyaltyText.checkinTitle
            })]
          }), /*#__PURE__*/_jsx("span", {
            className: "streak-pill",
            children: loyaltyText.signedOutCheckinHint
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "mt-4 rounded-[22px] bg-cream/80 p-4",
          children: [/*#__PURE__*/_jsx("p", {
            className: "text-sm font-bold leading-6 text-brown/65",
            children: loyaltyText.signedOutCheckinDetail
          }), /*#__PURE__*/_jsx("div", {
            className: "mt-3 h-3 overflow-hidden rounded-full bg-white",
            children: /*#__PURE__*/_jsx("div", {
              className: "h-full w-0 rounded-full bg-gradient-main"
            })
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => navigate("account", "account"),
          className: "checkin-btn",
          children: loyaltyText.checkinLoginHint
        }), /*#__PURE__*/_jsx("div", {
          className: "checkin-bonus-grid opacity-60",
          children: safeBonusDisplay.map(reward => /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsxs("span", {
              children: [reward.days, " ng\xE0y"]
            }), /*#__PURE__*/_jsx("strong", {
              children: loyaltyText.bonusOpenAfterLogin
            })]
          }, reward.days))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "checkin-card",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/_jsx("span", {
            className: "reward-icon green",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "star",
              size: 17
            })
          }), /*#__PURE__*/_jsx("h2", {
            children: "Quy \u0111\u1ECBnh \u0111i\u1EC3m th\u01B0\u1EDFng"
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "reward-rules",
          children: loyaltyRulesRows.map(row => /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: row.label
            }), /*#__PURE__*/_jsx("strong", {
              children: row.value
            })]
          }, row.label))
        })]
      }), /*#__PURE__*/_jsx(AppSectionTitle, {
        title: loyaltyText.luckyGiftTitle
      }), /*#__PURE__*/_jsx(AppEmptyState, {
        icon: null,
        message: loyaltyText.signedOutLuckyMessage
      }), /*#__PURE__*/_jsx(AppSectionTitle, {
        title: loyaltyText.pointsHistoryTitle
      }), /*#__PURE__*/_jsx(AppEmptyState, {
        icon: null,
        message: loyaltyText.signedOutHistoryMessage
      })]
    })]
  });
}