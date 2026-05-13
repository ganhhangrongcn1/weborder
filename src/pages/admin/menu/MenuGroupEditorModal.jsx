import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";

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

  const isNewPreset =
    editingPresetId.startsWith("preset-") &&
    !optionGroupPresets.some((item) => item.id === editingPresetId);

  return (
    <div className="admin-modal-backdrop admin-side-backdrop" onClick={onClose}>
      <section
        className="admin-product-modal admin-product-side-panel group-editor-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-product-modal-head admin-product-side-head">
          <AdminIconButton label="Đóng" onClick={onClose}>
            ×
          </AdminIconButton>
          <div>
            <h2>{isNewPreset ? "TẠO NHÓM TÙY CHỌN MỚI" : "CHỈNH SỬA NHÓM TÙY CHỌN"}</h2>
            <p>Cấu hình nhóm topping dùng chung cho nhiều món.</p>
          </div>
        </div>

        <div className="admin-product-form admin-product-side-form group-editor-form">
          <label className="wide group-editor-name">
            Tên nhóm tùy chọn
            <AdminInput
              placeholder="Nhóm tùy chọn mới"
              value={editingPresetDraft.name || ""}
              onChange={(event) => patchEditingPreset({ name: event.target.value })}
            />
          </label>

          <div className="admin-option-section group-editor-block">
            <div className="admin-option-head">
              <h3>TÙY CHỌN</h3>
            </div>
            <div className="group-option-grid-head">
              <span>TÊN TÙY CHỌN *</span>
              <span>GIÁ BỔ SUNG</span>
            </div>
            {(editingPresetDraft.options || []).map((option) => (
              <div
                key={option.id}
                className={`admin-option-group group-option-card ${
                  draggingEditingOptionId === option.id ? "dragging" : ""
                }`}
                draggable
                onDragStart={() => setDraggingEditingOptionId(option.id)}
                onDragEnd={() => setDraggingEditingOptionId("")}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderEditingOptions(draggingEditingOptionId, option.id)}
              >
                <div className="group-option-row">
                  <span className="group-drag">≡</span>
                  <AdminInput
                    placeholder="Tùy chọn mới"
                    value={option.name || ""}
                    onChange={(event) =>
                      patchEditingOption(option.id, { name: event.target.value })
                    }
                  />
                  <AdminInput
                    type="number"
                    value={Number(option.price || 0)}
                    onChange={(event) =>
                      patchEditingOption(option.id, {
                        price: Number(event.target.value || 0)
                      })
                    }
                  />
                  <AdminIconButton
                    label="Xóa tùy chọn"
                    variant="danger"
                    className="admin-option-remove"
                    onClick={() => removeEditingOption(option.id)}
                  >
                    ×
                  </AdminIconButton>
                </div>
              </div>
            ))}
            <AdminButton
              variant="secondary"
              className="group-add-option-btn"
              onClick={addEditingOption}
            >
              Thêm tùy chọn mới
            </AdminButton>
          </div>

          <div className="admin-option-section group-editor-block">
            <div className="admin-option-head">
              <h3>QUY TẮC LỰA CHỌN</h3>
            </div>
            <div className="group-rule-box">
              <label
                className="group-rule-radio"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  textTransform: "none"
                }}
              >
                <input
                  style={{ margin: 0 }}
                  type="radio"
                  name={`rule-${editingPresetDraft.id}`}
                  checked={editingPresetDraft.required}
                  onChange={() => patchEditingPreset({ required: true })}
                />
                <span>Khách hàng phải chọn</span>
              </label>
              <div className="group-rule-inline">
                <AdminSelect
                  value={Number(editingPresetDraft.maxSelect || 1) === 1 ? "exact" : "max"}
                  onChange={(event) =>
                    patchEditingPreset({
                      maxSelect:
                        event.target.value === "exact"
                          ? 1
                          : Math.max(2, Number(editingPresetDraft.maxSelect || 2))
                    })
                  }
                >
                  <option value="exact">Chính xác</option>
                  <option value="max">Tối đa</option>
                </AdminSelect>
                <AdminInput
                  type="number"
                  min="1"
                  value={Number(editingPresetDraft.maxSelect || 1)}
                  onChange={(event) =>
                    patchEditingPreset({
                      maxSelect: Math.max(1, Number(event.target.value || 1))
                    })
                  }
                />
              </div>
              <label
                className="group-rule-radio"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  textTransform: "none"
                }}
              >
                <input
                  style={{ margin: 0 }}
                  type="radio"
                  name={`rule-${editingPresetDraft.id}`}
                  checked={!editingPresetDraft.required}
                  onChange={() => patchEditingPreset({ required: false })}
                />
                <span>Không bắt buộc khách phải chọn</span>
              </label>
              <p className="group-rule-note">
                {Number(editingPresetDraft.maxSelect || 1) === 1
                  ? "Khách chỉ có thể chọn 1 tùy chọn khi đặt món."
                  : `Khách có thể chọn tối đa ${Number(
                      editingPresetDraft.maxSelect || 1
                    )} tùy chọn khi đặt món.`}
              </p>
            </div>
          </div>

          <div className="admin-option-section group-editor-block">
            <div className="admin-option-head">
              <h3>Đã liên kết món</h3>
            </div>
            <div className="group-linked-empty">
              <span>🛍️</span>
              <p>
                Liên kết món với nhóm tùy chọn mà bạn muốn khách hàng sử dụng để có thể thêm
                vào món.
              </p>
            </div>
          </div>
        </div>

        <div className="admin-modal-actions admin-side-actions">
          <AdminButton variant="secondary" className="admin-secondary" onClick={onClose}>
            Hủy
          </AdminButton>
          {!isNewPreset && (
            <AdminButton
              variant="danger"
              className="admin-danger"
              onClick={deletePresetFromEditor}
            >
              Xóa nhóm
            </AdminButton>
          )}
          <AdminButton onClick={savePresetFromEditor}>Lưu nhóm tùy chọn</AdminButton>
        </div>
      </section>
    </div>
  );
}
