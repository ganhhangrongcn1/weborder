import { useMemo, useState } from "react";
import { processUploadImage } from "../../../utils/imageUpload.js";
import { uploadImageToMenuBucket } from "../../../services/supabase/storageService.js";
import { AdminSwitch } from "../ui/AdminCommon.jsx";
import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";

function buildOptionGroupsFromPresets(presetIds, presets) {
  const presetMap = new Map((presets || []).map((item) => [item.id, item]));
  return (presetIds || []).map((presetId) => presetMap.get(presetId)).filter(Boolean).map((preset) => {
    const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
    const activeOptions = (preset.options || []).filter((opt) => opt.active !== false);
    return {
      id: `option-group-${preset.id}`,
      sourcePresetId: preset.id,
      name: preset.name,
      type: maxSelect === 1 ? "single" : "multiple",
      required: Boolean(preset.required),
      maxSelect,
      options: activeOptions.map((opt) => ({
        id: `${preset.id}-${opt.id}`,
        name: opt.name,
        price: Number(opt.price || 0)
      }))
    };
  });
}

function getPresetIdsFromProduct(product, presets) {
  const sourceIds = (product.optionGroups || []).map((group) => group.sourcePresetId).filter(Boolean);
  if (sourceIds.length) return sourceIds;

  const presetNames = new Map((presets || []).map((preset) => [String(preset.name || "").toLowerCase(), preset.id]));
  return (product.optionGroups || []).map((group) => presetNames.get(String(group.name || "").toLowerCase())).filter(Boolean);
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
  const normalizedCategories = (categories || []).map((item) => normalizeTextNfc(item)).filter(Boolean);
  const validCategories = normalizedCategories.filter((item) => item !== allLabel);
  if (!cleaned || cleaned === allLabel) return validCategories[0] || "";
  const matched = validCategories.find((item) => item === cleaned);
  return matched || validCategories[0] || cleaned;
}

