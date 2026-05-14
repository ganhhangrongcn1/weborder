import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ZALO_TEMPLATE, renderZaloTemplate } from "../../../services/zaloService.js";
import { AdminButton, AdminInput, AdminPanel } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const PREVIEW_MESSAGE = renderZaloTemplate(DEFAULT_ZALO_TEMPLATE, {
  customer_name: "Khách ví dụ",
  phone: "09xx xxx xxx",
  items: "- Bánh tráng trộn ví dụ x1: 35.000đ",
  total: "54.000đ",
  address: "Địa chỉ giao hàng ví dụ",
  note: "Ghi chú ví dụ",
  order_code: "GHR-0000",
  order_time: "01/01/2026 12:00",
  fulfillment_type: "Giao tận nơi",
  map_link: "https://maps.google.com/...",
  shipping_fee: "19.000đ",
  order_link: "https://ganhhangrong.vn/orders?orderCode=GHR-0000"
});
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
export default function ZaloSettings({
  zaloConfig,
  setZaloConfig,
  onSave
}) {
  const [draftPhone, setDraftPhone] = useState(() => normalizePhone(zaloConfig?.phone));
  useEffect(() => {
    setDraftPhone(normalizePhone(zaloConfig?.phone));
  }, [zaloConfig?.phone]);
  const savedPhone = normalizePhone(zaloConfig?.phone);
  const hasChanges = useMemo(() => draftPhone !== savedPhone, [draftPhone, savedPhone]);
  const handleSave = () => {
    const nextConfig = {
      phone: draftPhone,
      template: DEFAULT_ZALO_TEMPLATE
    };
    setZaloConfig(nextConfig);
    onSave(nextConfig);
  };
  return /*#__PURE__*/_jsx(AdminPanel, {
    className: "admin-store-panel",
    title: "C\u1EA5u h\xECnh Zalo nh\u1EADn \u0111\u01A1n",
    action: /*#__PURE__*/_jsx(AdminButton, {
      variant: hasChanges ? "primary" : "secondary",
      className: !hasChanges ? "opacity-70 cursor-not-allowed" : "",
      disabled: !hasChanges,
      onClick: handleSave,
      children: "L\u01B0u thay \u0111\u1ED5i"
    }),
    children: /*#__PURE__*/_jsxs("div", {
      className: "admin-mini-grid admin-ui-panel-body",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i Zalo nh\u1EADn \u0111\u01A1n"
        }), /*#__PURE__*/_jsx(AdminInput, {
          value: draftPhone,
          onChange: event => setDraftPhone(normalizePhone(event.target.value)),
          placeholder: "V\xED d\u1EE5: 0788422424"
        }), /*#__PURE__*/_jsx("small", {
          children: "D\xF9ng s\u1ED1 d\u1EA1ng 09... ho\u1EB7c 03... kh\xF4ng nh\u1EADp kho\u1EA3ng tr\u1EAFng."
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Xem tr\u01B0\u1EDBc tin nh\u1EAFn kh\xE1ch s\u1EBD g\u1EEDi"
        }), /*#__PURE__*/_jsx("pre", {
          className: "mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700",
          children: PREVIEW_MESSAGE
        }), /*#__PURE__*/_jsx("small", {
          children: "Th\xF4ng tin kh\xE1ch trong khung n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c che. N\u1ED9i dung th\u1EADt s\u1EBD t\u1EF1 t\u1EA1o theo \u0111\u01A1n h\xE0ng, admin kh\xF4ng c\u1EA7n ch\u1EC9nh m\u1EABu."
        })]
      })]
    })
  });
}