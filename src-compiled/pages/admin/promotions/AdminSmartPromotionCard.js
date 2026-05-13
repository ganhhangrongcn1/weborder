import { promotionPlaces, promotionTypes, rewardTypes } from "../../../data/defaultData.js";
import { AdminSwitch } from "../ui/AdminCommon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminSmartPromotionCard({
  promotion,
  onChange,
  onDelete,
  products = []
}) {
  const patchCondition = patch => onChange({
    condition: {
      ...promotion.condition,
      ...patch
    }
  });
  const patchReward = patch => onChange({
    reward: {
      ...promotion.reward,
      ...patch
    }
  });
  const togglePlace = place => {
    const current = promotion.displayPlaces || [];
    const displayPlaces = current.includes(place) ? current.filter(item => item !== place) : [...current, place];
    onChange({
      displayPlaces
    });
  };
  const activeProducts = products.filter(item => item?.visible !== false);
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-smart-promo-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-smart-promo-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("span", {
          children: promotion.type
        }), /*#__PURE__*/_jsx("strong", {
          children: promotion.name
        }), /*#__PURE__*/_jsx("small", {
          children: promotion.active ? "Đang bật trên app khách" : "Đang tắt"
        })]
      }), /*#__PURE__*/_jsx(AdminSwitch, {
        checked: promotion.active,
        onChange: active => onChange({
          active
        })
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-smart-grid",
      children: [/*#__PURE__*/_jsxs("label", {
        children: ["T\xEAn n\u1ED9i b\u1ED9", /*#__PURE__*/_jsx("input", {
          value: promotion.name,
          onChange: event => onChange({
            name: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Ti\xEAu \u0111\u1EC1 kh\xE1ch th\u1EA5y", /*#__PURE__*/_jsx("input", {
          value: promotion.title,
          onChange: event => onChange({
            title: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["M\xF4 t\u1EA3 ng\u1EAFn", /*#__PURE__*/_jsx("input", {
          value: promotion.text,
          onChange: event => onChange({
            text: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Lo\u1EA1i ch\u01B0\u01A1ng tr\xECnh", /*#__PURE__*/_jsx("select", {
          value: promotion.type,
          onChange: event => onChange({
            type: event.target.value
          }),
          children: promotionTypes.map(type => /*#__PURE__*/_jsx("option", {
            value: type.id,
            children: type.label
          }, type.id))
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["\u0110\u01A1n t\u1ED1i thi\u1EC3u", /*#__PURE__*/_jsx("input", {
          type: "number",
          value: promotion.condition.minSubtotal,
          onChange: event => patchCondition({
            minSubtotal: Number(event.target.value)
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Lo\u1EA1i kh\xE1ch", /*#__PURE__*/_jsxs("select", {
          value: promotion.condition.customerType,
          onChange: event => patchCondition({
            customerType: event.target.value
          }),
          children: [/*#__PURE__*/_jsx("option", {
            value: "all",
            children: "T\u1EA5t c\u1EA3"
          }), /*#__PURE__*/_jsx("option", {
            value: "new",
            children: "Kh\xE1ch m\u1EDBi"
          }), /*#__PURE__*/_jsx("option", {
            value: "returning",
            children: "Kh\xE1ch c\u0169"
          }), /*#__PURE__*/_jsx("option", {
            value: "member",
            children: "\u0110\xE3 \u0111\u0103ng nh\u1EADp"
          })]
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Ph\u1EA7n th\u01B0\u1EDFng", /*#__PURE__*/_jsx("select", {
          value: promotion.reward.type,
          onChange: event => patchReward({
            type: event.target.value
          }),
          children: rewardTypes.map(type => /*#__PURE__*/_jsx("option", {
            value: type.id,
            children: type.label
          }, type.id))
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Gi\xE1 tr\u1ECB", /*#__PURE__*/_jsx("input", {
          value: promotion.reward.value,
          onChange: event => patchReward({
            value: event.target.value
          })
        })]
      }), promotion.reward.type === "gift" && /*#__PURE__*/_jsxs("label", {
        children: ["M\xF3n t\u1EB7ng", /*#__PURE__*/_jsxs("select", {
          value: promotion.reward.productId || "",
          onChange: event => patchReward({
            productId: event.target.value,
            value: event.target.value || promotion.reward.value
          }),
          children: [/*#__PURE__*/_jsx("option", {
            value: "",
            children: "Ch\u1ECDn m\xF3n \u0111ang m\u1EDF b\xE1n"
          }), activeProducts.map(product => /*#__PURE__*/_jsx("option", {
            value: product.id,
            children: product.name
          }, product.id))]
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["\u01AFu ti\xEAn", /*#__PURE__*/_jsx("input", {
          type: "number",
          value: promotion.priority,
          onChange: event => onChange({
            priority: Number(event.target.value)
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Ng\xE0y b\u1EAFt \u0111\u1EA7u", /*#__PURE__*/_jsx("input", {
          type: "date",
          value: promotion.startAt,
          onChange: event => onChange({
            startAt: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Ng\xE0y k\u1EBFt th\xFAc", /*#__PURE__*/_jsx("input", {
          type: "date",
          value: promotion.endAt,
          onChange: event => onChange({
            endAt: event.target.value
          })
        })]
      }), /*#__PURE__*/_jsxs("label", {
        children: ["Icon", /*#__PURE__*/_jsxs("select", {
          value: promotion.icon,
          onChange: event => onChange({
            icon: event.target.value
          }),
          children: [/*#__PURE__*/_jsx("option", {
            value: "bike",
            children: "Freeship"
          }), /*#__PURE__*/_jsx("option", {
            value: "sale",
            children: "Gi\u1EA3m gi\xE1"
          }), /*#__PURE__*/_jsx("option", {
            value: "gift",
            children: "Qu\xE0 t\u1EB7ng"
          }), /*#__PURE__*/_jsx("option", {
            value: "cup",
            children: "N\u01B0\u1EDBc u\u1ED1ng/\u0111i\u1EC3m"
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-place-row",
      children: [/*#__PURE__*/_jsx("span", {
        children: "Hi\u1EC3n th\u1ECB \u1EDF:"
      }), promotionPlaces.map(place => /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: () => togglePlace(place.id),
        className: (promotion.displayPlaces || []).includes(place.id) ? "active" : "",
        children: place.label
      }, place.id))]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-supabase-note",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "Supabase sau n\xE0y:"
      }), " l\u01B0u d\xF2ng n\xE0y v\xE0o b\u1EA3ng ", /*#__PURE__*/_jsx("code", {
        children: "promotions"
      }), ", c\xE1c c\u1ED9t JSON n\xEAn l\xE0 ", /*#__PURE__*/_jsx("code", {
        children: "condition"
      }), ", ", /*#__PURE__*/_jsx("code", {
        children: "reward"
      }), ", ", /*#__PURE__*/_jsx("code", {
        children: "display_places"
      }), "."]
    }), /*#__PURE__*/_jsx("button", {
      className: "admin-danger",
      onClick: onDelete,
      children: "X\xF3a ch\u01B0\u01A1ng tr\xECnh"
    })]
  });
}