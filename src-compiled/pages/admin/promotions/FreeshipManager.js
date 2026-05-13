import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function FreeshipManager({
  freeShippingPromo,
  createPromotion,
  updatePromotion
}) {
  if (!freeShippingPromo) {
    return /*#__PURE__*/_jsxs("section", {
      className: "admin-panel",
      children: [/*#__PURE__*/_jsx("div", {
        className: "admin-panel-head",
        children: /*#__PURE__*/_jsx("h2", {
          children: "Freeship theo ch\u01B0\u01A1ng tr\xECnh"
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
        children: [/*#__PURE__*/_jsx("p", {
          className: "text-sm text-slate-600",
          children: "Ch\u01B0a c\xF3 c\u1EA5u h\xECnh freeship."
        }), /*#__PURE__*/_jsx("button", {
          className: "admin-cta mt-3",
          type: "button",
          onClick: () => createPromotion("free_shipping"),
          children: "T\u1EA1o ch\u01B0\u01A1ng tr\xECnh freeship"
        })]
      })]
    });
  }
  const minSubtotal = Number(freeShippingPromo?.condition?.minSubtotal || 0);
  const maxSupportShipFee = Number(freeShippingPromo?.condition?.maxSupportShipFee || 0);
  const isActive = freeShippingPromo?.active !== false;
  return /*#__PURE__*/_jsxs("section", {
    className: "admin-panel",
    children: [/*#__PURE__*/_jsx("div", {
      className: "admin-panel-head",
      children: /*#__PURE__*/_jsx("h2", {
        children: "Freeship theo ch\u01B0\u01A1ng tr\xECnh"
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
        children: [/*#__PURE__*/_jsx("h4", {
          className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
          children: "C\u1EA5u h\xECnh ch\xEDnh"
        }), /*#__PURE__*/_jsxs("div", {
          className: "grid grid-cols-1 gap-3 md:grid-cols-3",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "text-[12px] font-semibold text-slate-500",
            children: ["M\u1ED1c \u0111\u01A1n t\u1ED1i thi\u1EC3u", /*#__PURE__*/_jsx("input", {
              className: "admin-input mt-1",
              type: "number",
              min: "0",
              value: minSubtotal,
              onChange: event => updatePromotion(freeShippingPromo.id, {
                condition: {
                  ...freeShippingPromo.condition,
                  minSubtotal: Number(event.target.value || 0)
                }
              })
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "text-[12px] font-semibold text-slate-500",
            children: ["Ph\xED ship h\u1ED7 tr\u1EE3 t\u1ED1i \u0111a (0 = to\xE0n b\u1ED9)", /*#__PURE__*/_jsx("input", {
              className: "admin-input mt-1",
              type: "number",
              min: "0",
              value: maxSupportShipFee,
              onChange: event => updatePromotion(freeShippingPromo.id, {
                condition: {
                  ...freeShippingPromo.condition,
                  maxSupportShipFee: Number(event.target.value || 0)
                }
              })
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "text-[12px] font-semibold text-slate-500",
            children: ["B\u1EADt ch\u01B0\u01A1ng tr\xECnh", /*#__PURE__*/_jsx("div", {
              className: "mt-2",
              children: /*#__PURE__*/_jsxs("label", {
                className: "admin-switch",
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  checked: isActive,
                  onChange: event => updatePromotion(freeShippingPromo.id, {
                    active: event.target.checked
                  })
                }), /*#__PURE__*/_jsx("span", {})]
              })
            })]
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
        children: [/*#__PURE__*/_jsx("h4", {
          className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
          children: "Th\u1EDDi gian ch\u1EA1y"
        }), /*#__PURE__*/_jsxs("div", {
          className: "grid grid-cols-1 gap-3 md:grid-cols-2",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "text-[12px] font-semibold text-slate-500",
            children: ["Ng\xE0y b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
              className: "admin-input mt-1",
              type: "date",
              value: freeShippingPromo.startAt || "",
              onChange: event => updatePromotion(freeShippingPromo.id, {
                startAt: event.target.value
              })
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "text-[12px] font-semibold text-slate-500",
            children: ["Ng\xE0y k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
              className: "admin-input mt-1",
              type: "date",
              value: freeShippingPromo.endAt || "",
              onChange: event => updatePromotion(freeShippingPromo.id, {
                endAt: event.target.value
              })
            })]
          })]
        })]
      })]
    })]
  });
}