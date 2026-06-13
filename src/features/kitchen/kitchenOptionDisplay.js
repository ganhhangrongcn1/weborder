export const PAID_TOPPING_GROUP_PREFIXES = [
  "Ngon Hơn Khi Ăn Cùng",
  "Topping thêm",
  "Thêm kèm"
];

export const RECIPE_OPTION_GROUP_PREFIXES = [
  "Chọn Loại Sốt",
  "Loại Sốt",
  "Mức Độ Cay",
  "Chọn Cách Chế Biến",
  "Size"
];

export const OPTION_GROUP_PREFIXES = [
  ...PAID_TOPPING_GROUP_PREFIXES,
  ...RECIPE_OPTION_GROUP_PREFIXES
];

export function normalizeKitchenOptionText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function normalizeGroupKey(value = "") {
  return normalizeKitchenOptionText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

const PAID_TOPPING_GROUP_KEYS = new Set(PAID_TOPPING_GROUP_PREFIXES.map(normalizeGroupKey));
const RECIPE_OPTION_GROUP_KEYS = new Set(RECIPE_OPTION_GROUP_PREFIXES.map(normalizeGroupKey));

export function isKitchenPaidToppingGroup(value = "") {
  return PAID_TOPPING_GROUP_KEYS.has(normalizeGroupKey(value));
}

export function isKitchenRecipeOnlyGroup(value = "") {
  return RECIPE_OPTION_GROUP_KEYS.has(normalizeGroupKey(value));
}

export function parseKitchenOptionLabel(value = "") {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return { group: "", value: "" };

  const normalized = normalizeKitchenOptionText(text);
  const matchedPrefix = OPTION_GROUP_PREFIXES.find((prefix) => {
    const normalizedPrefix = normalizeKitchenOptionText(prefix);
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

export function isKitchenRecipeOnlyOption(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;

  const parsed = parseKitchenOptionLabel(text);
  if (parsed.group && isKitchenRecipeOnlyGroup(parsed.group)) return true;

  const normalized = normalizeGroupKey(text);
  return (
    normalized.includes("chon loai sot") ||
    normalized.includes("loai sot") ||
    normalized.includes("muc do cay") ||
    normalized.includes("chon cach che bien") ||
    normalized === "size" ||
    normalized.startsWith("size ")
  );
}

export function isKitchenPaidToppingOption(option = {}) {
  return (
    isKitchenPaidToppingGroup(option.group) &&
    Boolean(String(option.value || "").trim()) &&
    !isKitchenRecipeOnlyOption(option.group) &&
    !isKitchenRecipeOnlyOption(option.value) &&
    !isKitchenRecipeOnlyOption(option.label)
  );
}

export function getKitchenRecipeOptions(options = []) {
  const sourceOptions = Array.isArray(options)
    ? options.map((option) => String(option || "").trim()).filter(Boolean)
    : [];
  const rawResult = [];

  for (let index = 0; index < sourceOptions.length; index += 1) {
    const option = sourceOptions[index];
    const parsed = parseKitchenOptionLabel(option);

    if (!parsed.group) {
      rawResult.push({
        group: "",
        value: option,
        label: option
      });
      continue;
    }

    if (parsed.value) {
      rawResult.push({
        group: parsed.group,
        value: parsed.value,
        label: `${parsed.group}: ${parsed.value}`
      });
      continue;
    }

    const nextOption = sourceOptions[index + 1] || "";
    const nextParsed = parseKitchenOptionLabel(nextOption);
    if (nextOption && !nextParsed.group && !isKitchenRecipeOnlyOption(nextOption)) {
      rawResult.push({
        group: parsed.group,
        value: nextOption,
        label: `${parsed.group}: ${nextOption}`
      });
      index += 1;
      continue;
    }

    rawResult.push({
      group: parsed.group,
      value: "",
      label: parsed.group
    });
  }

  const groupsWithValue = new Set(
    rawResult
      .filter((option) => option.group && option.value)
      .map((option) => normalizeGroupKey(option.group))
  );

  const seen = new Set();
  return rawResult.filter((option) => {
    const groupKey = normalizeGroupKey(option.group);
    const valueKey = normalizeGroupKey(option.value);

    if (groupKey && !valueKey && groupsWithValue.has(groupKey)) {
      return false;
    }

    const dedupeKey = `${groupKey}__${valueKey || normalizeGroupKey(option.label)}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}
