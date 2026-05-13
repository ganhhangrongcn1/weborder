import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function MenuGroupEditorModal({
  open,
  onClose,
  editingPresetDraft,
  editingPresetId,
  optionGroupPresets,
  draggingEditingOptionId,
  setDraggingEditingOptionId,
  reorderEditingOptions,
  patchEditingPreset,
  patchEditingOption,
  removeEditingOption,
  addEditingOption,
  savePresetFromEditor,
  deletePresetFromEditor
}) {
  if (!open || !editingPresetDraft) return null;
  const isNewPreset = editingPresetId.startsWith("preset-") && !optionGroupPresets.some(item => item.id === editingPresetId);
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop admin-side-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-product-modal admin-product-side-panel group-editor-panel",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-product-modal-head admin-product-side-head",
        children: [/*#__PURE__*/_jsx(AdminIconButton, {
          label: "\u0110\xF3ng",
          onClick: onClose,
          children: "\xD7"
        }), /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h2", {
            children: isNewPreset ? "TẠO NHÓM TÙY CHỌN MỚI" : "CHỈNH SỬA NHÓM TÙY CHỌN"
          }), /*#__PURE__*/_jsx("p", {
            children: "C\u1EA5u h\xECnh nh\xF3m topping d\xF9ng chung cho nhi\u1EC1u m\xF3n."
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-product-form admin-product-side-form group-editor-form",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "wide group-editor-name",
          children: ["T\xEAn nh\xF3m t\xF9y ch\u1ECDn", /*#__PURE__*/_jsx(AdminInput, {
            placeholder: "Nh\xF3m t\xF9y ch\u1ECDn m\u1EDBi",
            value: editingPresetDraft.name || "",
            onChange: event => patchEditingPreset({
              name: event.target.value
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-option-section group-editor-block",
          children: [/*#__PURE__*/_jsx("div", {
            className: "admin-option-head",
            children: /*#__PURE__*/_jsx("h3", {
              children: "T\xD9Y CH\u1ECCN"
            })
          }), /*#__PURE__*/_jsxs("div", {
            className: "group-option-grid-head",
            children: [/*#__PURE__*/_jsx("span", {
              children: "T\xCAN T\xD9Y CH\u1ECCN *"
            }), /*#__PURE__*/_jsx("span", {
              children: "GI\xC1 B\u1ED4 SUNG"
            })]
          }), (editingPresetDraft.options || []).map(option => /*#__PURE__*/_jsx("div", {
            className: `admin-option-group group-option-card ${draggingEditingOptionId === option.id ? "dragging" : ""}`,
            draggable: true,
            onDragStart: () => setDraggingEditingOptionId(option.id),
            onDragEnd: () => setDraggingEditingOptionId(""),
            onDragOver: event => event.preventDefault(),
            onDrop: () => reorderEditingOptions(draggingEditingOptionId, option.id),
            children: /*#__PURE__*/_jsxs("div", {
              className: "group-option-row",
              children: [/*#__PURE__*/_jsx("span", {
                className: "group-drag",
                children: "\u2261"
              }), /*#__PURE__*/_jsx(AdminInput, {
                placeholder: "T\xF9y ch\u1ECDn m\u1EDBi",
                value: option.name || "",
                onChange: event => patchEditingOption(option.id, {
                  name: event.target.value
                })
              }), /*#__PURE__*/_jsx(AdminInput, {
                type: "number",
                value: Number(option.price || 0),
                onChange: event => patchEditingOption(option.id, {
                  price: Number(event.target.value || 0)
                })
              }), /*#__PURE__*/_jsx(AdminIconButton, {
                label: "X\xF3a t\xF9y ch\u1ECDn",
                variant: "danger",
                className: "admin-option-remove",
                onClick: () => removeEditingOption(option.id),
                children: "\xD7"
              })]
            })
          }, option.id)), /*#__PURE__*/_jsx(AdminButton, {
            variant: "secondary",
            className: "group-add-option-btn",
            onClick: addEditingOption,
            children: "Th\xEAm t\xF9y ch\u1ECDn m\u1EDBi"
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-option-section group-editor-block",
          children: [/*#__PURE__*/_jsx("div", {
            className: "admin-option-head",
            children: /*#__PURE__*/_jsx("h3", {
              children: "QUY T\u1EAEC L\u1EF0A CH\u1ECCN"
            })
          }), /*#__PURE__*/_jsxs("div", {
            className: "group-rule-box",
            children: [/*#__PURE__*/_jsxs("label", {
              className: "group-rule-radio",
              style: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                textTransform: "none"
              },
              children: [/*#__PURE__*/_jsx("input", {
                style: {
                  margin: 0
                },
                type: "radio",
                name: `rule-${editingPresetDraft.id}`,
                checked: editingPresetDraft.required,
                onChange: () => patchEditingPreset({
                  required: true
                })
              }), /*#__PURE__*/_jsx("span", {
                children: "Kh\xE1ch h\xE0ng ph\u1EA3i ch\u1ECDn"
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "group-rule-inline",
              children: [/*#__PURE__*/_jsxs(AdminSelect, {
                value: Number(editingPresetDraft.maxSelect || 1) === 1 ? "exact" : "max",
                onChange: event => patchEditingPreset({
                  maxSelect: event.target.value === "exact" ? 1 : Math.max(2, Number(editingPresetDraft.maxSelect || 2))
                }),
                children: [/*#__PURE__*/_jsx("option", {
                  value: "exact",
                  children: "Ch\xEDnh x\xE1c"
                }), /*#__PURE__*/_jsx("option", {
                  value: "max",
                  children: "T\u1ED1i \u0111a"
                })]
              }), /*#__PURE__*/_jsx(AdminInput, {
                type: "number",
                min: "1",
                value: Number(editingPresetDraft.maxSelect || 1),
                onChange: event => patchEditingPreset({
                  maxSelect: Math.max(1, Number(event.target.value || 1))
                })
              })]
            }), /*#__PURE__*/_jsxs("label", {
              className: "group-rule-radio",
              style: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                textTransform: "none"
              },
              children: [/*#__PURE__*/_jsx("input", {
                style: {
                  margin: 0
                },
                type: "radio",
                name: `rule-${editingPresetDraft.id}`,
                checked: !editingPresetDraft.required,
                onChange: () => patchEditingPreset({
                  required: false
                })
              }), /*#__PURE__*/_jsx("span", {
                children: "Kh\xF4ng b\u1EAFt bu\u1ED9c kh\xE1ch ph\u1EA3i ch\u1ECDn"
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "group-rule-note",
              children: Number(editingPresetDraft.maxSelect || 1) === 1 ? "Khách chỉ có thể chọn 1 tùy chọn khi đặt món." : `Khách có thể chọn tối đa ${Number(editingPresetDraft.maxSelect || 1)} tùy chọn khi đặt món.`
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-option-section group-editor-block",
          children: [/*#__PURE__*/_jsx("div", {
            className: "admin-option-head",
            children: /*#__PURE__*/_jsx("h3", {
              children: "\u0110\xE3 li\xEAn k\u1EBFt m\xF3n"
            })
          }), /*#__PURE__*/_jsxs("div", {
            className: "group-linked-empty",
            children: [/*#__PURE__*/_jsx("span", {
              children: "\uD83D\uDECD\uFE0F"
            }), /*#__PURE__*/_jsx("p", {
              children: "Li\xEAn k\u1EBFt m\xF3n v\u1EDBi nh\xF3m t\xF9y ch\u1ECDn m\xE0 b\u1EA1n mu\u1ED1n kh\xE1ch h\xE0ng s\u1EED d\u1EE5ng \u0111\u1EC3 c\xF3 th\u1EC3 th\xEAm v\xE0o m\xF3n."
            })]
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-modal-actions admin-side-actions",
        children: [/*#__PURE__*/_jsx(AdminButton, {
          variant: "secondary",
          className: "admin-secondary",
          onClick: onClose,
          children: "H\u1EE7y"
        }), !isNewPreset && /*#__PURE__*/_jsx(AdminButton, {
          variant: "danger",
          className: "admin-danger",
          onClick: deletePresetFromEditor,
          children: "X\xF3a nh\xF3m"
        }), /*#__PURE__*/_jsx(AdminButton, {
          onClick: savePresetFromEditor,
          children: "L\u01B0u nh\xF3m t\xF9y ch\u1ECDn"
        })]
      })]
    })
  });
}