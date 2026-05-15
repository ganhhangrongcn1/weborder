import AdminOrdersCrmSection from "../AdminOrdersCrmSection.js";
import { AdminInput, AdminSelect } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function AdminOrdersPage({
  ordersSnapshot,
  setOrdersSnapshot,
  onOrderUpdated,
  crmSnapshot,
  setCrmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  onAdjustPoints,
  onResetPoints,
  onGiftVoucher,
  orderStorage,
  branches = [],
  ordersDateFrom,
  setOrdersDateFrom,
  ordersDateTo,
  setOrdersDateTo,
  ordersDatePreset,
  setOrdersDatePreset
}) {
  const todayText = new Date().toISOString().slice(0, "10");
  const applyPreset = preset => {
    const now = new Date();
    const toDateText = date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    if (preset === "today") {
      const value = toDateText(now);
      setOrdersDateFrom(value);
      setOrdersDateTo(value);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const value = toDateText(yesterday);
      setOrdersDateFrom(value);
      setOrdersDateTo(value);
    }
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      setOrdersDateFrom(toDateText(monday));
      setOrdersDateTo(toDateText(now));
    }
    if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setOrdersDateFrom(toDateText(firstDay));
      setOrdersDateTo(toDateText(now));
    }
    setOrdersDatePreset(preset);
  };
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-toolbar",
      style: {
        marginBottom: 12
      },
      children: [/*#__PURE__*/_jsxs("label", {
        className: "admin-dashboard-search admin-dashboard-preset",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\uD83D\uDDC2"
        }), /*#__PURE__*/_jsx(AdminSelect, {
          value: ordersDatePreset || "today",
          onChange: event => {
            const nextPreset = event.target.value;
            if (nextPreset === "custom") {
              setOrdersDatePreset("custom");
              return;
            }
            applyPreset(nextPreset);
          },
          options: [{
            value: "today",
            label: "Hôm nay"
          }, {
            value: "yesterday",
            label: "Hôm qua"
          }, {
            value: "week",
            label: "Tuần này"
          }, {
            value: "month",
            label: "Tháng này"
          }, {
            value: "custom",
            label: "Tùy chỉnh..."
          }]
        })]
      }), ordersDatePreset === "custom" ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs("label", {
          className: "admin-dashboard-search",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\uD83D\uDCC5"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "date",
            value: ordersDateFrom || "",
            max: ordersDateTo || todayText,
            onChange: event => {
              setOrdersDateFrom(event.target.value);
              setOrdersDatePreset("custom");
            }
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-dashboard-search",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\uD83D\uDCC5"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "date",
            value: ordersDateTo || "",
            min: ordersDateFrom || "",
            max: todayText,
            onChange: event => {
              setOrdersDateTo(event.target.value);
              setOrdersDatePreset("custom");
            }
          })]
        })]
      }) : null]
    }), /*#__PURE__*/_jsx(AdminOrdersCrmSection, {
      section: "orders",
      customerAdminTab: "crm",
      setCustomerAdminTab: () => {},
      ordersSnapshot: ordersSnapshot,
      setOrdersSnapshot: setOrdersSnapshot,
      onOrderUpdated: onOrderUpdated,
      crmSnapshot: crmSnapshot,
      setCrmSnapshot: setCrmSnapshot,
      selectedCustomerPhone: selectedCustomerPhone,
      setSelectedCustomerPhone: setSelectedCustomerPhone,
      onAdjustPoints: onAdjustPoints,
      onResetPoints: onResetPoints,
      onGiftVoucher: onGiftVoucher,
      orderStorage: orderStorage,
      branches: branches,
      ordersDateFrom: ordersDateFrom,
      setOrdersDateFrom: setOrdersDateFrom,
      ordersDateTo: ordersDateTo,
      setOrdersDateTo: setOrdersDateTo,
      ordersDatePreset: ordersDatePreset,
      setOrdersDatePreset: setOrdersDatePreset
    })]
  });
}