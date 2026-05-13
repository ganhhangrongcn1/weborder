import { AdminBadge, AdminInput } from "../ui/index.js";

export default function AppearanceBlockList({
  search,
  setSearch,
  filteredBlocks,
  getBlockData,
  draggingBlockId,
  setDraggingBlockId,
  reorderBlocks,
  selectedBlockId,
  setSelectedBlockId,
  setBlockActive
}) {
  return (
    <div className="admin-appearance-col admin-appearance-nav">
      <div className="admin-appearance-nav-head">
        <div>
          <strong>Danh sách giao diện</strong>
          <small>Bật/tắt và sắp xếp thứ tự block trên Home.</small>
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
          const isActive = blockData?.active !== false;
          const selected = selectedBlockId === block.id;

          return (
            <button
              key={block.id}
              type="button"
              draggable
              onDragStart={() => setDraggingBlockId(block.id)}
              onDragEnd={() => setDraggingBlockId("")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                reorderBlocks(draggingBlockId, block.id);
                setDraggingBlockId("");
              }}
              onClick={() => setSelectedBlockId(block.id)}
              className={`admin-appearance-fixed-item ${selected ? "selected" : ""} ${draggingBlockId === block.id ? "opacity-70" : ""}`}
              role="listitem"
            >
              <span className="admin-appearance-row-main">
                <span className="admin-appearance-row-icon">{selected ? "✓" : "•"}</span>
                <span>
                  <strong>{block.title}</strong>
                  <small>{block.placement}</small>
                </span>
              </span>

              <span className="admin-appearance-row-actions">
                <AdminBadge tone={isActive ? "success" : "neutral"}>
                  {isActive ? "Đang hiển thị" : "Đã ẩn"}
                </AdminBadge>
                <label className="admin-switch" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => {
                      event.stopPropagation();
                      setBlockActive(block.id, event.target.checked);
                    }}
                  />
                  <span />
                </label>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
