import { useState } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AccountAddressModal({
  address,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    label: "Giao gần nhất",
    receiverName: "Khách",
    phone: "0123456789",
    address: "",
    note: "",
    isDefault: false,
    ...address
  });
  const update = (field, value) => setDraft(current => ({
    ...current,
    [field]: value
  }));
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: draft.id ? "Sửa địa chỉ" : "Thêm địa chỉ mới",
    subtitle: "\u0110\u1ECBa ch\u1EC9 s\u1EBD \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1EC3 t\u1EF1 \u0111i\u1EC1n \u1EDF checkout.",
    ariaLabel: "Qu\u1EA3n l\xFD \u0111\u1ECBa ch\u1EC9",
    onClose: onClose,
    className: "promo-sheet",
    children: /*#__PURE__*/_jsxs("div", {
      className: "space-y-3",
      children: [/*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "Nh\xE3n \u0111\u1ECBa ch\u1EC9"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.label,
          onChange: event => update("label", event.target.value)
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "T\xEAn ng\u01B0\u1EDDi nh\u1EADn"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.receiverName,
          onChange: event => update("receiverName", event.target.value)
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.phone,
          onChange: event => update("phone", event.target.value)
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\u0110\u1ECBa ch\u1EC9"
        }), /*#__PURE__*/_jsx("textarea", {
          rows: "3",
          value: draft.address,
          onChange: event => update("address", event.target.value)
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "Ghi ch\xFA"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.note,
          onChange: event => update("note", event.target.value)
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm font-bold text-brown/70",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\u0110\u1EB7t l\xE0m \u0111\u1ECBa ch\u1EC9 m\u1EB7c \u0111\u1ECBnh"
        }), /*#__PURE__*/_jsx("input", {
          type: "checkbox",
          checked: Boolean(draft.isDefault),
          onChange: event => update("isDefault", event.target.checked),
          className: "toggle-input"
        })]
      }), /*#__PURE__*/_jsx("button", {
        onClick: () => onSave(draft),
        className: "cta w-full",
        children: "L\u01B0u \u0111\u1ECBa ch\u1EC9"
      })]
    })
  });
}