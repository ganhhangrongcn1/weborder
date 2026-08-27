import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";

const STATUS_META = {
  pending: { label: "Chờ xử lý", tone: "draft" },
  processing: { label: "Đang xử lý", tone: "draft" },
  completed: { label: "Đã ghi kho", tone: "active" },
  blocked: { label: "Cần xử lý", tone: "warning" },
  ignored: { label: "Không trừ kho", tone: "inactive" }
};

function toText(value = "") {
  return String(value || "").trim();
}

function getBranchUuid(branch = {}) {
  return toText(branch.branch_uuid || branch.branchUuid || branch.uuid || branch.id);
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", { hour12: false });
}

function quantity(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? number.toLocaleString("vi-VN", { maximumFractionDigits: 6 })
    : "—";
}

function getSourceGroupKey(line = {}, index = 0) {
  const sourceLineKey = toText(line.sourceLineKey);
  if (!sourceLineKey || sourceLineKey.startsWith("stock:")) return `line:${line.id || index}`;
  return sourceLineKey.split(":option:")[0] || sourceLineKey;
}

function getDisplayEventGroups(lines = []) {
  const stockIssues = new Map();
  const groups = new Map();

  lines.forEach((line) => {
    const isStockIssue = line.issueCode === "insufficient_stock"
      && toText(line.sourceLineKey).startsWith("stock:")
      && line.itemId;

    if (isStockIssue) {
      stockIssues.set(line.itemId, line);
      return;
    }

    const groupKey = getSourceGroupKey(line, groups.size);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        name: "",
        fallbackName: "",
        entries: [],
        requirements: new Map()
      });
    }

    const group = groups.get(groupKey);
    const sourceName = toText(line.sourceLineName || line.menuEntityName);
    if (!group.fallbackName && sourceName) group.fallbackName = sourceName;
    if (toText(line.sourceLineKey) === groupKey && sourceName) group.name = sourceName;

    if (!line.itemId || !line.recipeId) {
      group.entries.push({ type: "line", value: line });
      return;
    }

    if (!group.requirements.has(line.itemId)) {
      group.requirements.set(line.itemId, {
        ...line,
        sourceNames: [],
        requiredQuantity: 0
      });
      group.entries.push({ type: "requirement", value: line.itemId });
    }

    const requirement = group.requirements.get(line.itemId);
    if (sourceName && !requirement.sourceNames.includes(sourceName)) requirement.sourceNames.push(sourceName);
    requirement.requiredQuantity += Number(line.requiredQuantity || 0);
  });

  return [...groups.values()].map((group) => {
    const detailLines = group.entries.map((entry) => {
      if (entry.type === "line") return entry.value;
      const requirement = group.requirements.get(entry.value);
      const stockIssue = stockIssues.get(entry.value);
      return {
        ...requirement,
        id: `display:${group.key}:${requirement.itemId}`,
        sourceLineName: requirement.sourceNames.join(", "),
        lineStatus: stockIssue ? "blocked" : requirement.lineStatus,
        issueCode: stockIssue?.issueCode || requirement.issueCode,
        issueMessage: stockIssue?.issueMessage || requirement.issueMessage,
        availableQuantity: stockIssue ? Number(stockIssue.metadata?.available_quantity || 0) : null,
        orderRequiredQuantity: stockIssue ? Number(stockIssue.requiredQuantity || 0) : null
      };
    });
    const needsAction = detailLines.some((line) => line.lineStatus === "blocked");
    const ignored = detailLines.length > 0 && detailLines.every((line) => line.lineStatus === "ignored");
    const hasStockIssue = detailLines.some((line) => line.issueCode === "insufficient_stock");
    const ingredientCount = detailLines.filter((line) => line.itemId).length;
    const missingCount = detailLines.filter((line) => !line.itemId || !line.recipeId).length;

    return {
      key: group.key,
      name: group.name || group.fallbackName || "Món chưa xác định",
      detailLines,
      ingredientCount,
      missingCount,
      needsAction,
      ignored,
      hasStockIssue
    };
  });
}

