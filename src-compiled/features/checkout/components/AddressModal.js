import { useState } from "react";
import GoongAddressPicker from "../../../components/GoongAddressPicker.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AddressModal({
  value,
  addresses = [],
  subtotal = 0,
  deliveryBranches = [],
  selectedDeliveryBranchId = "",
  onSelectDeliveryBranch,
  deliveryOrigin,
  shippingConfig,
  onSelectAddress,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    address: "",
    placeId: "",
    lat: null,
    lng: null,
    distanceKm: null,
    durationText: "",
    saveToAccount: false,
    ...value
  });
  const [showSaved, setShowSaved] = useState(false);
  const savedPreview = addresses[0];
  const selectedDeliveryBranch = deliveryBranches.find(branch => branch.id === selectedDeliveryBranchId) || null;
  function updateField(field, nextValue) {
    setDraft(current => ({
      ...current,
      [field]: nextValue
    }));
  }
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: "\u0110\u1ED5i th\xF4ng tin giao h\xE0ng",
    subtitle: "C\u1EADp nh\u1EADt t\xEAn, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i v\xE0 \u0111\u1ECBa ch\u1EC9 nh\u1EADn m\xF3n",
    ariaLabel: "\u0110\u1ED5i \u0111\u1ECBa ch\u1EC9 giao h\xE0ng",
    onClose: onClose,
    className: "promo-sheet",
    children: /*#__PURE__*/_jsxs("div", {
      className: "space-y-3",
      children: [savedPreview && /*#__PURE__*/_jsxs("div", {
        className: "space-y-2",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center justify-between gap-3",
          children: [/*#__PURE__*/_jsx("p", {
            className: "text-xs font-black uppercase text-brown/50",
            children: "\u0110\u1ECBa ch\u1EC9 \u0111\xE3 l\u01B0u"
          }), addresses.length > 1 && /*#__PURE__*/_jsx("button", {
            onClick: () => setShowSaved(current => !current),
            className: "text-xs font-black text-orange-600",
            children: showSaved ? "Thu gọn" : `Xem ${addresses.length} địa chỉ`
          })]
        }), (showSaved ? addresses.slice(0, 3) : [savedPreview]).map(address => /*#__PURE__*/_jsxs("button", {
          onClick: () => {
            onSelectAddress(address);
            onClose();
          },
          className: "w-full rounded-2xl border border-orange-100 bg-white px-3 py-2 text-left text-xs shadow-sm",
          children: [/*#__PURE__*/_jsxs("strong", {
            className: "block text-brown",
            children: [address.label, address.isDefault ? " · GIAO ĐẾN" : ""]
          }), /*#__PURE__*/_jsx("span", {
            className: "mt-1 block text-brown/55",
            children: address.address
          })]
        }, address.id))]
      }), /*#__PURE__*/_jsxs("div", {
        className: "delivery-branch-select-card",
        children: [/*#__PURE__*/_jsx("p", {
          className: "text-xs font-black uppercase text-brown/50",
          children: "Chi nh\xE1nh giao h\xE0ng"
        }), /*#__PURE__*/_jsx("label", {
          className: "address-field",
          children: /*#__PURE__*/_jsx("select", {
            value: selectedDeliveryBranchId,
            onChange: event => onSelectDeliveryBranch?.(event.target.value),
            children: deliveryBranches.map(branch => /*#__PURE__*/_jsx("option", {
              value: branch.id,
              children: branch.name
            }, branch.id))
          })
        }), selectedDeliveryBranch && /*#__PURE__*/_jsxs("div", {
          className: "delivery-branch-select-note",
          children: [/*#__PURE__*/_jsx("strong", {
            children: selectedDeliveryBranch.name
          }), /*#__PURE__*/_jsx("span", {
            children: selectedDeliveryBranch.address
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "grid grid-cols-2 gap-2",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "address-field",
          children: [/*#__PURE__*/_jsx("span", {
            children: "T\xEAn kh\xE1ch h\xE0ng"
          }), /*#__PURE__*/_jsx("input", {
            value: draft.name,
            onChange: event => updateField("name", event.target.value)
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "address-field",
          children: [/*#__PURE__*/_jsx("span", {
            children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
          }), /*#__PURE__*/_jsx("input", {
            value: draft.phone,
            onChange: event => updateField("phone", event.target.value)
          })]
        })]
      }), /*#__PURE__*/_jsx(GoongAddressPicker, {
        origin: deliveryOrigin,
        shippingConfig: shippingConfig,
        value: {
          addressText: draft.address,
          placeId: draft.placeId,
          lat: draft.lat,
          lng: draft.lng,
          distanceKm: draft.distanceKm,
          durationText: draft.durationText
        },
        onChange: nextAddress => setDraft(current => ({
          ...current,
          address: nextAddress.addressText,
          placeId: nextAddress.placeId,
          lat: nextAddress.lat,
          lng: nextAddress.lng,
          distanceKm: nextAddress.distanceKm,
          durationText: nextAddress.durationText,
          deliveryFee: nextAddress.deliveryFee,
          shippingStatus: nextAddress.shippingStatus
        }))
      }, selectedDeliveryBranchId || "default-delivery-origin"), /*#__PURE__*/_jsxs("label", {
        className: "flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm font-bold text-brown/70",
        children: [/*#__PURE__*/_jsx("span", {
          children: "L\u01B0u \u0111\u1ECBa ch\u1EC9 n\xE0y v\xE0o t\xE0i kho\u1EA3n"
        }), /*#__PURE__*/_jsx("input", {
          type: "checkbox",
          checked: Boolean(draft.saveToAccount),
          onChange: event => updateField("saveToAccount", event.target.checked),
          className: "toggle-input"
        })]
      }), /*#__PURE__*/_jsx("button", {
        onClick: () => onSave(draft),
        className: "cta w-full",
        children: "L\u01B0u th\xF4ng tin"
      })]
    })
  });
}