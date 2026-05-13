import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function MenuCategoryEditorModal({
  open,
  onClose,
  editingCategoryDraft,
  setEditingCategoryDraft,
  deleteCategoryFromEditor,
  saveCategoryEditor
}) {
  if (!open) return null;
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop admin-side-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-product-modal admin-product-side-panel",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-product-modal-head admin-product-side-head",
        children: [/*#__PURE__*/_jsx(AdminIconButton, {
          label: "\u0110\xF3ng",
          onClick: onClose,
          children: "\xD7"
        }), /*#__PURE__*/_jsx("div", {
          children: /*#__PURE__*/_jsx("h2", {
            children: "CH\u1EC8NH S\u1EECA DANH M\u1EE4C"
          })
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-product-form admin-product-side-form category-editor-form",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["M\u1EDAI *", /*#__PURE__*/_jsx(AdminInput, {
            value: editingCategoryDraft,
            onChange: event => setEditingCategoryDraft(event.target.value)
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["L\u1ECACH B\xC1N *", /*#__PURE__*/_jsx(AdminSelect, {
            value: "all",
            readOnly: true,
            children: /*#__PURE__*/_jsx("option", {
              value: "all",
              children: "T\u1EA5t c\u1EA3 gi\u1EDD m\u1EDF c\u1EEDa"
            })
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-modal-actions admin-side-actions menu-item-editor-actions",
        children: [/*#__PURE__*/_jsx(AdminButton, {
          variant: "danger",
          className: "admin-danger",
          onClick: deleteCategoryFromEditor,
          children: "X\xF3a danh m\u1EE5c"
        }), /*#__PURE__*/_jsx("span", {}), /*#__PURE__*/_jsx(AdminButton, {
          onClick: saveCategoryEditor,
          style: {
            gridColumn: "1 / -1"
          },
          children: "L\u01B0u thay \u0111\u1ED5i"
        })]
      })]
    })
  });
}