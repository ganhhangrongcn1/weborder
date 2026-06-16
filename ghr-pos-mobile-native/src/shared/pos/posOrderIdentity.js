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
  return `POS-${datePart}-${timePart}`;
}

export function buildShortDisplayOrderCode(orderCode = "") {
  const raw = toText(orderCode);
  const digitOnly = raw.replace(/\D/g, "");
  const shortCode = digitOnly.length >= 4
    ? digitOnly.slice(-4)
    : (raw.length >= 4 ? raw.slice(-4) : raw);
  return shortCode ? `GHR-${shortCode}` : raw;
}

export function createPosOrderIdentity(now = new Date()) {
  const orderCode = buildPosOrderCode(now);
  return {
    orderCode,
    displayOrderCode: buildShortDisplayOrderCode(orderCode)
  };
}
