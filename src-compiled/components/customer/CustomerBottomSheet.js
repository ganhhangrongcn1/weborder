import { useEffect } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
let openSheetCount = 0;
function lockBodyScroll() {
  openSheetCount += 1;
  if (openSheetCount !== 1) return;
  document.documentElement.classList.add("customer-sheet-open");
  document.body.classList.add("customer-sheet-open");
}
function unlockBodyScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount !== 0) return;
  document.documentElement.classList.remove("customer-sheet-open");
  document.body.classList.remove("customer-sheet-open");
}
export default function CustomerBottomSheet({
  children,
  title,
  subtitle,
  ariaLabel,
  onClose,
  closeOnBackdrop = true,
  backdropClassName = "",
  className = "",
  contentClassName = "",
  footer = null,
  showHeader = true,
  showHandle = true
}) {
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);
  function handleBackdropClick(event) {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose?.(event);
  }
  return /*#__PURE__*/_jsx("div", {
    className: `customer-sheet-backdrop ${backdropClassName}`.trim(),
    onClick: handleBackdropClick,
    children: /*#__PURE__*/_jsxs("section", {
      className: `customer-bottom-sheet ${className}`.trim(),
      onClick: event => event.stopPropagation(),
      role: "dialog",
      "aria-modal": "true",
      "aria-label": ariaLabel || title || "Hộp thoại",
      children: [showHandle ? /*#__PURE__*/_jsx("div", {
        className: "customer-sheet-handle"
      }) : null, showHeader ? /*#__PURE__*/_jsxs("div", {
        className: "customer-sheet-header",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "customer-sheet-title",
          children: [title ? /*#__PURE__*/_jsx("h2", {
            children: title
          }) : null, subtitle ? /*#__PURE__*/_jsx("p", {
            children: subtitle
          }) : null]
        }), onClose ? /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "customer-sheet-close",
          onClick: onClose,
          "aria-label": "\u0110\xF3ng",
          children: "X"
        }) : null]
      }) : null, /*#__PURE__*/_jsx("div", {
        className: `customer-sheet-scroll ${contentClassName}`.trim(),
        children: children
      }), footer ? /*#__PURE__*/_jsx("div", {
        className: "customer-sheet-footer",
        children: footer
      }) : null]
    })
  });
}