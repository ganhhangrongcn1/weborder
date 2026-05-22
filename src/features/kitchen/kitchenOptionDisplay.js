export const OPTION_GROUP_PREFIXES = [
  "Ngon Hơn Khi Ăn Cùng",
  "Chọn Cách Chế Biến",
  "Mức Độ Cay",
  "Loại Sốt",
  "Size"
];

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

export function parseKitchenOptionLabel(value = "") {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return { group: "", value: "" };

  const normalized = normalizeText(text);
  const matchedPrefix = OPTION_GROUP_PREFIXES.find((prefix) => {
    const normalizedPrefix = normalizeText(prefix);
    return (
      normalized === normalizedPrefix ||
      normalized.startsWith(`${normalizedPrefix} `) ||
      normalized.startsWith(`${normalizedPrefix}:`) ||
      normalized.startsWith(`${normalizedPrefix} -`)
    );
  });

  if (!matchedPrefix) return { group: "", value: text };

  const valueText = text
    .slice(matchedPrefix.length)
    .replace(/^[:\-–—]\s*/, "")
    .trim();

  return {
    group: matchedPrefix,
    value: valueText
  };
}

export function getKitchenRecipeOptions(options = []) {
  const sourceOptions = Array.isArray(options)
    ? options.map((option) => String(option || "").trim()).filter(Boolean)
    : [];
  const result = [];

  for (let index = 0; index < sourceOptions.length; index += 1) {
    const option = sourceOptions[index];
    const parsed = parseKitchenOptionLabel(option);

    if (!parsed.group) {
      result.push({
        group: "",
        value: option,
        label: option
      });
      continue;
    }

    if (parsed.value) {
      result.push({
        group: parsed.group,
        value: parsed.value,
        label: `${parsed.group}: ${parsed.value}`
      });
      continue;
    }

    const nextOption = sourceOptions[index + 1] || "";
    const nextParsed = parseKitchenOptionLabel(nextOption);
    if (nextOption && !nextParsed.group) {
      result.push({
        group: parsed.group,
        value: nextOption,
        label: `${parsed.group}: ${nextOption}`
      });
      index += 1;
      continue;
    }

    result.push({
      group: parsed.group,
      value: "",
      label: parsed.group
    });
  }

  return result;
}
