import { AdminPanel } from "../ui/AdminCommon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function GiftThresholdTab({
  giftPromo,
  updatePromotion,
  activeProducts
}) {
  if (!giftPromo) return null;
  return /*#__PURE__*/_jsx(AdminPanel, {
    title: "Ch\u01B0\u01A1ng tr\xECnh t\u1EB7ng m\xF3n",
    children: /*#__PURE__*/_jsxs("div", {
      className: "admin-mini-grid",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "M\u1ED1c \u0111\u01A1n t\u1ED1i thi\u1EC3u"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "number",
          value: giftPromo.condition.minSubtotal || 0,
          onChange: event => updatePromotion(giftPromo.id, {
            condition: {
              ...giftPromo.condition,
              minSubtotal: Number(event.target.value)
            }
          })
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "M\xF3n t\u1EB7ng (ch\u1EC9 m\xF3n m\u1EDF b\xE1n)"
        }), /*#__PURE__*/_jsxs("select", {
          className: "admin-input",
          value: giftPromo.reward.productId || "",
          onChange: event => updatePromotion(giftPromo.id, {
            reward: {
              ...giftPromo.reward,
              type: "gift",
              productId: event.target.value,
              value: event.target.value
            }
          }),
          children: [/*#__PURE__*/_jsx("option", {
            value: "",
            children: "Ch\u1ECDn m\xF3n t\u1EB7ng"
          }), activeProducts.map(product => /*#__PURE__*/_jsx("option", {
            value: product.id,
            children: product.name
          }, product.id))]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Th\u1EDDi gian b\u1EAFt \u0111\u1EA7u"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "date",
          value: giftPromo.startAt || "",
          onChange: event => updatePromotion(giftPromo.id, {
            startAt: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "Th\u1EDDi gian k\u1EBFt th\xFAc"
        }), /*#__PURE__*/_jsx("input", {
          className: "admin-input",
          type: "date",
          value: giftPromo.endAt || "",
          onChange: event => updatePromotion(giftPromo.id, {
            endAt: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-mini-card",
        children: [/*#__PURE__*/_jsx("label", {
          children: "B\u1EADt ch\u01B0\u01A1ng tr\xECnh"
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-switch",
          children: [/*#__PURE__*/_jsx("input", {
            type: "checkbox",
            checked: Boolean(giftPromo.active),
            onChange: event => updatePromotion(giftPromo.id, {
              active: event.target.checked
            })
          }), /*#__PURE__*/_jsx("span", {})]
        })]
      })]
    })
  });
}