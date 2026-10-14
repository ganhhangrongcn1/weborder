import { AdminBadge, AdminInput } from "../ui/index.js";

export default function AppearanceBlockList({
  search,
  setSearch,
  filteredBlocks,
  getBlockData,
  selectedBlockId,
  setSelectedBlockId,
  setBlockActive
}) {
  return (
    <div className="admin-appearance-col admin-appearance-nav">
      <div className="admin-appearance-nav-head">
        <div>
          <strong>Danh sách giao diện</strong>
          <small>Chọn nội dung cần chỉnh. Thứ tự Home hiện được cố định.</small>
        </div>
        <AdminBadge tone="brand">{filteredBlocks.length}</AdminBadge>
      </div>

      <div className="admin-appearance-filterbar">
        <AdminInput
          className="admin-appearance-search"
          placeholder="Tìm theo tên giao diện, vị trí..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="admin-appearance-list" role="list">
        {filteredBlocks.map((block) => {
          const blockData = getBlockData(block.id);
          const canToggle = block.canToggle !== false;
          const isActive = !canToggle || blockData?.active !== false;
          const selected = selectedBlockId === block.id;

          return (
            <div key={block.id} className={`admin-appearance-fixed-item ${selected ? "selected" : ""}`} role="listitem">
              <button type="button" className="admin-appearance-row-main" aria-pressed={selected} onClick={() => setSelectedBlockId(block.id)}>
                <span className="admin-appearance-row-icon">{selected ? "✓" : "•"}</span>
                <span>
                  <strong>{block.title}</strong>
                  <small>{block.placement}</small>
                </span>
              </button>

              <span className="admin-appearance-row-actions">
                <AdminBadge tone={isActive ? "success" : "neutral"}>
                  {!canToggle ? "Luôn hiển thị" : isActive ? "Đang bật" : "Đang tắt"}
                </AdminBadge>
                {canToggle && <label className="admin-switch">
                  <input
                    type="checkbox"
                    aria-label={`Bật ${block.title}`}
                    checked={isActive}
                    onChange={(event) => {
                      event.stopPropagation();
                      setBlockActive(block.id, event.target.checked);
                    }}
                  />
                  <span />
                </label>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
