import Icon from "./Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const items = [{
  id: "home",
  label: "Trang chủ",
  icon: "home"
}, {
  id: "menu",
  label: "Menu",
  icon: "menu"
}, {
  id: "orders",
  label: "Đơn hàng",
  icon: "bag"
}, {
  id: "rewards",
  label: "Ưu đãi & Tích điểm",
  icon: "gift"
}, {
  id: "account",
  label: "Tài khoản",
  icon: "user"
}];
export default function BottomNav({
  activeTab,
  onChange
}) {
  return /*#__PURE__*/_jsx("nav", {
    className: "customer-bottom-nav",
    children: items.map(item => /*#__PURE__*/_jsxs("button", {
      type: "button",
      onClick: () => onChange(item.id),
      className: `customer-bottom-nav__item ${activeTab === item.id ? "customer-bottom-nav__item--active" : ""}`,
      children: [/*#__PURE__*/_jsx("span", {
        className: `customer-bottom-nav__icon ${activeTab === item.id ? "customer-bottom-nav__icon--active" : ""}`,
        children: /*#__PURE__*/_jsx(Icon, {
          name: item.icon,
          size: 18
        })
      }), /*#__PURE__*/_jsx("span", {
        children: item.label
      })]
    }, item.id))
  });
}