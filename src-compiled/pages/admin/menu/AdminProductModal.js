import { useMemo, useState } from "react";
import { processUploadImage } from "../../../utils/imageUpload.js";
import { uploadImageToMenuBucket } from "../../../services/supabase/storageService.js";
import { AdminSwitch } from "../ui/AdminCommon.js";
import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function buildOptionGroupsFromPresets(presetIds, presets) {
  const presetMap = new Map((presets || []).map(item => [item.id, item]));
  return (presetIds || []).map(presetId => presetMap.get(presetId)).filter(Boolean).map(preset => {
    const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
    const activeOptions = (preset.options || []).filter(opt => opt.active !== false);
    return {
      id: `option-group-${preset.id}`,
      sourcePresetId: preset.id,
      name: preset.name,
      type: maxSelect === 1 ? "single" : "multiple",
      required: Boolean(preset.required),
      maxSelect,
      options: activeOptions.map(opt => ({
        id: `${preset.id}-${opt.id}`,
        name: opt.name,
        price: Number(opt.price || 0)
      }))
    };
  });
}
function getPresetIdsFromProduct(product, presets) {
  const sourceIds = (product.optionGroups || []).map(group => group.sourcePresetId).filter(Boolean);
  if (sourceIds.length) return sourceIds;
  const presetNames = new Map((presets || []).map(preset => [String(preset.name || "").toLowerCase(), preset.id]));
  return (product.optionGroups || []).map(group => presetNames.get(String(group.name || "").toLowerCase())).filter(Boolean);
}
function moveItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return list;
  const next = [...list];
  const [picked] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, picked);
  return next;
}
function normalizeTextNfc(value) {
  return String(value || "").normalize("NFC").trim();
}
function resolveValidCategory(value, categories) {
  const allLabel = "Tất cả";
  const cleaned = normalizeTextNfc(value);
  const normalizedCategories = (categories || []).map(item => normalizeTextNfc(item)).filter(Boolean);
  const validCategories = normalizedCategories.filter(item => item !== allLabel);
  if (!cleaned || cleaned === allLabel) return validCategories[0] || "";
  const matched = validCategories.find(item => item === cleaned);
  return matched || validCategories[0] || cleaned;
}
export default function AdminProductModal({
  product,
  categories,
  optionGroupPresets = [],
  onSave,
  onClose,
  onDelete
}) {
  const isNewProduct = Boolean(product?.__isNew);
  const initialPresetIds = getPresetIdsFromProduct(product, optionGroupPresets);
  const [selectedPresetIds, setSelectedPresetIds] = useState(initialPresetIds);
  const [pickerSelectedIds, setPickerSelectedIds] = useState(initialPresetIds);
  const [draft, setDraft] = useState({
    ...product,
    optionGroups: buildOptionGroupsFromPresets(initialPresetIds, optionGroupPresets)
  });
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [draggingSelectedId, setDraggingSelectedId] = useState("");
  const [draggingPickerId, setDraggingPickerId] = useState("");
  const selectedPresetList = useMemo(() => {
    const map = new Map(optionGroupPresets.map(preset => [preset.id, preset]));
    return selectedPresetIds.map(id => map.get(id)).filter(Boolean);
  }, [optionGroupPresets, selectedPresetIds]);
  const filteredPresetList = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return optionGroupPresets;
    return optionGroupPresets.filter(preset => String(preset.name || "").toLowerCase().includes(query));
  }, [groupSearch, optionGroupPresets]);
  const patch = (field, value) => setDraft(current => ({
    ...current,
    [field]: value
  }));
  const togglePreset = presetId => {
    setPickerSelectedIds(current => {
      const exists = current.includes(presetId);
      return exists ? current.filter(id => id !== presetId) : [...current, presetId];
    });
  };
  const reorderByDrop = (list, draggedId, targetId) => {
    const fromIndex = list.indexOf(draggedId);
    const toIndex = list.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;
    return moveItem(list, fromIndex, toIndex);
  };
  const hasPickerChanges = useMemo(() => {
    const normalize = list => [...list].sort().join("|");
    return normalize(pickerSelectedIds) !== normalize(selectedPresetIds);
  }, [pickerSelectedIds, selectedPresetIds]);
  const handleImageUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh nên dưới 2MB để app tải nhanh hơn.");
      event.target.value = "";
      return;
    }
    try {
      const result = await processUploadImage(file, {
        maxWidth: 960,
        quality: 0.62
      });
      try {
        const uploaded = await uploadImageToMenuBucket(result.file, {
          folder: "products",
          stableKey: String(draft?.id || draft?.name || "product"),
          currentUrl: String(draft?.image || "")
        });
        patch("image", uploaded.publicUrl);
      } catch (_uploadError) {
        patch("image", result.dataUrl);
      }
    } catch (error) {
      alert(error?.message || "Không thể xử lý ảnh tải lên.");
    } finally {
      event.target.value = "";
    }
  };
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop admin-side-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-product-modal admin-product-side-panel",
      onClick: event => event.stopPropagation(),
      children: [!groupPickerOpen ? /*#__PURE__*/_jsxs("div", {
        className: "admin-product-modal-head admin-product-side-head menu-item-editor-head",
        children: [/*#__PURE__*/_jsx(AdminIconButton, {
          label: "\u0110\xF3ng",
          onClick: onClose,
          children: "\xD7"
        }), /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h2", {
            children: isNewProduct ? "THÊM MÓN MỚI" : "CHỈNH SỬA MÓN"
          }), /*#__PURE__*/_jsx("p", {
            children: isNewProduct ? "Điền thông tin món mới để bắt đầu bán." : "Cập nhật tên, giá, mô tả và nhóm tuỳ chọn cho món."
          })]
        })]
      }) : /*#__PURE__*/_jsxs("div", {
        className: "admin-product-modal-head admin-product-side-head menu-item-picker-head",
        children: [/*#__PURE__*/_jsx(AdminIconButton, {
          label: "Quay l\u1EA1i",
          onClick: () => {
            setGroupPickerOpen(false);
            setGroupSearch("");
          },
          children: "\u2039"
        }), /*#__PURE__*/_jsx("div", {
          children: /*#__PURE__*/_jsx("h2", {
            children: "LI\xCAN K\u1EBET NH\xD3M T\xD9Y CH\u1ECCN"
          })
        })]
      }), !groupPickerOpen ? /*#__PURE__*/_jsxs("div", {
        className: "admin-product-form admin-product-side-form menu-item-editor-form",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "wide menu-item-image-row",
          children: [/*#__PURE__*/_jsx("div", {
            className: "menu-item-image-preview",
            children: /*#__PURE__*/_jsx("img", {
              src: draft.image,
              alt: draft.name
            })
          }), /*#__PURE__*/_jsxs("label", {
            className: "menu-item-image-upload",
            children: [/*#__PURE__*/_jsx("input", {
              type: "file",
              accept: "image/png,image/jpeg,image/webp",
              onChange: handleImageUpload
            }), /*#__PURE__*/_jsx("span", {
              children: "TH\xCAM \u1EA2NH"
            })]
          })]
        }), /*#__PURE__*/_jsxs("label", {
          children: ["T\xCAN *", /*#__PURE__*/_jsx(AdminInput, {
            placeholder: "V\xED d\u1EE5: B\xE1nh tr\xE1ng tr\u1ED9n \u0111\u1EB7c bi\u1EC7t",
            value: draft.name,
            onChange: event => patch("name", event.target.value)
          })]
        }), /*#__PURE__*/_jsxs("label", {
          children: ["GI\xC1 *", /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            placeholder: "V\xED d\u1EE5: 39000",
            value: draft.price,
            onChange: event => patch("price", Number(event.target.value || 0))
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["M\xD4 T\u1EA2", /*#__PURE__*/_jsx("textarea", {
            placeholder: "M\xF4 t\u1EA3 ng\u1EAFn v\u1EC1 m\xF3n...",
            rows: "3",
            value: draft.short || "",
            onChange: event => patch("short", event.target.value)
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["BADGE", /*#__PURE__*/_jsx(AdminInput, {
            placeholder: "V\xED d\u1EE5: Bestseller, Hot, M\u1EDBi...",
            value: draft.badge || "",
            onChange: event => patch("badge", event.target.value)
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["DANH M\u1EE4C *", /*#__PURE__*/_jsx(AdminSelect, {
            value: draft.category,
            onChange: event => patch("category", event.target.value),
            children: categories.map(category => /*#__PURE__*/_jsx("option", {
              value: category,
              children: category
            }, category))
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["L\u1ECACH B\xC1N *", /*#__PURE__*/_jsxs(AdminSelect, {
            value: draft.visible === false ? "hidden" : "visible",
            onChange: event => patch("visible", event.target.value !== "hidden"),
            children: [/*#__PURE__*/_jsx("option", {
              value: "visible",
              children: "T\u1EA5t c\u1EA3 gi\u1EDD m\u1EDF c\u1EEDa"
            }), /*#__PURE__*/_jsx("option", {
              value: "hidden",
              children: "T\u1EA1m \u1EA9n"
            })]
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide admin-visible-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "B\u1EADt b\xE1n m\xF3n"
          }), /*#__PURE__*/_jsx(AdminSwitch, {
            checked: draft.visible !== false,
            onChange: checked => patch("visible", checked)
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-option-section menu-item-option-section",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "admin-option-head",
            children: [/*#__PURE__*/_jsxs("div", {
              children: [/*#__PURE__*/_jsx("h3", {
                children: "T\xD9Y CH\u1ECCN NH\xD3M"
              }), /*#__PURE__*/_jsx("p", {
                children: "Ch\u1ECDn nh\xF3m topping setup s\u1EB5n \u0111\u1EC3 \xE1p d\u1EE5ng cho m\xF3n."
              })]
            }), /*#__PURE__*/_jsx(AdminButton, {
              variant: "secondary",
              onClick: () => {
                setPickerSelectedIds(selectedPresetIds);
                setGroupPickerOpen(true);
              },
              children: "Ch\u1EC9nh s\u1EEDa"
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "admin-stack",
            children: [selectedPresetList.map(preset => {
              const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
              const selectText = maxSelect === 1 ? "vui lòng chọn 1" : `chọn tối đa ${maxSelect}${preset.required ? "" : " (không bắt buộc)"}`;
              return /*#__PURE__*/_jsx("div", {
                className: `admin-option-group menu-item-linked-group ${draggingSelectedId === preset.id ? "dragging" : ""}`,
                draggable: true,
                onDragStart: () => setDraggingSelectedId(preset.id),
                onDragEnd: () => setDraggingSelectedId(""),
                onDragOver: event => event.preventDefault(),
                onDrop: () => setSelectedPresetIds(current => reorderByDrop(current, draggingSelectedId, preset.id)),
                children: /*#__PURE__*/_jsxs("div", {
                  className: "crm-order-row menu-item-linked-row",
                  children: [/*#__PURE__*/_jsx("span", {
                    className: "menu-item-linked-drag",
                    children: "="
                  }), /*#__PURE__*/_jsx("strong", {
                    children: preset.name
                  }), /*#__PURE__*/_jsxs("span", {
                    children: [(preset.options || []).length, " t\xF9y ch\u1ECDn, ", selectText]
                  }), /*#__PURE__*/_jsx("span", {})]
                })
              }, preset.id);
            }), !selectedPresetList.length && /*#__PURE__*/_jsx("p", {
              className: "admin-help-text",
              children: "Ch\u01B0a ch\u1ECDn nh\xF3m topping n\xE0o cho m\xF3n n\xE0y."
            })]
          })]
        })]
      }) : /*#__PURE__*/_jsxs("div", {
        className: "menu-item-picker-body",
        children: [/*#__PURE__*/_jsx("label", {
          className: "menu-item-picker-search",
          children: /*#__PURE__*/_jsx(AdminInput, {
            value: groupSearch,
            onChange: event => setGroupSearch(event.target.value),
            placeholder: "T\xECm theo t\xEAn nh\xF3m t\xF9y ch\u1ECDn"
          })
        }), /*#__PURE__*/_jsxs("div", {
          className: "menu-item-picker-list",
          children: [filteredPresetList.map(preset => {
            const checked = pickerSelectedIds.includes(preset.id);
            const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
            const summary = (preset.options || []).slice(0, 4).map(opt => opt.name).join(", ");
            return /*#__PURE__*/_jsxs("label", {
              className: `menu-item-picker-row ${draggingPickerId === preset.id ? "dragging" : ""}`,
              draggable: checked,
              onDragStart: () => checked && setDraggingPickerId(preset.id),
              onDragEnd: () => setDraggingPickerId(""),
              onDragOver: event => checked && event.preventDefault(),
              onDrop: () => checked && setPickerSelectedIds(current => reorderByDrop(current, draggingPickerId, preset.id)),
              children: [/*#__PURE__*/_jsx("input", {
                type: "checkbox",
                checked: checked,
                onChange: () => togglePreset(preset.id)
              }), /*#__PURE__*/_jsxs("div", {
                children: [/*#__PURE__*/_jsx("strong", {
                  children: preset.name
                }), /*#__PURE__*/_jsxs("span", {
                  children: [(preset.options || []).length, " t\xF9y ch\u1ECDn, ", maxSelect === 1 ? "vui lòng chọn 1" : `chọn tối đa ${maxSelect}${preset.required ? "" : " (không bắt buộc)"}`]
                }), /*#__PURE__*/_jsx("small", {
                  children: summary
                })]
              }), /*#__PURE__*/_jsx("span", {
                className: "menu-item-picker-drag",
                children: checked ? "=" : ""
              })]
            }, preset.id);
          }), !filteredPresetList.length ? /*#__PURE__*/_jsx("p", {
            className: "admin-help-text",
            children: "Kh\xF4ng c\xF3 nh\xF3m ph\xF9 h\u1EE3p."
          }) : null]
        })]
      }), !groupPickerOpen ? /*#__PURE__*/_jsxs("div", {
        className: "admin-modal-actions admin-side-actions menu-item-editor-actions",
        children: [/*#__PURE__*/_jsx(AdminButton, {
          variant: "danger",
          className: "admin-danger",
          onClick: onDelete,
          children: "X\xF3a m\xF3n"
        }), /*#__PURE__*/_jsx("span", {}), /*#__PURE__*/_jsx(AdminButton, {
          variant: "secondary",
          className: "admin-secondary",
          onClick: onClose,
          children: "Xem tr\u01B0\u1EDBc"
        }), /*#__PURE__*/_jsx(AdminButton, {
          onClick: () => {
            const {
              __isNew: _ignore,
              ...payload
            } = draft;
            if (!String(payload.name || "").trim()) {
              alert("Vui lòng nhập tên món.");
              return;
            }
            if (Number(payload.price || 0) <= 0) {
              alert("Vui lòng nhập giá món lớn hơn 0.");
              return;
            }
            payload.badge = String(payload.badge || "").trim();
            payload.category = resolveValidCategory(payload.category, categories);
            payload.optionGroups = buildOptionGroupsFromPresets(selectedPresetIds, optionGroupPresets);
            onSave(payload);
          },
          children: "L\u01B0u v\xE0 th\xEAm th\xF4ng tin danh m\u1EE5c"
        })]
      }) : /*#__PURE__*/_jsx("div", {
        className: "admin-side-actions menu-item-picker-actions",
        children: /*#__PURE__*/_jsxs(AdminButton, {
          className: hasPickerChanges ? "menu-item-picker-confirm-active" : "",
          onClick: () => {
            if (hasPickerChanges) {
              setSelectedPresetIds(pickerSelectedIds);
              setDraft(old => ({
                ...old,
                optionGroups: buildOptionGroupsFromPresets(pickerSelectedIds, optionGroupPresets)
              }));
            }
            setGroupPickerOpen(false);
            setGroupSearch("");
          },
          children: ["Li\xEAn k\u1EBFt ", pickerSelectedIds.length, " Nh\xF3m t\xF9y ch\u1ECDn"]
        })
      })]
    })
  });
}