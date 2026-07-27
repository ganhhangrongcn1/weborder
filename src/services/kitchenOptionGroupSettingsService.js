import { adminConfigRepository } from "./repositories/adminConfigRepository.js";
import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";
import { loadOptionGroupPresetsAsync } from "./optionGroupService.js";

export const KITCHEN_OPTION_GROUP_SETTINGS_KEY = "ghr_kitchen_option_group_settings";

const DEFAULT_SETTINGS = {
  version: 3,
  partnerDefaultsApplied: false,
  groups: []
};

const LEGACY_KITCHEN_CHECKLIST_GROUP_NAMES = [
  "Ngon Hơn Khi Ăn Cùng",
  "Ưu Đãi Khi Mua Kèm",
  "Topping thêm",
  "Thêm kèm"
];

function toText(value = "") {
  return String(value ?? "").normalize("NFC").trim();
}

function normalizeKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSource(value = "") {
  const source = normalizeKey(value).replace(/\s+/g, "");
  if (source === "web" || source === "website" || source === "online") return "website";
  if (source === "pos" || source === "posmobile" || source === "counter") return "pos";
  if (source === "grab" || source === "grabfood") return "grabfood";
  if (source === "shopee" || source === "shopeefood") return "shopeefood";
  if (source === "xanhngon") return "xanhngon";
  return source || "other";
}

function isLegacyKitchenChecklistGroupName(value = "") {
  const key = normalizeKey(value);
  return LEGACY_KITCHEN_CHECKLIST_GROUP_NAMES.some((name) => normalizeKey(name) === key);
}

export function shouldAutoEnablePartnerKitchenOption(group = {}) {
  const source = normalizeSource(group.source);
  return (
    ["grabfood", "shopeefood"].includes(source) &&
    isLegacyKitchenChecklistGroupName(group.groupName)
  );
}

function isLikelyOptionGroupHeading(optionName = "", groupName = "") {
  const optionKey = normalizeKey(optionName);
  const groupKey = normalizeKey(groupName);
  if (!optionKey) return false;
  if (isLegacyKitchenChecklistGroupName(optionName)) return true;
  if (groupKey && optionKey === groupKey) return true;
  return /^(chọn|chon|lựa chọn|lua chon|tùy chọn|tuy chon)\b/i.test(toText(optionName));
}

function firstText(source = {}, keys = []) {
  for (const key of keys) {
    const value = toText(source?.[key]);
    if (value) return value;
  }
  return "";
}

function getGroupIdentity(group = {}) {
  const source = normalizeSource(group.source);
  const optionNameKey = normalizeKey(group.optionName);
  const groupId = toText(group.groupId);
  const groupNameKey = normalizeKey(group.groupName);
  if (optionNameKey) {
    const parentKey = groupId ? `id:${groupId}` : `name:${groupNameKey || "ungrouped"}`;
    return `${source}::${parentKey}::option:${optionNameKey}`;
  }
  return `${source}::${groupId ? `id:${groupId}` : `name:${groupNameKey}`}`;
}

function normalizeSettingGroup(group = {}, index = 0) {
  const source = normalizeSource(group.source);
  const groupId = toText(group.groupId || group.group_id);
  const groupName = toText(group.groupName || group.group_name || group.name);
  const optionName = toText(group.optionName);
  const identity = getGroupIdentity({ source, groupId, groupName, optionName });

  return {
    id: toText(group.id) || identity || `kitchen-group-${index + 1}`,
    source,
    groupId,
    groupName,
    optionName,
    matchMode: optionName ? "option" : groupId ? "id" : "name",
    enabled: group.enabled === undefined
      ? isLegacyKitchenChecklistGroupName(groupName)
      : Boolean(group.enabled),
    kitchenType: toText(group.kitchenType) || "other",
    kitchenLabel: toText(group.kitchenLabel) || groupName || "Tùy chọn",
    sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
    sampleOptions: Array.isArray(group.sampleOptions)
      ? [...new Set(group.sampleOptions.map(toText).filter(Boolean))].slice(0, 8)
      : []
  };
}

