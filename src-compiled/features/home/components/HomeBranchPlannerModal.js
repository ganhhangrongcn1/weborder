import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.js";
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
  useEffect(() => {
    if (!open) return undefined;
    const handleEsc = event => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/createPortal(/*#__PURE__*/_jsx("div", {
    className: "branch-picker-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": ariaLabel || title || "Chọn chi nhánh",
    onClick: event => {
      if (event.target !== event.currentTarget) return;
      if (onBackdropClose) onBackdropClose();
    },
    children: /*#__PURE__*/_jsxs("section", {
      className: "branch-picker-panel",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "branch-picker-head",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h2", {
            children: title
          }), subtitle ? /*#__PURE__*/_jsx("p", {
            children: subtitle
          }) : null]
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "branch-picker-close",
          onClick: onClose,
          "aria-label": "\u0110\xF3ng",
          children: "X"
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "branch-picker-list",
        children: branches.map(branch => /*#__PURE__*/_jsxs("button", {
          type: "button",
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
            }), getClosingSoonText(branch) ? /*#__PURE__*/_jsx("small", {
              className: "branch-closing-warning",
              children: getClosingSoonText(branch)
            }) : null]
          }), /*#__PURE__*/_jsx("span", {
            className: "branch-radio",
            children: selectedBranchId === branch.id ? "✓" : ""
          })]
        }, branch.id))
      }), /*#__PURE__*/_jsx("div", {
        className: "branch-picker-footer",
        children: /*#__PURE__*/_jsx("button", {
          onClick: onConfirm,
          className: "cta w-full",
          disabled: disabledConfirm,
          children: confirmLabel
        })
      })]
    })
  }), document.body);
}