export default function InventorySalesReconciliation({
  rows = [],
  branches = [],
  warehouses = [],
  items = [],
  units = [],
  canWrite = false,
  mutationStatus = "idle",
  mutationMessage = "",
  message = "",
  loading = false,
  hasMore = false,
  filters = {},
  onFiltersChange,
  onRetry
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("needs_action");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedDishGroups, setExpandedDishGroups] = useState(() => new Set());
  const query = search.trim().toLocaleLowerCase("vi");
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const needsActionCount = rows.filter((row) => ["pending", "processing", "blocked"].includes(row.processingStatus)).length;
  const branchOptions = useMemo(() => branches.map((branch) => {
    const branchUuid = getBranchUuid(branch);
    return {
      value: branchUuid,
      label: branch.name || "Chi nhánh chưa đặt tên",
      count: rows.filter((row) => row.branchUuid === branchUuid).length
    };
  }).filter((option) => option.value && option.count > 0), [branches, rows]);
  const filteredRows = rows.filter((row) => {
    if (branchFilter !== "all" && row.branchUuid !== branchFilter) return false;
    if (statusFilter === "needs_action" && !["pending", "processing", "blocked"].includes(row.processingStatus)) return false;
    if (statusFilter !== "all" && statusFilter !== "needs_action" && row.processingStatus !== statusFilter) return false;
    if (!query) return true;
    return [
      row.sourceOrderKey,
      row.issueMessage,
      row.sourceType,
      ...row.lines.flatMap((line) => [line.sourceLineName, line.menuEntityName, line.issueMessage])
    ].some((value) => toText(value).toLocaleLowerCase("vi").includes(query));
  });

  const getBranch = (event) => branches.find((row) => getBranchUuid(row) === event.branchUuid);
  const getWarehouse = (event) => warehouses.find((row) => row.id === event.warehouseId);
  const openEvent = (event) => {
    const firstProblemGroup = getDisplayEventGroups(event.lines).find((group) => group.needsAction);
    setExpandedDishGroups(new Set(firstProblemGroup ? [firstProblemGroup.key] : []));
    setSelectedEvent(event);
  };
  const toggleDishGroup = (groupKey) => setExpandedDishGroups((current) => {
    const next = new Set(current);
    if (next.has(groupKey)) next.delete(groupKey);
    else next.add(groupKey);
    return next;
  });
  const updateDateFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    if (key === "dateFrom" && value && nextFilters.dateTo && value > nextFilters.dateTo) nextFilters.dateTo = value;
    if (key === "dateTo" && value && nextFilters.dateFrom && value < nextFilters.dateFrom) nextFilters.dateFrom = value;
    onFiltersChange?.(nextFilters);
  };

  return (
    <section className="inventory-list-card inventory-sales-reconciliation">
      <div className="inventory-sales-manager__head">
        <div><span><Icon name="warning" size={20} /></span><div><strong>Đối chiếu đơn bán và kho</strong><small>Kiểm tra đơn đã trừ kho, đơn bị treo và nguyên nhân cần bổ sung.</small></div></div>
        <span className={`inventory-reconciliation-count${needsActionCount ? " is-alert" : ""}`}>{loading ? "Đang tải..." : `${needsActionCount} cần xử lý`}</span>
      </div>

      <div className="inventory-sales-safe-note"><Icon name="check" size={16} /> Đơn chưa đủ định lượng hoặc ánh xạ sẽ bị chặn toàn bộ, không trừ tồn dở dang.</div>
      {message ? <div className="inventory-count-notice is-error"><Icon name="warning" size={16} />{message}</div> : null}
      {mutationMessage ? <div className={`inventory-count-notice${mutationStatus === "error" ? " is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={16} />{mutationMessage}</div> : null}

      <div className="inventory-list-toolbar inventory-reconciliation-toolbar">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn hoặc tên món..." /></label>
        <label className="inventory-reconciliation-date"><span>Từ ngày</span><input type="date" value={filters.dateFrom || ""} max={filters.dateTo || undefined} onChange={(event) => updateDateFilter("dateFrom", event.target.value)} /></label>
        <label className="inventory-reconciliation-date"><span>Đến ngày</span><input type="date" value={filters.dateTo || ""} min={filters.dateFrom || undefined} onChange={(event) => updateDateFilter("dateTo", event.target.value)} /></label>
        <InventorySearchableSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái đối soát">
          <option value="needs_action">Cần xử lý ({needsActionCount})</option>
          <option value="all">Tất cả ({rows.length})</option>
          <option value="completed">Đã ghi kho</option>
          <option value="blocked">Bị chặn</option>
          <option value="ignored">Không trừ kho</option>
        </InventorySearchableSelect>
        <InventorySearchableSelect value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} aria-label="Lọc đối soát theo chi nhánh">
          <option value="all">Tất cả chi nhánh ({rows.length})</option>
          {branchOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
        </InventorySearchableSelect>
      </div>
      {hasMore ? <div className="inventory-reconciliation-limit"><Icon name="warning" size={15} />Đang hiển thị 200 đơn mới nhất trong khoảng ngày đã chọn. Thu hẹp ngày để xem đủ dữ liệu.</div> : null}

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-sales-events-table">
          <thead><tr><th>Đơn bán</th><th>Thời gian</th><th>Chi nhánh / kho</th><th>Kết quả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{filteredRows.map((event) => {
            const status = STATUS_META[event.processingStatus] || STATUS_META.pending;
            const blockedLines = event.lines.filter((line) => line.lineStatus === "blocked");
            const branch = getBranch(event);
            const warehouse = getWarehouse(event);
            return <tr key={event.id} className="inventory-clickable-row" onClick={() => openEvent(event)}>
              <td><strong>{event.sourceOrderKey}</strong><small>{event.sourceType === "partner_order" ? "Đơn app" : "Website / POS / QR"} · {event.eventType === "reversal" ? "Hoàn tồn" : "Xuất bán"}</small></td>
              <td><strong>{dateTime(event.occurredAt)}</strong><small>{event.attempts} lần xử lý</small></td>
              <td><strong>{branch?.name || "Chưa xác định chi nhánh"}</strong><small>{warehouse?.name || "Chưa xác định kho"}</small></td>
              <td><strong>{event.issueMessage || (event.documentId ? "Đã tạo chứng từ kho" : "Đang chờ xử lý")}</strong><small>{blockedLines.slice(0, 2).map((line) => line.sourceLineName || line.issueMessage).filter(Boolean).join(", ")}</small></td>
              <td><span className={`inventory-bom-status is-${status.tone}`}>{status.label}</span></td>
              <td><div className="inventory-row-actions inventory-sales-actions"><button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); openEvent(event); }}><Icon name="eye" size={14} /> Xem</button>{["blocked", "ignored"].includes(event.processingStatus) ? <button type="button" className="is-primary" disabled={!canWrite || mutationStatus === "saving"} onClick={(clickEvent) => { clickEvent.stopPropagation(); onRetry?.(event.id); }}><Icon name="refresh" size={14} /> Thử lại</button> : null}</div></td>
            </tr>;
          })}</tbody>
        </table>
        {!filteredRows.length ? <div className="inventory-list-empty"><span><Icon name="check" size={24} /></span><strong>Không có đơn phù hợp</strong><span>{statusFilter === "needs_action" ? "Chi nhánh đang chọn không có đơn bán bị treo." : "Đổi chi nhánh, trạng thái hoặc từ khóa để xem lại."}</span></div> : null}
      </div>

      {selectedEvent ? (() => {
        const status = STATUS_META[selectedEvent.processingStatus] || STATUS_META.pending;
        const branch = getBranch(selectedEvent);
        const warehouse = getWarehouse(selectedEvent);
        const displayGroups = getDisplayEventGroups(selectedEvent.lines);
        const problemGroupCount = displayGroups.filter((group) => group.needsAction).length;
        const validGroupCount = displayGroups.filter((group) => !group.needsAction && !group.ignored).length;
        const ignoredGroupCount = displayGroups.filter((group) => group.ignored).length;
        return <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedEvent(null)}>
          <section className="inventory-warehouse-modal inventory-sales-event-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-sales-event-title">
            <header><div className="inventory-modal-heading"><span><Icon name="refresh" size={20} /></span><div><h2 id="inventory-sales-event-title">Chi tiết đối soát trừ kho</h2><p>{selectedEvent.sourceOrderKey}</p></div></div><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Đóng"><Icon name="close" size={18} /></button></header>
            <div className="inventory-sales-event-modal__body">
              <div className="inventory-sales-event-summary">
                <div><span>Trạng thái</span><strong><span className={`inventory-bom-status is-${status.tone}`}>{status.label}</span></strong></div>
                <div><span>Chi nhánh</span><strong>{branch?.name || "Chưa xác định"}</strong></div>
                <div><span>Kho trừ</span><strong>{warehouse?.name || "Chưa xác định"}</strong></div>
                <div><span>Thời gian</span><strong>{dateTime(selectedEvent.occurredAt)}</strong></div>
              </div>
              {selectedEvent.issueMessage ? <div className="inventory-count-notice is-error"><Icon name="warning" size={16} />{selectedEvent.issueMessage}</div> : null}
              <div className="inventory-sales-dish-summary">
                <strong>{displayGroups.length} món / lựa chọn</strong>
                <span>{problemGroupCount ? `${problemGroupCount} cần bổ sung` : "Không có món lỗi"}</span>
                <span>{validGroupCount} hợp lệ</span>
                {ignoredGroupCount ? <span>{ignoredGroupCount} không trừ kho</span> : null}
              </div>
              <div className="inventory-sales-dish-list">
                {displayGroups.map((group) => {
                  const statusLabel = group.needsAction
                    ? (group.hasStockIssue ? "Thiếu tồn" : "Cần bổ sung")
                    : (group.ignored ? "Không trừ kho" : "Hợp lệ");
                  const statusTone = group.needsAction ? "warning" : (group.ignored ? "inactive" : "active");
                  const detailLabel = group.ingredientCount
                    ? `${group.ingredientCount} nguyên liệu${group.missingCount ? ` · ${group.missingCount} cần bổ sung` : ""}`
                    : `${group.missingCount || group.detailLines.length} cấu hình cần kiểm tra`;
                  const expanded = expandedDishGroups.has(group.key);
                  return <section key={group.key} className={`inventory-sales-dish${group.needsAction ? " is-warning" : ""}`}>
                    <button type="button" className="inventory-sales-dish__toggle" aria-expanded={expanded} onClick={() => toggleDishGroup(group.key)}>
                      <span className="inventory-sales-dish__chevron">›</span>
                      <span className="inventory-sales-dish__name"><strong>{group.name}</strong><small>{detailLabel}</small></span>
                      <span className={`inventory-bom-status is-${statusTone}`}>{statusLabel}</span>
                    </button>
                    {expanded ? <div className="inventory-table-scroll">
                      <table className="inventory-data-table inventory-sales-event-lines-table">
                        <thead><tr><th>Nguyên liệu / cấu hình</th><th>Nguồn trong món</th><th>Số lượng trừ</th><th>Kết quả</th></tr></thead>
                        <tbody>{group.detailLines.map((line) => {
                          const item = itemById.get(line.itemId) || {};
                          const unit = unitById.get(item.baseUnitId || item.base_unit_id) || {};
                          const unitLabel = unit.symbol || unit.name || "";
                          const isStockShortage = line.issueCode === "insufficient_stock";
                          return <tr key={line.id}>
                            <td><strong>{item.name || (line.recipeId ? "Đã nhận định lượng" : "Chưa có định lượng")}</strong><small>{item.code || ""}</small></td>
                            <td><strong>{line.sourceLineName || line.menuEntityName || group.name}</strong><small>{line.menuEntityName && line.menuEntityName !== line.sourceLineName ? `Gán vào: ${line.menuEntityName}` : ""}</small></td>
                            <td><strong>{quantity(line.requiredQuantity)} {unitLabel}</strong></td>
                            <td>
                              <span className={`inventory-bom-status is-${line.lineStatus === "blocked" ? "warning" : (line.lineStatus === "ignored" ? "inactive" : "active")}`}>{line.lineStatus === "blocked" ? (isStockShortage ? "Thiếu tồn" : "Cần bổ sung") : (line.lineStatus === "ignored" ? "Không trừ kho" : "Hợp lệ")}</span>
                              <small>{isStockShortage
                                ? `Tồn hiện tại: ${quantity(line.availableQuantity)} ${unitLabel} · Tổng đơn cần: ${quantity(line.orderRequiredQuantity)} ${unitLabel}`
                                : (line.issueMessage || "Sẵn sàng ghi kho")}</small>
                            </td>
                          </tr>;
                        })}</tbody>
                      </table>
                    </div> : null}
                  </section>;
                })}
              </div>
            </div>
            <footer className="inventory-bom-confirm-modal__footer"><a className="inventory-modal-link" href="/admin/inventory/sales-recipes">Mở định lượng món bán</a><button type="button" onClick={() => setSelectedEvent(null)}>Đóng</button>{["blocked", "ignored"].includes(selectedEvent.processingStatus) ? <button type="button" className="is-primary" disabled={!canWrite || mutationStatus === "saving"} onClick={() => onRetry?.(selectedEvent.id)}><Icon name="refresh" size={14} /> Thử lại</button> : null}</footer>
          </section>
        </div>;
      })() : null}
    </section>
  );
}