export function buildInternalKitchenOptionGroups(optionGroupPresets = []) {
  const result = [];
  ["website", "pos"].forEach((source) => {
    (Array.isArray(optionGroupPresets) ? optionGroupPresets : []).forEach((group, groupIndex) => {
      const presetId = toText(group?.id) || `preset-${groupIndex + 1}`;
      const groupName = toText(group?.name) || `Nhóm tùy chọn ${groupIndex + 1}`;
      (Array.isArray(group?.options) ? group.options : []).forEach((option, optionIndex) => {
        const optionName = toText(option?.name);
        if (!optionName) return;
        result.push(normalizeSettingGroup({
          source,
          groupId: `option-group-${presetId}`,
          groupName,
          optionName,
          enabled: isLegacyKitchenChecklistGroupName(groupName),
          kitchenLabel: groupName,
          sortOrder: groupIndex * 100 + optionIndex,
          sampleOptions: [optionName]
        }, result.length));
      });
    });
  });
  return result;
  /*
  return ["website", "pos"].flatMap((source) => (
    (Array.isArray(optionGroupPresets) ? optionGroupPresets : []).map((group, index) => {
      const presetId = toText(group?.id) || `preset-${index + 1}`;
      const groupName = toText(group?.name) || `Nhóm tùy chọn ${index + 1}`;
      return normalizeSettingGroup({
        source,
        groupId: `option-group-${presetId}`,
        groupName,
        enabled: isLegacyKitchenChecklistGroupName(groupName),
        kitchenLabel: groupName,
        sortOrder: index,
        sampleOptions: (Array.isArray(group?.options) ? group.options : [])
          .map((option) => option?.name)
      }, index);
    })
  ));
  */
}

export function mergeKitchenOptionGroupSettings(settingsValue, observedGroups = []) {
  const settings = normalizeKitchenOptionGroupSettings(settingsValue);
  const migratedSettings = settings.groups.flatMap((group) => {
    if (group.optionName) {
      return isLikelyOptionGroupHeading(group.optionName, group.groupName) ? [] : [group];
    }
    if (!group.sampleOptions.length) return [];
    return group.sampleOptions.map((optionName, index) => normalizeSettingGroup({
      ...group,
      id: `${group.id}-option-${normalizeKey(optionName)}`,
      optionName,
      sortOrder: group.sortOrder + index
    }, index));
  });
  const savedByIdentity = new Map(
    migratedSettings.map((group) => [getGroupIdentity(group), group])
  );
  const savedBySourceOption = new Map(
    migratedSettings
      .filter((group) => group.optionName)
      .map((group) => [
        `${normalizeSource(group.source)}::${normalizeKey(group.optionName)}`,
        group
      ])
  );
  const observedIdentities = new Set();
  const matchedSavedIds = new Set();
  const mergedObserved = (Array.isArray(observedGroups) ? observedGroups : []).map((group, index) => {
    const normalized = normalizeSettingGroup(group, index);
    const identity = getGroupIdentity(normalized);
    const saved = savedByIdentity.get(identity) || savedBySourceOption.get(
      `${normalizeSource(normalized.source)}::${normalizeKey(normalized.optionName)}`
    );
    if (saved?.id) matchedSavedIds.add(saved.id);
    observedIdentities.add(identity);
    return {
      ...normalized,
      ...(saved || {}),
      groupId: normalized.groupId || saved?.groupId || "",
      groupName: normalized.groupName || saved?.groupName || "",
      sampleOptions: normalized.sampleOptions.length
        ? normalized.sampleOptions
        : saved?.sampleOptions || []
    };
  });

  return normalizeKitchenOptionGroupSettings({
    version: 3,
    partnerDefaultsApplied: settings.partnerDefaultsApplied,
    groups: [
      ...mergedObserved,
      ...migratedSettings.filter((group) => (
        !matchedSavedIds.has(group.id) &&
        !observedIdentities.has(getGroupIdentity(group))
      ))
    ]
  });
}

