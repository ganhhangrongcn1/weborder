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

export function getReceiptLineItemDefaults(item = {}, occurredAt = "") {
  if (!item.id) {
    return { lotNumber: "", manufacturedOn: "", expiresOn: "", trackExpiry: false, expiryManuallyEdited: false };
  }
  return {
    lotNumber: createReceiptLotNumber(item, occurredAt),
    manufacturedOn: "",
    expiresOn: getSuggestedExpiryDate(item, occurredAt),
    trackExpiry: item.trackExpiry === true,
    expiryManuallyEdited: false
  };
}

export default {
  createReceiptLotNumber,
  getSuggestedExpiryDate,
  getReceiptLineItemDefaults
};
