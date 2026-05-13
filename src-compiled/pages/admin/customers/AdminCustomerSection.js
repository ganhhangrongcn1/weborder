import CustomerCRM from "./CustomerCRM.js";
import LoyaltySettings from "./LoyaltySettings.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminCustomerSection({
  customerAdminTab,
  setCustomerAdminTab,
  crmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  refreshCrm,
  adjustCustomerPoints,
  resetCustomerPoints,
  giftVoucherToCustomer,
  cancelCustomerVoucher,
  showCustomerTier,
  setCrmSnapshot,
  handleSaveLoyaltyRatio,
  coupons = []
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-stack",
    children: [/*#__PURE__*/_jsxs("section", {
      className: "admin-panel",
      children: [/*#__PURE__*/_jsx("div", {
        className: "admin-panel-head",
        children: /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h2", {
            children: "Kh\xE1ch h\xE0ng / CRM"
          }), /*#__PURE__*/_jsx("p", {
            children: "Qu\u1EA3n l\xFD d\u1EEF li\u1EC7u kh\xE1ch h\xE0ng, loyalty v\xE0 l\u1ECBch s\u1EED mua h\xE0ng."
          })]
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-menu-tabs",
        children: [/*#__PURE__*/_jsx("button", {
          type: "button",
          className: customerAdminTab === "crm" ? "active" : "",
          onClick: () => setCustomerAdminTab("crm"),
          children: "CRM"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: customerAdminTab === "loyalty" ? "active" : "",
          onClick: () => setCustomerAdminTab("loyalty"),
          children: "Qu\u1EA3n l\xFD t\xEDch \u0111i\u1EC3m"
        })]
      })]
    }), customerAdminTab === "crm" ? /*#__PURE__*/_jsx(CustomerCRM, {
      crmSnapshot: crmSnapshot,
      selectedCustomerPhone: selectedCustomerPhone,
      setSelectedCustomerPhone: setSelectedCustomerPhone,
      refreshCrm: refreshCrm,
      adjustCustomerPoints: adjustCustomerPoints,
      resetCustomerPoints: resetCustomerPoints,
      giftVoucherToCustomer: giftVoucherToCustomer,
      cancelCustomerVoucher: cancelCustomerVoucher,
      showCustomerTier: showCustomerTier,
      coupons: coupons
    }) : /*#__PURE__*/_jsx(LoyaltySettings, {
      crmSnapshot: crmSnapshot,
      setCrmSnapshot: setCrmSnapshot,
      onSave: handleSaveLoyaltyRatio
    })]
  });
}