export function normalizeKitchenOptionGroupSettings(value = DEFAULT_SETTINGS) {
  const groups = Array.isArray(value) ? value : Array.isArray(value?.groups) ? value.groups : [];
  const sourceVersion = Array.isArray(value) ? 1 : Number(value?.version || 1);
  const seen = new Set();

  return {
    version: 3,
    partnerDefaultsApplied: Boolean(value?.partnerDefaultsApplied),
    groups: groups
      .map((group, index) => normalizeSettingGroup({
        ...group,
        enabled: sourceVersion < 2 && isLegacyKitchenChecklistGroupName(
          group?.groupName || group?.group_name || group?.name
        )
          ? true
          : group?.enabled
      }, index))
      .filter((group) => group.optionName || group.groupId || group.groupName)
      .filter((group) => {
        const identity = getGroupIdentity(group);
        if (!identity || seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
  };
}

export async function loadKitchenOptionGroupSettings() {
  const [value, optionGroupPresets] = await Promise.all([
    adminConfigRepository.getAsync(
      KITCHEN_OPTION_GROUP_SETTINGS_KEY,
      DEFAULT_SETTINGS
    ),
    loadOptionGroupPresetsAsync()
  ]);
  return mergeKitchenOptionGroupSettings(
    value,
    buildInternalKitchenOptionGroups(optionGroupPresets)
  );
}

export async function saveKitchenOptionGroupSettings(value) {
  const normalized = normalizeKitchenOptionGroupSettings(value);
  await adminConfigRepository.setAsync(KITCHEN_OPTION_GROUP_SETTINGS_KEY, normalized);
  return normalized;
}

function pushSample(result, value = "") {
  const text = toText(value);
  if (text && !result.includes(text)) result.push(text);
}

function getNestedOptionArrays(value = {}) {
  return [
    value.options,
    value.items,
    value.values,
    value.selectedOptions,
    value.selected_options,
    value.toppings
  ].filter(Array.isArray);
}

function parseFlatOptionLabel(value = "") {
  const label = toText(value);
  const separatorIndex = label.indexOf(":");
  if (separatorIndex <= 0) return null;

  const groupName = toText(label.slice(0, separatorIndex));
  const optionName = toText(label.slice(separatorIndex + 1));
  if (!groupName || !optionName) return null;
  return { groupName, optionName };
}

function collectObservedGroups(value, source, result, inheritedGroup = null) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObservedGroups(item, source, result, inheritedGroup));
    return;
  }
  if (typeof value !== "object") {
    if (inheritedGroup) pushSample(inheritedGroup.sampleOptions, value);
    return;
  }

  const explicitGroupId = firstText(value, [
    "groupId",
    "group_id",
    "optionGroupId",
    "option_group_id",
    "modifierGroupId",
    "modifier_group_id"
  ]);
  const explicitGroupName = firstText(value, [
    "groupName",
    "group_name",
    "option_name",
    "optionGroupName",
    "option_group_name",
    "modifierGroupName",
    "modifier_group_name"
  ]);
  const nestedArrays = getNestedOptionArrays(value);
  const containerGroupId = nestedArrays.length
    ? firstText(value, ["id", "code", "externalId", "external_id"])
    : "";
  const containerGroupName = nestedArrays.length
    ? firstText(value, ["name", "title", "label"])
    : "";
  const optionLabel = firstText(value, [
    "option_item",
    "optionName",
    "value",
    "name",
    "label",
    "title"
  ]);
  const flatOption = !explicitGroupId && !explicitGroupName && !nestedArrays.length
    ? parseFlatOptionLabel(optionLabel)
    : null;
  const groupId = explicitGroupId || containerGroupId;
  const groupName = explicitGroupName || containerGroupName || flatOption?.groupName || "";
  let currentGroup = inheritedGroup;

  if (groupId || groupName) {
    const identity = getGroupIdentity({ source, groupId, groupName });
    currentGroup = result.get(identity);
    if (!currentGroup) {
      currentGroup = {
        source: normalizeSource(source),
        groupId,
        groupName,
        sampleOptions: []
      };
      result.set(identity, currentGroup);
    } else {
      if (!currentGroup.groupId && groupId) currentGroup.groupId = groupId;
      if (!currentGroup.groupName && groupName) currentGroup.groupName = groupName;
    }
  }

  const sampleLabel = flatOption?.optionName || optionLabel;
  if (currentGroup && sampleLabel && sampleLabel !== currentGroup.groupName) {
    pushSample(currentGroup.sampleOptions, sampleLabel);
  }

  nestedArrays.forEach((items) => {
    items.forEach((item) => collectObservedGroups(item, source, result, currentGroup));
  });
}

