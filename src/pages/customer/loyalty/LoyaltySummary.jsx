import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function LoyaltySummary({
  title,
  pointsValue,
  subtitle,
  ratioText,
  actionLabel,
  onAction,
  ctaLabel,
  onCta
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "reward-hero",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/_jsx("h1", {
        children: title
      }), actionLabel && onAction && /*#__PURE__*/_jsx("button", {
        onClick: onAction,
        children: actionLabel
      })]
    }), /*#__PURE__*/_jsx("strong", {
      children: pointsValue
    }), /*#__PURE__*/_jsx("p", {
      children: subtitle
    }), /*#__PURE__*/_jsx("span", {
      children: ratioText
    }), ctaLabel && onCta && /*#__PURE__*/_jsx("button", {
      onClick: onCta,
      className: "mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft",
      children: ctaLabel
    })]
  });
}
