function toText(value = "") {
  return String(value || "").trim();
}

export function normalizePagerNumber(value = "") {
  return toText(value).replace(/[^\d]/g, "");
}

export function buildPosOrderCode(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  const datePart = [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0")
  ].join("");
  const timePart = [
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
    String(value.getSeconds()).padStart(2, "0")
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `POS-${datePart}-${timePart}-${randomPart}`;
}

export function buildShortDisplayOrderCode(orderCode = "") {
  const normalized = toText(orderCode).replace(/[^A-Z0-9]/gi, "");
  return normalized.slice(-6) || "POS";
}

export function createPosOrderIdentity(now = new Date()) {
  const orderCode = buildPosOrderCode(now);
  return {
    orderCode,
    displayOrderCode: buildShortDisplayOrderCode(orderCode)
  };
}