export function extractObservedPartnerOptionGroups(options, source = "other") {
  const result = new Map();
  collectObservedGroups(options, source, result);
  return [...result.values()].filter((group) => group.groupId || group.groupName);
}

function collectObservedOptions(value, source, result, groupName = "", groupId = "") {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObservedOptions(item, source, result, groupName, groupId));
    return;
  }
  if (typeof value !== "object") {
    const flat = parseFlatOptionLabel(value);
    const optionName = flat?.optionName || toText(value);
    const resolvedGroupName = flat?.groupName || groupName;
    if (!optionName) return;
    if (isLikelyOptionGroupHeading(optionName, resolvedGroupName) && !flat) return;
    const option = normalizeSettingGroup({
      source,
      groupId,
      groupName: resolvedGroupName,
      optionName,
      enabled: isLegacyKitchenChecklistGroupName(resolvedGroupName),
      kitchenLabel: resolvedGroupName || "Lựa chọn combo",
      sampleOptions: [optionName]
    });
    result.set(getGroupIdentity(option), option);
    return;
  }

  const nestedArrays = getNestedOptionArrays(value);
  const nextGroupId = firstText(value, [
    "groupId", "group_id", "optionGroupId", "option_group_id",
    "modifierGroupId", "modifier_group_id"
  ]) || (nestedArrays.length
    ? firstText(value, ["id", "code", "externalId", "external_id"])
    : groupId);
  const nextGroupName = firstText(value, [
    "groupName", "group_name", "option_name", "optionGroupName", "option_group_name",
    "modifierGroupName", "modifier_group_name"
  ]) || (nestedArrays.length
    ? firstText(value, ["name", "title", "label"])
    : groupName);

  if (nestedArrays.length) {
    nestedArrays.forEach((items) => items.forEach((item) => (
      collectObservedOptions(item, source, result, nextGroupName, nextGroupId)
    )));
    return;
  }

  const label = firstText(value, [
    "option_item", "optionName", "value", "name", "label", "title"
  ]);
  if (label) collectObservedOptions(label, source, result, nextGroupName, nextGroupId);
}

export function extractObservedKitchenOptions(options, source = "other") {
  const result = new Map();
  collectObservedOptions(options, source, result);
  return [...result.values()];
}

