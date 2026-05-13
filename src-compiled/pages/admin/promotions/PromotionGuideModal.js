import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PromotionGuideModal({
  onClose
}) {
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-guide-modal",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-guide-head",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("span", {
            children: "H\u01B0\u1EDBng d\u1EABn"
          }), /*#__PURE__*/_jsx("h2", {
            children: "C\xE1ch set ch\u01B0\u01A1ng tr\xECnh khuy\u1EBFn m\xE3i"
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: onClose,
          children: "\xD7"
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-guide-body",
        children: [/*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "1. Ch\u1ECDn lo\u1EA1i ch\u01B0\u01A1ng tr\xECnh:"
          }), " Freeship d\xF9ng cho h\u1ED7 tr\u1EE3 ph\xED giao h\xE0ng, M\xE3 gi\u1EA3m gi\xE1 d\xF9ng cho \u01B0u \u0111\xE3i nh\u1EADp m\xE3/g\u1EE3i \xFD, \u0110\u1EE7 m\u1ED1c nh\u1EADn qu\xE0 d\xF9ng \u0111\u1EC3 k\xEDch th\xEDch kh\xE1ch th\xEAm m\xF3n."]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "2. Set \u0111i\u1EC1u ki\u1EC7n:"
          }), " nh\u1EADp \u0111\u01A1n t\u1ED1i thi\u1EC3u, lo\u1EA1i kh\xE1ch v\xE0 n\u01A1i hi\u1EC3n th\u1ECB. V\xED d\u1EE5 freeship 150k: lo\u1EA1i Freeship, \u0111\u01A1n t\u1ED1i thi\u1EC3u 150000, hi\u1EC3n th\u1ECB Checkout v\xE0 Trang ch\u1EE7."]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "3. Set ph\u1EA7n th\u01B0\u1EDFng:"
          }), " h\u1ED7 tr\u1EE3 ph\xED ship, gi\u1EA3m ti\u1EC1n c\u1ED1 \u0111\u1ECBnh, gi\u1EA3m %, t\u1EB7ng qu\xE0 ho\u1EB7c t\u1EB7ng \u0111i\u1EC3m. App kh\xE1ch s\u1EBD \u0111\u1ECDc ph\u1EA7n n\xE0y \u0111\u1EC3 t\xEDnh/hi\u1EC3n th\u1ECB \u0111\xFAng."]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "4. \u01AFu ti\xEAn:"
          }), " s\u1ED1 c\xE0ng nh\u1ECF c\xE0ng hi\u1EC7n tr\u01B0\u1EDBc. D\xF9ng \u0111\u1EC3 admin quy\u1EBFt \u0111\u1ECBnh ch\u01B0\u01A1ng tr\xECnh n\xE0o n\u1ED5i b\u1EADt h\u01A1n."]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "5. Supabase:"
          }), " t\u1EA1o b\u1EA3ng ", /*#__PURE__*/_jsx("code", {
            children: "promotions"
          }), " g\u1ED3m id, name, type, title, text, icon, active, display_places, condition, reward, start_at, end_at, priority. Khi n\u1ED1i th\u1EADt, ch\u1EC9 thay h\xE0m load/save localStorage b\u1EB1ng query Supabase."]
        })]
      })]
    })
  });
}