import { Fragment } from "react";
import Icon from "../../../components/Icon.js";
import CheckoutCard from "./CheckoutCard.js";
import InfoLine from "./InfoLine.js";
import { checkoutText } from "../../../data/uiText.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function CheckoutFulfillmentSection({
  fulfillmentType,
  setFulfillmentType,
  setIsAddressModalOpen,
  deliveryInfo,
  pickupContact,
  setPickupContact,
  selectedBranchInfo,
  isChangingBranch,
  pickupBranches,
  selectedBranch,
  setSelectedBranch,
  setIsChangingBranch,
  pickupMode,
  setPickupMode,
  pickupDate,
  setPickupDate,
  pickupClock,
  setPickupClock
}) {
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      className: "fulfillment-tabs",
      children: [/*#__PURE__*/_jsx("button", {
        onClick: () => setFulfillmentType("delivery"),
        className: fulfillmentType === "delivery" ? "active" : "",
        children: "Giao t\u1EADn n\u01A1i"
      }), /*#__PURE__*/_jsx("button", {
        onClick: () => setFulfillmentType("pickup"),
        className: fulfillmentType === "pickup" ? "active" : "",
        children: "\u0110\u1EBFn l\u1EA5y"
      })]
    }), fulfillmentType === "delivery" ? /*#__PURE__*/_jsx(CheckoutCard, {
      title: checkoutText.deliveryTo,
      action: checkoutText.changeAddress,
      onAction: () => setIsAddressModalOpen(true),
      children: /*#__PURE__*/_jsxs("div", {
        className: "delivery-info-box",
        children: [/*#__PURE__*/_jsx(InfoLine, {
          icon: "user",
          label: checkoutText.customerName,
          value: deliveryInfo.name
        }), /*#__PURE__*/_jsx(InfoLine, {
          icon: "home",
          label: checkoutText.address,
          value: deliveryInfo.address
        }), /*#__PURE__*/_jsx(InfoLine, {
          icon: "phone",
          label: checkoutText.phone,
          value: deliveryInfo.phone
        })]
      })
    }) : /*#__PURE__*/_jsxs(Fragment, {
      children: [/*#__PURE__*/_jsx(CheckoutCard, {
        title: "Th\xF4ng tin ng\u01B0\u1EDDi nh\u1EADn",
        children: /*#__PURE__*/_jsxs("div", {
          className: "grid gap-3",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "grid grid-cols-2 gap-3",
            children: [/*#__PURE__*/_jsxs("label", {
              className: "pickup-field",
              children: [/*#__PURE__*/_jsx("span", {
                children: "T\xEAn c\u1EE7a b\u1EA1n"
              }), /*#__PURE__*/_jsx("input", {
                value: pickupContact.name,
                onChange: event => setPickupContact(current => ({
                  ...current,
                  name: event.target.value
                })),
                placeholder: "V\xED d\u1EE5: Anh Minh"
              })]
            }), /*#__PURE__*/_jsxs("label", {
              className: "pickup-field",
              children: [/*#__PURE__*/_jsx("span", {
                children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
              }), /*#__PURE__*/_jsx("input", {
                value: pickupContact.phone,
                onChange: event => setPickupContact(current => ({
                  ...current,
                  phone: event.target.value.replace(/\D/g, "")
                })),
                inputMode: "tel",
                placeholder: "09..."
              })]
            })]
          }), /*#__PURE__*/_jsx("p", {
            className: "rounded-2xl bg-orange-50 px-3 py-2 text-xs font-semibold leading-5 text-orange-700",
            children: "Qu\xE1n d\xF9ng th\xF4ng tin n\xE0y \u0111\u1EC3 x\xE1c nh\u1EADn ng\u01B0\u1EDDi \u0111\u1EBFn l\u1EA5y v\xE0 t\xEDch \u0111i\u1EC3m cho b\u1EA1n."
          })]
        })
      }), /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Ch\u1ECDn chi nh\xE1nh \u0111\u1EC3 l\u1EA5y",
        children: /*#__PURE__*/_jsxs("div", {
          className: "space-y-3",
          children: [(selectedBranchInfo && !isChangingBranch ? [selectedBranchInfo] : pickupBranches).map(branch => /*#__PURE__*/_jsxs("button", {
            onClick: () => {
              setSelectedBranch(branch.id);
              setIsChangingBranch(false);
            },
            className: `branch-card ${selectedBranch === branch.id ? "branch-card-active" : ""}`,
            children: [/*#__PURE__*/_jsx("span", {
              className: "grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600",
              children: /*#__PURE__*/_jsx(Icon, {
                name: "home",
                size: 18
              })
            }), /*#__PURE__*/_jsxs("span", {
              className: "min-w-0 flex-1 text-left",
              children: [/*#__PURE__*/_jsx("strong", {
                children: branch.name
              }), /*#__PURE__*/_jsx("small", {
                children: branch.address
              }), /*#__PURE__*/_jsx("em", {
                children: branch.time
              })]
            }), /*#__PURE__*/_jsx("span", {
              className: "branch-radio",
              children: selectedBranch === branch.id ? "✓" : ""
            })]
          }, branch.id)), selectedBranchInfo && !isChangingBranch ? /*#__PURE__*/_jsx("button", {
            type: "button",
            onClick: () => setIsChangingBranch(true),
            className: "w-full text-left text-sm font-semibold text-orange-600",
            children: "B\u1EA5m v\xE0o \u0111\u1ED5i chi nh\xE1nh l\u1EA5y"
          }) : null]
        })
      })]
    }), fulfillmentType === "delivery" ? null : /*#__PURE__*/_jsx(CheckoutCard, {
      title: "Th\u1EDDi gian \u0111\u1EBFn l\u1EA5y",
      children: /*#__PURE__*/_jsxs("div", {
        className: "pickup-time-card",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "pickup-mode-tabs",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => setPickupMode("soon"),
            className: pickupMode === "soon" ? "active" : "",
            children: "S\u1EDBm nh\u1EA5t"
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => setPickupMode("schedule"),
            className: pickupMode === "schedule" ? "active" : "",
            children: "Ch\u1ECDn gi\u1EDD"
          })]
        }), pickupMode === "soon" ? /*#__PURE__*/_jsxs("div", {
          className: "pickup-soon",
          children: [/*#__PURE__*/_jsx("strong", {
            children: "S\u1EB5n s\xE0ng sau kho\u1EA3ng 20 ph\xFAt"
          }), /*#__PURE__*/_jsx("span", {
            children: "Qu\xE1n s\u1EBD nh\u1EAFn khi m\xF3n \u0111\xE3 chu\u1EA9n b\u1ECB xong."
          })]
        }) : /*#__PURE__*/_jsxs("div", {
          className: "grid grid-cols-2 gap-3",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "pickup-field",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Ng\xE0y l\u1EA5y"
            }), /*#__PURE__*/_jsx("input", {
              type: "date",
              value: pickupDate,
              onChange: event => setPickupDate(event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "pickup-field",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Gi\u1EDD l\u1EA5y"
            }), /*#__PURE__*/_jsx("input", {
              type: "time",
              value: pickupClock,
              onChange: event => setPickupClock(event.target.value)
            })]
          })]
        })]
      })
    })]
  });
}