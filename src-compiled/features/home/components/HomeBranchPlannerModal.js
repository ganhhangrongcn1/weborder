import Icon from "../../../components/Icon.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { getBranchHours, getClosingSoonText } from "../homeHelpers.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function HomeBranchPlannerModal({
  open,
  onBackdropClose,
  onClose,
  title,
  subtitle,
  ariaLabel,
  branches,
  selectedBranchId,
  onSelectBranch,
  onConfirm,
  confirmLabel = "Xong, vào menu",
  iconName = "home",
  disabledConfirm = false
}) {
  if (!open) return null;
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: title,
    subtitle: subtitle,
    ariaLabel: ariaLabel,
    onClose: onClose,
    closeOnBackdrop: Boolean(onBackdropClose),
    className: "promo-sheet",
    footer: /*#__PURE__*/_jsx("button", {
      onClick: onConfirm,
      className: "cta w-full",
      disabled: disabledConfirm,
      children: confirmLabel
    }),
    children: /*#__PURE__*/_jsx("div", {
      className: "space-y-3",
      children: branches.map(branch => /*#__PURE__*/_jsxs("button", {
        onClick: () => onSelectBranch(branch.id),
        className: `branch-card ${selectedBranchId === branch.id ? "branch-card-active" : ""}`,
        children: [/*#__PURE__*/_jsx("span", {
          className: "grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600",
          children: /*#__PURE__*/_jsx(Icon, {
            name: iconName,
            size: 18
          })
        }), /*#__PURE__*/_jsxs("span", {
          className: "min-w-0 flex-1 text-left",
          children: [/*#__PURE__*/_jsx("strong", {
            children: branch.name
          }), /*#__PURE__*/_jsx("small", {
            children: branch.address
          }), /*#__PURE__*/_jsxs("em", {
            children: ["Gi\u1EDD ho\u1EA1t \u0111\u1ED9ng: ", getBranchHours(branch).label]
          }), getClosingSoonText(branch) && /*#__PURE__*/_jsx("small", {
            className: "branch-closing-warning",
            children: getClosingSoonText(branch)
          })]
        }), /*#__PURE__*/_jsx("span", {
          className: "branch-radio",
          children: selectedBranchId === branch.id ? "✓" : ""
        })]
      }, branch.id))
    })
  });
}