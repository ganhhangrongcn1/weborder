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

export function getInventoryDocumentPath(documentType = "") {
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
  sumInventoryMovementQuantities
};
