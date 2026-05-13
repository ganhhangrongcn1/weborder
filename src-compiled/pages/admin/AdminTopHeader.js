import Icon from "../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function AdminTopHeader({
  adminGlobalSearch,
  setAdminGlobalSearch,
  selectedBranchFilter,
  setSelectedBranchFilter,
  branches,
  syncStatusLabel,
  adminEmail = "",
  onLogout = null
}) {
  return /*#__PURE__*/_jsxs("header", {
    className: "admin-top-header",
    children: [/*#__PURE__*/_jsx("div", {
      className: "admin-top-header-left",
      children: /*#__PURE__*/_jsxs("label", {
        className: "admin-top-search",
        children: [/*#__PURE__*/_jsx(Icon, {
          name: "search",
          size: 16
        }), /*#__PURE__*/_jsx("input", {
          value: adminGlobalSearch,
          onChange: event => setAdminGlobalSearch(event.target.value),
          placeholder: "Tìm nhanh đơn hàng, khách hàng, món..."
        })]
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-top-header-right",
      children: [/*#__PURE__*/_jsx("span", {
        className: "admin-top-sync-badge",
        children: syncStatusLabel
      }), /*#__PURE__*/_jsxs("select", {
        className: "admin-top-branch",
        value: selectedBranchFilter,
        onChange: event => setSelectedBranchFilter(event.target.value),
        children: [/*#__PURE__*/_jsx("option", {
          value: "all",
          children: "Tất cả chi nhánh"
        }), branches.map(branch => /*#__PURE__*/_jsx("option", {
          value: branch.id,
          children: branch.name
        }, branch.id))]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "admin-top-icon-btn",
        "aria-label": "Thông báo",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "bell",
          size: 17
        })
      }), onLogout ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-top-logout-btn",
          onClick: onLogout,
          children: "\u0110\u0103ng xu\u1EA5t"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-top-avatar",
          "aria-label": "Tài khoản admin",
          children: String(adminEmail || "Admin").slice(0, 2).toUpperCase()
        })]
      }) : /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "admin-top-avatar",
        "aria-label": "Tài khoản admin",
        children: "QA"
      })]
    })]
  });
}