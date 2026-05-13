import Icon from "../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminSidebar({
  navGroups,
  navIconMap,
  activeAdminNav,
  onActivateNav
}) {
  return /*#__PURE__*/_jsxs("aside", {
    className: "admin-sidebar",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-brand",
      children: [/*#__PURE__*/_jsx("span", {
        children: "GHR"
      }), /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("strong", {
          children: "G\xE1nh H\xE0ng Rong"
        }), /*#__PURE__*/_jsx("small", {
          children: "Admin Console"
        })]
      })]
    }), navGroups.map(group => /*#__PURE__*/_jsxs("div", {
      className: "admin-nav-group",
      children: [/*#__PURE__*/_jsx("p", {
        className: "admin-nav-group-title",
        children: group.title
      }), /*#__PURE__*/_jsx("div", {
        className: "grid gap-1",
        children: group.items.map(item => /*#__PURE__*/_jsxs("button", {
          type: "button",
          className: `rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeAdminNav === item.id ? "active" : ""}`,
          onClick: () => onActivateNav(item),
          children: [/*#__PURE__*/_jsx(Icon, {
            name: navIconMap[item.id] || "star",
            size: 16
          }), item.label]
        }, item.id))
      })]
    }, group.title))]
  });
}