export async function discoverPartnerOptionGroups({ limit = 500 } = {}) {
  const client = await getAdminSupabaseClient();
  if (!client) throw new Error("Không tìm thấy kết nối Supabase dành cho Admin.");

  const rowLimit = Math.max(1, Number(limit) || 500);
  const { data: orderRows, error: orderError } = await client
    .from("partner_orders")
    .select("id,partner_source,order_time,created_at,raw_data")
    .order("order_time", { ascending: false })
    .limit(rowLimit);
  if (orderError) throw orderError;

  const orderIds = (Array.isArray(orderRows) ? orderRows : [])
    .map((row) => toText(row.id))
    .filter(Boolean);
  const chunks = [];
  for (let index = 0; index < orderIds.length; index += 100) {
    chunks.push(orderIds.slice(index, index + 100));
  }
  const itemResults = await Promise.all(
    chunks.map((ids) => client
      .from("partner_order_items")
      .select("partner_order_id,options")
      .in("partner_order_id", ids)
      .not("options", "is", null))
  );
  const itemError = itemResults.find((result) => result.error)?.error;
  if (itemError) throw itemError;
  const itemRows = itemResults.flatMap((result) => (
    Array.isArray(result.data) ? result.data : []
  ));

  const sourceByOrderId = new Map(
    (Array.isArray(orderRows) ? orderRows : []).map((row) => [
      toText(row.id),
      normalizeSource(row.partner_source)
    ])
  );
  const observed = new Map();
  let optionsItemCount = 0;
  let rawDishCount = 0;

  function mergeObservedGroups(groups = []) {
    groups.forEach((group) => {
      const identity = getGroupIdentity(group);
      const current = observed.get(identity);
      if (!current) {
        observed.set(identity, group);
        return;
      }
      group.sampleOptions.forEach((option) => pushSample(current.sampleOptions, option));
    });
  }

  (Array.isArray(itemRows) ? itemRows : []).forEach((row) => {
    const source = sourceByOrderId.get(toText(row.partner_order_id)) || "other";
    const groups = extractObservedKitchenOptions(row.options, source);
    if (groups.length) optionsItemCount += 1;
    mergeObservedGroups(groups);
  });

  (Array.isArray(orderRows) ? orderRows : []).forEach((row) => {
    const source = normalizeSource(row.partner_source);
    const rawData = row?.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};
    const dishes = Array.isArray(rawData.dishes)
      ? rawData.dishes
      : Array.isArray(rawData.items)
        ? rawData.items
        : [];
    dishes.forEach((dish) => {
      const groups = extractObservedKitchenOptions(
        dish?.options || dish?.toppings || dish?.selectedOptions,
        source
      );
      if (groups.length) rawDishCount += 1;
      mergeObservedGroups(groups);
    });
  });

  const groups = [...observed.values()]
    .map(normalizeSettingGroup)
    .sort((first, second) => (
      first.source.localeCompare(second.source, "vi") ||
      first.groupName.localeCompare(second.groupName, "vi")
    ));
  const orderTimes = (Array.isArray(orderRows) ? orderRows : [])
    .map((row) => new Date(row.order_time || row.created_at || "").getTime())
    .filter(Number.isFinite);

  return {
    groups,
    audit: {
      orderCount: Array.isArray(orderRows) ? orderRows.length : 0,
      itemCount: itemRows.length,
      optionsItemCount,
      rawDishCount,
      dateFrom: orderTimes.length ? new Date(Math.min(...orderTimes)).toISOString() : "",
      dateTo: orderTimes.length ? new Date(Math.max(...orderTimes)).toISOString() : ""
    }
  };
}

function settingMatchesObservedGroup(setting = {}, observed = {}) {
  if (!setting.enabled) return false;
  if (normalizeSource(setting.source) !== normalizeSource(observed.source)) return false;

  const settingId = toText(setting.groupId);
  const observedId = toText(observed.groupId);
  if (settingId && observedId) return settingId === observedId;

  return Boolean(
    normalizeKey(setting.groupName) &&
    normalizeKey(setting.groupName) === normalizeKey(observed.groupName)
  );
}

function settingMatchesOption(setting = {}, observed = {}) {
  if (!setting.enabled) return false;
  if (normalizeSource(setting.source) !== normalizeSource(observed.source)) return false;
  if (!normalizeKey(setting.optionName)) return false;
  if (normalizeKey(setting.optionName) !== normalizeKey(observed.optionName)) return false;

  const settingGroupId = toText(setting.groupId);
  const observedGroupId = toText(observed.groupId);
  if (settingGroupId && observedGroupId) return settingGroupId === observedGroupId;

  const settingGroupName = normalizeKey(setting.groupName);
  const observedGroupName = normalizeKey(observed.groupName);
  return !settingGroupName || !observedGroupName || settingGroupName === observedGroupName;
}

