import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ZALO_TEMPLATE } from "../../../services/zaloService.js";
import { AdminButton, AdminInput, AdminPanel, AdminTextarea } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ZaloSettings({
  zaloConfig,
  setZaloConfig,
  onSave
}) {
  const [draftConfig, setDraftConfig] = useState(() => ({
    ...(zaloConfig || {})
  }));
  useEffect(() => {
    setDraftConfig({
      ...(zaloConfig || {})
    });
  }, [zaloConfig]);
  const hasChanges = useMemo(() => JSON.stringify(draftConfig || {}) !== JSON.stringify(zaloConfig || {}), [draftConfig, zaloConfig]);
  const handleSave = () => {
    setZaloConfig(draftConfig);
    onSave(draftConfig);
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
          value: draftConfig.phone || "",
          onChange: event => setDraftConfig(current => ({
            ...current,
            phone: event.target.value.replace(/\D/g, "")
          }))
        }), /*#__PURE__*/_jsx("small", {
          children: "D\xF9ng s\u1ED1 d\u1EA1ng 09... ho\u1EB7c 03... (kh\xF4ng kho\u1EA3ng tr\u1EAFng)."
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "N\u1ED9i dung tin nh\u1EAFn m\u1EABu"
        }), /*#__PURE__*/_jsx(AdminTextarea, {
          rows: "10",
          value: draftConfig.template || DEFAULT_ZALO_TEMPLATE,
          onChange: event => setDraftConfig(current => ({
            ...current,
            template: event.target.value
          }))
        }), /*#__PURE__*/_jsxs("small", {
          children: ["Bi\u1EBFn h\u1ED7 tr\u1EE3: ", "{{customer_name}}, {{phone}}, {{items}}, {{total}}, {{address}}, {{note}}, {{order_code}}, {{order_time}}, {{fulfillment_type}}, {{pickup_branch}}, {{delivery_branch}}, {{payment_method}}, {{map_link}}, {{distance_km}}, {{subtotal}}, {{shipping_fee}}"]
        })]
      })]
    })
  });
}