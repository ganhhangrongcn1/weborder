function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toDate(value = "") {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toDateOnly(value = "") {
  const date = toDate(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function createReceiptLotNumber(item = {}, occurredAt = "") {
  const date = toDate(occurredAt);
  const datePart = toDateOnly(date).replaceAll("-", "");
  const timePart = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  const itemPart = toText(item.code || "NVL")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "NVL";
  return `LO-${datePart}-${timePart}-${itemPart}`;
}

export function getSuggestedExpiryDate(item = {}, occurredAt = "") {
  const shelfLifeDays = Math.max(0, Math.trunc(Number(item.shelfLifeDays || 0)));
  if (!item.trackExpiry || shelfLifeDays <= 0) return "";
  const date = toDate(occurredAt);
  date.setDate(date.getDate() + shelfLifeDays);
  return toDateOnly(date);
}

export function getReceiptUnitPrice(item = {}, unitId = "") {
  if (item.itemType !== "ingredient") return 0;
  const purchasePrice = Math.max(0, Number(item.defaultPurchasePrice || 0));
  if (!purchasePrice) return 0;
  const selectedUnitId = toText(unitId) || toText(item.purchaseUnitId) || toText(item.baseUnitId);
  const usesBaseUnit = selectedUnitId === toText(item.baseUnitId)
    && selectedUnitId !== toText(item.purchaseUnitId);
  if (!usesBaseUnit) return purchasePrice;
  const ratio = Math.max(0, Number(item.purchaseToBaseRatio || 1)) || 1;
  return purchasePrice / ratio;
}

export function getReceiptLineItemDefaults(item = {}, occurredAt = "") {
  if (!item.id) {
    return { lotNumber: "", manufacturedOn: "", expiresOn: "", unitPrice: 0, trackExpiry: false, expiryManuallyEdited: false };
  }
  return {
    lotNumber: createReceiptLotNumber(item, occurredAt),
    manufacturedOn: "",
    expiresOn: getSuggestedExpiryDate(item, occurredAt),
    unitPrice: getReceiptUnitPrice(item, item.purchaseUnitId),
    trackExpiry: item.trackExpiry === true,
    expiryManuallyEdited: false
  };
}

export default {
  createReceiptLotNumber,
  getSuggestedExpiryDate,
  getReceiptUnitPrice,
  getReceiptLineItemDefaults
};
