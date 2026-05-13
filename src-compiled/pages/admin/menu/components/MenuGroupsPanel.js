import { AdminButton, AdminCard, AdminIconButton, AdminInput, AdminSelect } from "../../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function MenuGroupsPanel({
  createPreset,
  groupSearch,
  setGroupSearch,
  filteredPresets,
  selectedPreset,
  setSelectedPresetId,
  openPresetEditor,
  updatePresetOption,
  removePresetOption,
  addPresetOption
}) {
  return /*#__PURE__*/_jsxs(AdminCard, {
    className: "admin-panel admin-menu-section",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-menu-filter-row admin-menu-sticky-toolbar",
      children: [/*#__PURE__*/_jsx("div", {
        className: "admin-menu-left-actions",
        children: /*#__PURE__*/_jsx(AdminButton, {
          onClick: createPreset,
          children: "+ T\u1EA1o nh\xF3m t\xF9y ch\u1ECDn m\u1EDBi"
        })
      }), /*#__PURE__*/_jsx(AdminInput, {
        className: "admin-input admin-menu-search",
        value: groupSearch,
        onChange: event => setGroupSearch(event.target.value),
        placeholder: "T\xECm theo t\xEAn nh\xF3m t\xF9y ch\u1ECDn"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-menu-board admin-menu-groups-board",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-menu-col",
        children: [/*#__PURE__*/_jsx("div", {
          className: "admin-menu-col-head",
          children: /*#__PURE__*/_jsx("strong", {
            children: "Nh\xF3m t\xF9y ch\u1ECDn"
          })
        }), /*#__PURE__*/_jsx("div", {
          className: "admin-menu-categories",
          children: filteredPresets.map(preset => /*#__PURE__*/_jsxs("div", {
            className: `admin-menu-category-item admin-menu-preset-item ${selectedPreset?.id === preset.id ? "active" : ""}`,
            onClick: () => setSelectedPresetId(preset.id),
            role: "button",
            tabIndex: 0,
            onKeyDown: event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedPresetId(preset.id);
              }
            },
            children: [/*#__PURE__*/_jsx("span", {
              children: preset.name
            }), /*#__PURE__*/_jsxs("div", {
              className: "admin-menu-preset-actions",
              children: [/*#__PURE__*/_jsx("em", {
                children: (preset.options || []).length
              }), /*#__PURE__*/_jsx(AdminIconButton, {
                label: "Ch\u1EC9nh s\u1EEDa nh\xF3m t\xF9y ch\u1ECDn",
                className: "admin-menu-preset-edit-btn",
                onClick: event => {
                  event.stopPropagation();
                  openPresetEditor(preset);
                },
                children: "\u270E"
              })]
            })]
          }, preset.id))
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-menu-col",
        children: [/*#__PURE__*/_jsx("div", {
          className: "admin-menu-col-head",
          children: /*#__PURE__*/_jsx("strong", {
            children: "T\xF9y ch\u1ECDn"
          })
        }), selectedPreset ? /*#__PURE__*/_jsxs("div", {
          className: "admin-stack",
          style: {
            padding: 12
          },
          children: [(selectedPreset.options || []).map(option => /*#__PURE__*/_jsx("div", {
            className: "admin-option-group",
            children: /*#__PURE__*/_jsxs("div", {
              className: "admin-option-group-row",
              children: [/*#__PURE__*/_jsx(AdminInput, {
                value: option.name || "",
                onChange: event => updatePresetOption(selectedPreset.id, option.id, {
                  name: event.target.value
                })
              }), /*#__PURE__*/_jsx(AdminInput, {
                type: "number",
                value: Number(option.price || 0),
                onChange: event => updatePresetOption(selectedPreset.id, option.id, {
                  price: Number(event.target.value || 0)
                })
              }), /*#__PURE__*/_jsxs(AdminSelect, {
                value: option.active === false ? "off" : "on",
                onChange: event => updatePresetOption(selectedPreset.id, option.id, {
                  active: event.target.value === "on"
                }),
                children: [/*#__PURE__*/_jsx("option", {
                  value: "on",
                  children: "C\xF3 b\xE1n"
                }), /*#__PURE__*/_jsx("option", {
                  value: "off",
                  children: "T\u1EA1m \u1EA9n"
                })]
              }), /*#__PURE__*/_jsx(AdminIconButton, {
                label: "X\xF3a t\xF9y ch\u1ECDn",
                variant: "danger",
                className: "admin-option-remove",
                onClick: () => removePresetOption(selectedPreset.id, option.id),
                children: "\xD7"
              })]
            })
          }, option.id)), /*#__PURE__*/_jsx(AdminButton, {
            variant: "secondary",
            className: "admin-secondary",
            onClick: () => addPresetOption(selectedPreset.id),
            children: "Th\xEAm t\xF9y ch\u1ECDn"
          })]
        }) : /*#__PURE__*/_jsx("p", {
          className: "admin-help-text",
          style: {
            padding: 12
          },
          children: "Ch\u01B0a c\xF3 nh\xF3m t\xF9y ch\u1ECDn."
        })]
      })]
    })]
  });
}