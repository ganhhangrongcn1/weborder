function normalizeOptionText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sanitizeOrderSpice(product = {}, spice = "") {
  const rawSpice = String(spice || "").normalize("NFC").trim();
  if (!rawSpice) return "";

  const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
  const singleGroups = groups.filter((group) => (
    group?.type === "single" && Array.isArray(group?.options) && group.options.length > 0
  ));
  const normalizedSpice = normalizeOptionText(rawSpice);

  for (const group of singleGroups) {
    const groupName = String(group?.name || "").normalize("NFC").trim();
    for (const option of group.options) {
      const optionName = String(option?.name || "").normalize("NFC").trim();
      if (!optionName) continue;
      const fullLabel = groupName ? `${groupName}: ${optionName}` : optionName;
      if (
        normalizedSpice === normalizeOptionText(fullLabel) ||
        normalizedSpice === normalizeOptionText(optionName)
      ) {
        return fullLabel;
      }
    }
  }

  return "";
}
