import { AdminButton, AdminCard, AdminIconButton, AdminInput, AdminSelect } from "../../ui/index.js";

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
  return (
    <AdminCard className="admin-panel admin-menu-section">
      <div className="admin-menu-filter-row admin-menu-sticky-toolbar">
        <div className="admin-menu-left-actions">
          <AdminButton onClick={createPreset}>+ Tạo nhóm tùy chọn mới</AdminButton>
        </div>
        <AdminInput className="admin-input admin-menu-search" value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Tìm theo tên nhóm tùy chọn" />
      </div>

      <div className="admin-menu-board admin-menu-groups-board">
        <div className="admin-menu-col">
          <div className="admin-menu-col-head"><strong>Nhóm tùy chọn</strong></div>
          <div className="admin-menu-categories">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className={`admin-menu-category-item admin-menu-preset-item ${selectedPreset?.id === preset.id ? "active" : ""}`}
                onClick={() => setSelectedPresetId(preset.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPresetId(preset.id);
                  }
                }}
              >
                <span>{preset.name}</span>
                <div className="admin-menu-preset-actions">
                  <em>{(preset.options || []).length}</em>
                  <AdminIconButton label="Chỉnh sửa nhóm tùy chọn" className="admin-menu-preset-edit-btn" onClick={(event) => { event.stopPropagation(); openPresetEditor(preset); }}>✎</AdminIconButton>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-menu-col">
          <div className="admin-menu-col-head"><strong>Tùy chọn</strong></div>
          {selectedPreset ? (
            <div className="admin-stack" style={{ padding: 12 }}>
              {(selectedPreset.options || []).map((option) => (
                <div key={option.id} className="admin-option-group">
                  <div className="admin-option-group-row">
                    <AdminInput value={option.name || ""} onChange={(event) => updatePresetOption(selectedPreset.id, option.id, { name: event.target.value })} />
                    <AdminInput type="number" value={Number(option.price || 0)} onChange={(event) => updatePresetOption(selectedPreset.id, option.id, { price: Number(event.target.value || 0) })} />
                    <AdminSelect value={option.active === false ? "off" : "on"} onChange={(event) => updatePresetOption(selectedPreset.id, option.id, { active: event.target.value === "on" })}>
                      <option value="on">Có bán</option>
                      <option value="off">Tạm ẩn</option>
                    </AdminSelect>
                    <AdminIconButton label="Xóa tùy chọn" variant="danger" className="admin-option-remove" onClick={() => removePresetOption(selectedPreset.id, option.id)}>×</AdminIconButton>
                  </div>
                </div>
              ))}

              <AdminButton variant="secondary" className="admin-secondary" onClick={() => addPresetOption(selectedPreset.id)}>Thêm tùy chọn</AdminButton>
            </div>
          ) : (
            <p className="admin-help-text" style={{ padding: 12 }}>Chưa có nhóm tùy chọn.</p>
          )}
        </div>
      </div>
    </AdminCard>
  );
}