function collectSelectedGroups(value, source, result, inheritedGroup = null) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSelectedGroups(item, source, result, inheritedGroup));
    return;
  }
  if (typeof value !== "object") {
    if (inheritedGroup) pushSample(inheritedGroup.values, value);
    return;
  }

  const nestedArrays = getNestedOptionArrays(value);
  const groupId = firstText(value, [
    "groupId",
    "group_id",
    "optionGroupId",
    "option_group_id",
    "modifierGroupId",
    "modifier_group_id"
  ]) || (nestedArrays.length ? firstText(value, ["id", "code", "externalId", "external_id"]) : "");
  const groupName = firstText(value, [
    "groupName",
    "group_name",
    "option_name",
    "optionGroupName",
    "option_group_name",
    "modifierGroupName",
    "modifier_group_name"
  ]) || (nestedArrays.length ? firstText(value, ["name", "title", "label"]) : "");
  let currentGroup = inheritedGroup;

  if (groupId || groupName) {
    const identity = getGroupIdentity({ source, groupId, groupName });
    currentGroup = result.get(identity) || {
      source: normalizeSource(source),
      groupId,
      groupName,
      values: []
    };
    result.set(identity, currentGroup);
  }

  const valueLabel = firstText(value, [
    "option_item",
    "optionName",
    "value",
    "name",
    "label",
    "title"
  ]);
  if (currentGroup && valueLabel && valueLabel !== currentGroup.groupName) {
    pushSample(currentGroup.values, valueLabel);
  }

  nestedArrays.forEach((items) => {
    items.forEach((item) => collectSelectedGroups(item, source, result, currentGroup));
  });
}

export function buildKitchenChecklistOptions(options, source, settingsValue) {
  const settings = normalizeKitchenOptionGroupSettings(settingsValue);
  const optionSettings = settings.groups.filter((setting) => (
    setting.optionName &&
    normalizeSource(setting.source) === normalizeSource(source)
  ));
  if (optionSettings.length) {
    const seen = new Set();
    return extractObservedKitchenOptions(options, source)
      .flatMap((observed, index) => {
        const setting = optionSettings.find((candidate) => settingMatchesOption(candidate, observed));
        if (!setting) return [];
        const group = setting.kitchenLabel || observed.groupName || "Lựa chọn combo";
        const label = `${group}: ${observed.optionName}`;
        const key = normalizeKey(label);
        if (!key || seen.has(key)) return [];
        seen.add(key);
        return [{
          id: `${setting.id}-option-${index}`,
          group,
          value: observed.optionName,
          label,
          kitchenType: setting.kitchenType,
          sortOrder: setting.sortOrder
        }];
      })
      .sort((first, second) => first.sortOrder - second.sortOrder);
  }

  const selectedGroups = new Map();
  collectSelectedGroups(options, source, selectedGroups);

  const result = [...selectedGroups.values()].flatMap((group) => {
    const setting = settings.groups.find((candidate) => settingMatchesObservedGroup(candidate, group));
    if (!setting) return [];

    return group.values.map((value, index) => ({
      id: `${setting.id}-${index}`,
      group: setting.kitchenLabel || setting.groupName,
      value,
      label: `${setting.kitchenLabel || setting.groupName}: ${value}`,
      kitchenType: setting.kitchenType,
      sortOrder: setting.sortOrder
    }));
  });
  const seen = new Set(result.map((option) => normalizeKey(option.label)));

  function walkFlatLabels(value) {
    if (!value) return;
    if (typeof value === "string") {
      const label = toText(value);
      const separatorIndex = label.indexOf(":");
      if (separatorIndex <= 0) return;
      const groupName = toText(label.slice(0, separatorIndex));
      const optionValue = toText(label.slice(separatorIndex + 1));
      if (!groupName || !optionValue) return;

      const setting = settings.groups.find((candidate) => settingMatchesObservedGroup(candidate, {
        source,
        groupId: "",
        groupName
      }));
      if (!setting) return;

      const checklistLabel = `${setting.kitchenLabel || setting.groupName}: ${optionValue}`;
      const key = normalizeKey(checklistLabel);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({
        id: `${setting.id}-flat-${result.length}`,
        group: setting.kitchenLabel || setting.groupName,
        value: optionValue,
        label: checklistLabel,
        kitchenType: setting.kitchenType,
        sortOrder: setting.sortOrder
      });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walkFlatLabels);
      return;
    }
    if (typeof value === "object") {
      const label = firstText(value, [
        "optionName",
        "option_name",
        "option_item",
        "value",
        "name",
        "label",
        "title"
      ]);
      if (label) walkFlatLabels(label);
      getNestedOptionArrays(value).forEach((items) => items.forEach(walkFlatLabels));
    }
  }

  walkFlatLabels(options);
  return result.sort((first, second) => first.sortOrder - second.sortOrder);
}
