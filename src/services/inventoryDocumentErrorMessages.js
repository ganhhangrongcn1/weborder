function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function formatQuantity(value = 0) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(Number(value || 0));
}

const STOCK_SHORTAGE_PATTERN = /Tồn kho không đủ cho mặt hàng\s+([0-9a-f-]{36})\.\s*Hiện có\s+([+-]?\d+(?:[.,]\d+)?),\s*cần xuất\s+([+-]?\d+(?:[.,]\d+)?)(?:\s*\(đơn vị lưu kho\))?\./i;

export function parseInventoryStockShortageMessage(message = "") {
  const match = toText(message).match(STOCK_SHORTAGE_PATTERN);
  if (!match) return null;
  return {
    itemId: toText(match[1]),
    availableBaseQuantity: toNumber(match[2]),
    requiredBaseQuantity: toNumber(match[3])
  };
}

export function formatInventoryStockShortageMessage(message = "", context = {}) {
  const rawMessage = toText(message);
  const shortage = parseInventoryStockShortageMessage(rawMessage);
  if (!shortage) return rawMessage;

  const conversionToBase = Math.max(1, Number(context.conversionToBase || 1));
  const itemName = toText(context.itemName) || "nguyên vật liệu đã chọn";
  const unitName = toText(context.unitName || context.unitSymbol) || "đơn vị lưu kho";
  const availableQuantity = shortage.availableBaseQuantity / conversionToBase;
  const requiredQuantity = shortage.requiredBaseQuantity / conversionToBase;

  return `Tồn kho không đủ cho ${itemName}. Hiện có ${formatQuantity(availableQuantity)} ${unitName}, cần xuất ${formatQuantity(requiredQuantity)} ${unitName}.`;
}

export default {
  formatInventoryStockShortageMessage,
  parseInventoryStockShortageMessage
};
