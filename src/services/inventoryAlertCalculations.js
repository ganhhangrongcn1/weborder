import { getInventoryLotExpiryState, getInventoryTodayKey } from "./inventoryLotReportCalculations.js";
import { getInventoryStockState } from "./inventoryStockReportCalculations.js";

const DOCUMENT_ROUTE_PAGES = {
  purchase_receipt: "receipts",
  stock_issue: "issues",
  transfer: "transfers",
  waste: "disposals",
  internal_requisition: "requisitions",
  stock_adjustment: "adjustments",
  stock_count: "counts"
};

function getPendingDocumentTitle(document = {}) {
  if (document.status === "in_transit") return "Chờ nhận hàng";
  if (document.status === "received_with_variance") return "Chờ đối chiếu nhận lệch";
  if (document.status === "received") return "Chờ khép phiếu";
  if (document.status === "approved") return "Chờ bước xử lý tiếp theo";
  return "Phiếu đang chờ xử lý";
}

function getPendingDocumentPriority(document = {}) {
  if (document.status === "received_with_variance") return 2;
  if (["waste", "internal_requisition", "stock_adjustment", "stock_count"].includes(document.documentType)) return 3;
  return 4;
}

export function buildInventoryAlerts({ sources = {}, itemById = new Map(), warehouseById = new Map(), todayKey = getInventoryTodayKey() } = {}) {
  const alerts = [];

  (sources.balances || []).forEach((row) => {
    const item = itemById.get(row.itemId);
    const warehouse = warehouseById.get(row.warehouseId);
    if (!item || item.isActive === false || !warehouse) return;
    const quantity = Number(row.quantity || 0);
    const stockState = getInventoryStockState(quantity, item);
    if (stockState === "available") return;
    const isNegative = quantity < 0;
    const isOut = quantity === 0;
    alerts.push({
      id: `stock-${row.warehouseId}-${row.itemId}`,
      category: isNegative ? "negative" : "stock",
      kind: isNegative ? "negative_stock" : isOut ? "out_of_stock" : "reorder",
      severity: isNegative || isOut ? "danger" : "warning",
      priority: isNegative ? 1 : isOut ? 2 : 3,
      title: isNegative ? "Tồn kho đang âm" : isOut ? "Đã hết hàng" : "Cần đặt hàng",
      description: `${item.name} · ${warehouse.name}`,
      warehouseIds: [row.warehouseId],
      warehouseId: row.warehouseId,
      itemId: row.itemId,
      itemName: item.name,
      quantity,
      stockState: isOut || isNegative ? "out" : "low",
      occurredAt: row.updatedAt || ""
    });
  });

  (sources.lots || []).forEach((row) => {
    const item = itemById.get(row.itemId);
    const warehouse = warehouseById.get(row.warehouseId);
    if (!item || item.isActive === false || !item.trackExpiry || !warehouse) return;
    const expiryState = getInventoryLotExpiryState(row, item, todayKey);
    if (!["expired", "expiring"].includes(expiryState)) return;
    alerts.push({
      id: `lot-${row.id}`,
      category: "expiry",
      kind: expiryState,
      severity: expiryState === "expired" ? "danger" : "warning",
      priority: expiryState === "expired" ? 1 : 3,
      title: expiryState === "expired" ? "Lô đã hết hạn" : "Lô sắp hết hạn",
      description: `${item.name} · lô ${row.lotNumber} · ${warehouse.name}`,
      warehouseIds: [row.warehouseId],
      warehouseId: row.warehouseId,
      itemId: row.itemId,
      itemName: item.name,
      lotNumber: row.lotNumber,
      expiresOn: row.expiresOn,
      quantity: Number(row.remainingQuantity || 0),
      occurredAt: row.updatedAt || ""
    });
  });

  (sources.documents || []).forEach((document) => {
    const sourceWarehouse = warehouseById.get(document.sourceWarehouseId);
    const destinationWarehouse = warehouseById.get(document.destinationWarehouseId);
    const warehouseIds = [document.sourceWarehouseId, document.destinationWarehouseId].filter(Boolean);
    const warehouseLabel = [sourceWarehouse?.name, destinationWarehouse?.name].filter(Boolean).join(" → ") || "Kho được phân quyền";
    const priority = getPendingDocumentPriority(document);
    alerts.push({
      id: `document-${document.id}`,
      category: "documents",
      kind: "pending_document",
      severity: priority <= 2 ? "danger" : priority === 3 ? "warning" : "info",
      priority,
      title: getPendingDocumentTitle(document),
      description: `${document.documentNo} · ${warehouseLabel}`,
      warehouseIds,
      warehouseId: document.destinationWarehouseId || document.sourceWarehouseId,
      documentId: document.id,
      documentNo: document.documentNo,
      documentType: document.documentType,
      documentStatus: document.status,
      routePage: DOCUMENT_ROUTE_PAGES[document.documentType] || "ledger",
      occurredAt: document.occurredAt || ""
    });
  });

  return alerts.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.expiresOn && right.expiresOn) return left.expiresOn.localeCompare(right.expiresOn);
    return String(right.occurredAt || "").localeCompare(String(left.occurredAt || ""));
  });
}

export function countInventoryAlerts(alerts = []) {
  return alerts.reduce((counts, alert) => {
    counts.all += 1;
    if (Object.prototype.hasOwnProperty.call(counts, alert.category)) counts[alert.category] += 1;
    return counts;
  }, { all: 0, expiry: 0, stock: 0, negative: 0, documents: 0 });
}

export default { buildInventoryAlerts, countInventoryAlerts };
