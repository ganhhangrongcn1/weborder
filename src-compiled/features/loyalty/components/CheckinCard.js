import Icon from "../../../components/Icon.js";
import { getLoyaltyBonusDisplay, getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CheckinCard({
  loyalty,
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
  const loyaltyBonusDisplay = getLoyaltyBonusDisplay();
  return /*#__PURE__*/_jsxs("div", {
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
      }), /*#__PURE__*/_jsxs("span", {
        className: "streak-pill",
        children: [loyaltyText.streakPrefix, " ", loyalty.checkinStreak, " ", loyaltyText.streakUnit]
      })]
    }), comebackActive && /*#__PURE__*/_jsx("div", {
      className: "mt-3 rounded-2xl bg-orange-50 px-3 py-3 text-xs font-bold leading-5 text-orange-700",
      children: loyaltyText.comebackAlert(comebackStreak)
    }), /*#__PURE__*/_jsxs("div", {
      className: "mt-4 rounded-[22px] bg-cream/80 p-4",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "flex items-end justify-between gap-3",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("p", {
            className: "text-xs font-bold text-brown/55",
            children: nextMilestone ? loyaltyText.milestoneProgress(nextMilestone.days) : loyaltyText.milestoneDone
          }), /*#__PURE__*/_jsxs("strong", {
            className: "mt-1 block text-lg text-brown",
            children: [loyalty.checkinStreak, "/", nextMilestone?.days || 30, " ng\xE0y"]
          })]
        }), /*#__PURE__*/_jsx("span", {
          className: "text-sm font-black text-orange-600",
          children: nextMilestone ? `+${nextMilestone.points}` : loyaltyText.milestoneTop
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "mt-3 h-3 overflow-hidden rounded-full bg-white",
        children: /*#__PURE__*/_jsx("div", {
          className: "h-full rounded-full bg-gradient-main transition-all",
          style: {
            width: `${progressPercent}%`
          }
        })
      })]
    }), /*#__PURE__*/_jsx("button", {
      disabled: checkedInToday,
      onClick: handleCheckin,
      className: "checkin-btn",
      children: checkedInToday ? loyaltyText.checkedInToday : loyaltyText.checkinReward(checkinReward)
    }), /*#__PURE__*/_jsx("div", {
      className: "checkin-bonus-grid",
      children: loyaltyBonusDisplay.map(reward => {
        const received = loyalty.rewardHistory.includes(`milestone-${reward.days}`);
        const missing = Math.max(reward.days - loyalty.checkinStreak, 0);
        return /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsxs("span", {
            children: [reward.days, " ng\xE0y"]
          }), /*#__PURE__*/_jsx("strong", {
            children: received ? loyaltyText.bonusReceived : missing ? loyaltyText.bonusRemaining(missing) : `+${reward.points}`
          })]
        }, reward.days);
      })
    }), /*#__PURE__*/_jsx("div", {
      className: "mt-4 grid grid-cols-7 gap-2",
      children: recentDays.map(day => {
        const checked = loyalty.checkinHistory.includes(day);
        const isToday = day === today;
        return /*#__PURE__*/_jsxs("div", {
          className: `rounded-2xl border px-1 py-2 text-center text-[10px] font-black ${isToday ? "border-orange-400 bg-orange-50 text-orange-600" : "border-brown/5 bg-white text-brown/45"}`,
          children: [/*#__PURE__*/_jsx("span", {
            className: "block",
            children: day.slice(5).replace("-", "/")
          }), /*#__PURE__*/_jsx("span", {
            className: `mx-auto mt-1 grid h-5 w-5 place-items-center rounded-full ${checked ? "bg-green-500 text-white" : "bg-cream text-brown/30"}`,
            children: checked ? "✓" : "•"
          })]
        }, day);
      })
    })]
  });
}