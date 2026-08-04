export function getWarehouseMinimumStock(balance, itemWarehouseNorms = []) {
  const warehouseNorm = itemWarehouseNorms.find((entry) =>
    entry.item_id === balance.item_id && entry.warehouse_id === balance.warehouse_id
  );
  return Number(warehouseNorm?.minimum_stock ?? balance.inventory_items?.minimum_stock ?? 0);
}

export function getInventoryStatus(balance, itemWarehouseNorms = []) {
  const quantity = Number(balance.quantity || 0);
  const minimum = getWarehouseMinimumStock(balance, itemWarehouseNorms);
  if (minimum <= 0) return { key: "unset", label: "Chưa thiết lập", minimum };
  if (quantity <= 0) return { key: "danger", label: "Hết hàng", minimum };
  if (quantity <= minimum) return { key: "warning", label: "Dưới định mức", minimum };
  return { key: "good", label: "Đạt định mức", minimum };
}
