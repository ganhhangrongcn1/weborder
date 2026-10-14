function toQuantity(value) {
  const quantity = Number(value || 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

export function sumInventoryMovementQuantities(rows = [], direction = "") {
  return rows.reduce((total, row) => {
    if (direction && row?.direction !== direction) return total;
    return total + toQuantity(row?.quantity);
  }, 0);
}

export function calculateInventoryLedgerSummary({
  currentBalance = 0,
  periodMovements = [],
  futureMovements = []
} = {}) {
  const inbound = sumInventoryMovementQuantities(periodMovements, "in");
  const outbound = sumInventoryMovementQuantities(periodMovements, "out");
  const futureInbound = sumInventoryMovementQuantities(futureMovements, "in");
  const futureOutbound = sumInventoryMovementQuantities(futureMovements, "out");
  const closing = toQuantity(currentBalance) - futureInbound + futureOutbound;
  const opening = closing - inbound + outbound;

  return { opening, inbound, outbound, closing, currentBalance: toQuantity(currentBalance) };
}

const PRODUCTION_DOCUMENT_TYPES = new Set([
  "production_consumption",
  "production_output"
]);

export function isInventoryProductionDocument(documentType = "") {
  return PRODUCTION_DOCUMENT_TYPES.has(String(documentType || "").trim());
}

export function getInventoryLedgerDocumentNo({
  documentNo = "",
  documentType = "",
  productionOrderNo = ""
} = {}) {
  const stockDocumentNo = String(documentNo || "").trim();
  if (!isInventoryProductionDocument(documentType)) return stockDocumentNo;
  return String(productionOrderNo || "").trim() || stockDocumentNo.replace(/^SX-(?:IN|OUT)-/i, "");
}

export function getInventoryMovementLabel({ stage = "", documentType = "" } = {}) {
  if (isInventoryProductionDocument(documentType)) return "Sản xuất";

  const labels = {
    completion: "Hoàn tất phiếu",
    dispatch: "Giao hàng",
    receipt: "Nhận hàng",
    adjustment: "Điều chỉnh",
    reversal: "Hoàn tác",
    order_consumption: "Bán hàng"
  };
  return labels[String(stage || "").trim()] || String(stage || "").trim() || "Biến động kho";
}

export function getInventoryDocumentPath(documentType = "", { productionOrderId = "" } = {}) {
  if (isInventoryProductionDocument(documentType)) {
    const query = productionOrderId ? `?order=${encodeURIComponent(productionOrderId)}` : "";
    return `/admin/inventory/production-orders${query}`;
  }

  const paths = {
    purchase_receipt: "/admin/inventory/receipts",
    stock_issue: "/admin/inventory/issues",
    transfer: "/admin/inventory/transfers",
    waste: "/admin/inventory/disposals",
    internal_requisition: "/admin/inventory/requisitions",
    stock_adjustment: "/admin/inventory/counts",
    opening_balance: "/admin/inventory/ledger"
  };
  return paths[String(documentType || "").trim()] || "/admin/inventory/ledger";
}

export default {
  calculateInventoryLedgerSummary,
  getInventoryDocumentPath,
  getInventoryLedgerDocumentNo,
  getInventoryMovementLabel,
  isInventoryProductionDocument,
  sumInventoryMovementQuantities
};
