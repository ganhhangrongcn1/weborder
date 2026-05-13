import Icon from "../../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AccountNoticeModal({
  notice,
  onClose
}) {
  if (!notice) return null;
  return /*#__PURE__*/_jsx("div", {
    className: "account-notice-backdrop",
    role: "presentation",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "account-notice-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": notice.title || "Thông báo",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsx("span", {
        className: "account-notice-icon",
        children: /*#__PURE__*/_jsx(Icon, {
          name: notice.icon || "warning",
          size: 22
        })
      }), /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("h2", {
          children: notice.title || "Thông báo"
        }), /*#__PURE__*/_jsx("p", {
          children: notice.message
        })]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: onClose,
        children: "\u0110\xE3 hi\u1EC3u"
      })]
    })
  });
}