export default function AdminProductModal({ product, categories, optionGroupPresets = [], onSave, onClose, onDelete }) {
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
    const map = new Map(optionGroupPresets.map((preset) => [preset.id, preset]));
    return selectedPresetIds.map((id) => map.get(id)).filter(Boolean);
  }, [optionGroupPresets, selectedPresetIds]);
  const filteredPresetList = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return optionGroupPresets;
    return optionGroupPresets.filter((preset) => String(preset.name || "").toLowerCase().includes(query));
  }, [groupSearch, optionGroupPresets]);

  const patch = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const togglePreset = (presetId) => {
    setPickerSelectedIds((current) => {
      const exists = current.includes(presetId);
      return exists ? current.filter((id) => id !== presetId) : [...current, presetId];
    });
  };

  const reorderByDrop = (list, draggedId, targetId) => {
    const fromIndex = list.indexOf(draggedId);
    const toIndex = list.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;
    return moveItem(list, fromIndex, toIndex);
  };

  const hasPickerChanges = useMemo(() => {
    const normalize = (list) => [...list].sort().join("|");
    return normalize(pickerSelectedIds) !== normalize(selectedPresetIds);
  }, [pickerSelectedIds, selectedPresetIds]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh nên dưới 2MB để app tải nhanh hơn.");
      event.target.value = "";
      return;
    }

    try {
      const result = await processUploadImage(file, { maxWidth: 960, quality: 0.62 });
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

  return (
    <div className="admin-modal-backdrop admin-side-backdrop" onClick={onClose}>
      <section className="admin-product-modal admin-product-side-panel" onClick={(event) => event.stopPropagation()}>
        {!groupPickerOpen ? (
          <div className="admin-product-modal-head admin-product-side-head menu-item-editor-head">
            <AdminIconButton label="Đóng" onClick={onClose}>×</AdminIconButton>
            <div>
              <h2>{isNewProduct ? "THÊM MÓN MỚI" : "CHỈNH SỬA MÓN"}</h2>
              <p>{isNewProduct ? "Điền thông tin món mới để bắt đầu bán." : "Cập nhật tên, giá, mô tả và nhóm tuỳ chọn cho món."}</p>
            </div>
          </div>
        ) : (
          <div className="admin-product-modal-head admin-product-side-head menu-item-picker-head">
            <AdminIconButton
              label="Quay lại"
              onClick={() => {
                setGroupPickerOpen(false);
                setGroupSearch("");
              }}
            >
              ‹
            </AdminIconButton>
            <div>
              <h2>LIÊN KẾT NHÓM TÙY CHỌN</h2>
            </div>
          </div>
        )}

        {!groupPickerOpen ? (
          <div className="admin-product-form admin-product-side-form menu-item-editor-form">
          <div className="wide menu-item-image-row">
            <div className="menu-item-image-preview">
              <img src={draft.image} alt={draft.name} />
            </div>
            <label className="menu-item-image-upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} />
              <span>THÊM ẢNH</span>
            </label>
          </div>

          <label>
            TÊN *
            <AdminInput placeholder="Ví dụ: Bánh tráng trộn đặc biệt" value={draft.name} onChange={(event) => patch("name", event.target.value)} />
          </label>

          <label>
            GIÁ *
            <AdminInput type="number" placeholder="Ví dụ: 39000" value={draft.price} onChange={(event) => patch("price", Number(event.target.value || 0))} />
          </label>

          <label className="wide">
            MÔ TẢ
            <textarea placeholder="Mô tả ngắn về món..." rows="3" value={draft.short || ""} onChange={(event) => patch("short", event.target.value)} />
          </label>

          <label className="wide">
            BADGE
            <AdminInput placeholder="Ví dụ: Bestseller, Hot, Mới..." value={draft.badge || ""} onChange={(event) => patch("badge", event.target.value)} />
          </label>

          <label className="wide">
            DANH MỤC *
            <AdminSelect value={draft.category} onChange={(event) => patch("category", event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </AdminSelect>
          </label>

          <label className="wide">
            LỊCH BÁN *
            <AdminSelect value={draft.visible === false ? "hidden" : "visible"} onChange={(event) => patch("visible", event.target.value !== "hidden")}>
              <option value="visible">Tất cả giờ mở cửa</option>
              <option value="hidden">Tạm ẩn</option>
            </AdminSelect>
          </label>

          <label className="wide admin-visible-row">
            <span>Bật bán món</span>
            <AdminSwitch checked={draft.visible !== false} onChange={(checked) => patch("visible", checked)} />
          </label>

          <div className="admin-option-section menu-item-option-section">
            <div className="admin-option-head">
              <div>
                <h3>TÙY CHỌN NHÓM</h3>
                <p>Chọn nhóm topping setup sẵn để áp dụng cho món.</p>
              </div>
              <AdminButton
                variant="secondary"
                onClick={() => {
                  setPickerSelectedIds(selectedPresetIds);
                  setGroupPickerOpen(true);
                }}
              >
                Chỉnh sửa
              </AdminButton>
            </div>

            <div className="admin-stack">
              {selectedPresetList.map((preset) => {
                const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
                const selectText = maxSelect === 1 ? "vui lòng chọn 1" : `chọn tối đa ${maxSelect}${preset.required ? "" : " (không bắt buộc)"}`;
                return (
                  <div
                    key={preset.id}
                    className={`admin-option-group menu-item-linked-group ${draggingSelectedId === preset.id ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => setDraggingSelectedId(preset.id)}
                    onDragEnd={() => setDraggingSelectedId("")}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() =>
                      setSelectedPresetIds((current) => reorderByDrop(current, draggingSelectedId, preset.id))
                    }
                  >
                    <div className="crm-order-row menu-item-linked-row">
                      <span className="menu-item-linked-drag">=</span>
                      <strong>{preset.name}</strong>
                      <span>{(preset.options || []).length} tùy chọn, {selectText}</span>
                      <span />
                    </div>
                  </div>
                );
              })}
              {!selectedPresetList.length && <p className="admin-help-text">Chưa chọn nhóm topping nào cho món này.</p>}
            </div>
          </div>
          </div>
        ) : (
          <div className="menu-item-picker-body">
            <label className="menu-item-picker-search">
              <AdminInput
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Tìm theo tên nhóm tùy chọn"
              />
            </label>
            <div className="menu-item-picker-list">
              {filteredPresetList.map((preset) => {
                const checked = pickerSelectedIds.includes(preset.id);
                const maxSelect = Math.max(1, Number(preset.maxSelect || 1));
                const summary = (preset.options || []).slice(0, 4).map((opt) => opt.name).join(", ");
                return (
                  <label
                    key={preset.id}
                    className={`menu-item-picker-row ${draggingPickerId === preset.id ? "dragging" : ""}`}
                    draggable={checked}
                    onDragStart={() => checked && setDraggingPickerId(preset.id)}
                    onDragEnd={() => setDraggingPickerId("")}
                    onDragOver={(event) => checked && event.preventDefault()}
                    onDrop={() =>
                      checked &&
                      setPickerSelectedIds((current) => reorderByDrop(current, draggingPickerId, preset.id))
                    }
                  >
                    <input type="checkbox" checked={checked} onChange={() => togglePreset(preset.id)} />
                    <div>
                      <strong>{preset.name}</strong>
                      <span>
                        {(preset.options || []).length} tùy chọn, {maxSelect === 1 ? "vui lòng chọn 1" : `chọn tối đa ${maxSelect}${preset.required ? "" : " (không bắt buộc)"}`}
                      </span>
                      <small>{summary}</small>
                    </div>
                    <span className="menu-item-picker-drag">{checked ? "=" : ""}</span>
                  </label>
                );
              })}
              {!filteredPresetList.length ? <p className="admin-help-text">Không có nhóm phù hợp.</p> : null}
            </div>
          </div>
        )}

        {!groupPickerOpen ? (
          <div className="admin-modal-actions admin-side-actions menu-item-editor-actions">
            <AdminButton variant="danger" className="admin-danger" onClick={onDelete}>Xóa món</AdminButton>
            <span />
            <AdminButton variant="secondary" className="admin-secondary" onClick={onClose}>Xem trước</AdminButton>
          <AdminButton
            onClick={() => {
              const { __isNew: _ignore, ...payload } = draft;
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
            }}
          >
            Lưu và thêm thông tin danh mục
          </AdminButton>
          </div>
        ) : (
          <div className="admin-side-actions menu-item-picker-actions">
            <AdminButton
              className={hasPickerChanges ? "menu-item-picker-confirm-active" : ""}
              onClick={() => {
                if (hasPickerChanges) {
                  setSelectedPresetIds(pickerSelectedIds);
                  setDraft((old) => ({
                    ...old,
                    optionGroups: buildOptionGroupsFromPresets(pickerSelectedIds, optionGroupPresets)
                  }));
                }
                setGroupPickerOpen(false);
                setGroupSearch("");
              }}
            >
              Liên kết {pickerSelectedIds.length} Nhóm tùy chọn
            </AdminButton>
          </div>
        )}
      </section>
    </div>
  );
}


