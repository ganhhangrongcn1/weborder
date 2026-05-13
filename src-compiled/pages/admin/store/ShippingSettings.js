import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ShippingSettings({
  shippingConfig,
  setShippingConfig,
  onSave
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: "admin-panel admin-store-panel",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-panel-head",
      children: [/*#__PURE__*/_jsx("h2", {
        children: "C\u1EA5u h\xECnh ph\xED ship"
      }), /*#__PURE__*/_jsx("button", {
        onClick: onSave,
        children: "L\u01B0u"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-mini-grid",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Ph\xED 3km \u0111\u1EA7u"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          value: shippingConfig.baseFeeFirst3Km,
          onChange: event => setShippingConfig(current => ({
            ...current,
            baseFeeFirst3Km: Number(event.target.value)
          }))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Gi\xE1 m\u1ED7i km ti\u1EBFp theo"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          value: shippingConfig.feePerNextKm,
          onChange: event => setShippingConfig(current => ({
            ...current,
            feePerNextKm: Number(event.target.value)
          }))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Ng\u01B0\u1EE1ng mi\u1EC5n ph\xED ship"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          value: shippingConfig.freeShipThreshold,
          onChange: event => setShippingConfig(current => ({
            ...current,
            freeShipThreshold: Number(event.target.value)
          }))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "B\u1EADt h\u1ED7 tr\u1EE3 ph\xED ship"
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-switch",
          children: [/*#__PURE__*/_jsx("input", {
            type: "checkbox",
            checked: Boolean(shippingConfig.supportShippingEnabled),
            onChange: event => setShippingConfig(current => ({
              ...current,
              supportShippingEnabled: event.target.checked
            }))
          }), /*#__PURE__*/_jsx("span", {})]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Ph\xED ship h\u1ED7 tr\u1EE3 t\u1ED1i \u0111a"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          min: "0",
          value: shippingConfig.maxSupportShipFee ?? 0,
          onChange: event => setShippingConfig(current => ({
            ...current,
            maxSupportShipFee: Number(event.target.value)
          }))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "B\xE1n k\xEDnh giao h\xE0ng t\u1ED1i \u0111a (km)"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          value: shippingConfig.maxRadiusKm,
          onChange: event => setShippingConfig(current => ({
            ...current,
            maxRadiusKm: Number(event.target.value)
          }))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Ghi ch\xFA hi\u1EC3n th\u1ECB cho kh\xE1ch"
        }), /*#__PURE__*/_jsx("textarea", {
          className: "admin-input",
          rows: "4",
          value: shippingConfig.customerNote || "",
          onChange: event => setShippingConfig(current => ({
            ...current,
            customerNote: event.target.value
          }))
        })]
      })]
    }), /*#__PURE__*/_jsx("button", {
      className: "admin-secondary",
      onClick: () => setShippingConfig({
        ...DEFAULT_SHIPPING_CONFIG
      }),
      children: "Kh\xF4i ph\u1EE5c m\u1EB7c \u0111\u1ECBnh"
    })]
  });
}