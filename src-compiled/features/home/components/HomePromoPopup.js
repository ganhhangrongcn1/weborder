import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function HomePromoPopup({
  open,
  popup,
  onClose,
  onClickPopup
}) {
  if (!open || !popup) return null;
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    ariaLabel: popup.title || "Popup khuyến mãi",
    onClose: onClose,
    backdropClassName: "home-popup-backdrop",
    className: "home-popup-sheet",
    contentClassName: "home-popup-sheet-scroll",
    showHeader: false,
    showHandle: false,
    children: /*#__PURE__*/_jsxs("section", {
      className: "home-popup-image-only",
      children: [/*#__PURE__*/_jsx("button", {
        type: "button",
        className: "home-popup-close",
        onClick: onClose,
        children: "\xD7"
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "home-popup-image-wrap",
        onClick: onClickPopup,
        children: /*#__PURE__*/_jsx("img", {
          src: popup.image,
          alt: popup.title || "Popup",
          className: "home-popup-image"
        })
      })]
    })
  });
}