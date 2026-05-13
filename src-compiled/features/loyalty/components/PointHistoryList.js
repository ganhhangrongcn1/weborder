import AppEmptyState from "../../../components/app/EmptyState.js";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PointHistoryList({
  entries,
  limit = 5
}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const visibleEntries = safeEntries.slice(0, limit);
  const loyaltyText = getLoyaltyText();
  return /*#__PURE__*/_jsxs("div", {
    className: "space-y-2",
    children: [visibleEntries.map(entry => /*#__PURE__*/_jsxs("div", {
      className: "rounded-2xl bg-white px-4 py-3 text-sm shadow-soft",
      children: [/*#__PURE__*/_jsx("span", {
        className: "block text-brown",
        children: entry.title
      }), /*#__PURE__*/_jsxs("strong", {
        className: "text-orange-600",
        children: ["+", entry.points, " \u0111i\u1EC3m"]
      })]
    }, entry.id)), !safeEntries.length && /*#__PURE__*/_jsx(AppEmptyState, {
      icon: null,
      message: loyaltyText.noPointHistory
    })]
  });
}