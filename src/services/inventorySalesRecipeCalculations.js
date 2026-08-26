import {
  getInventoryCompatibleUnits,
  getInventoryUnitToBaseFactor
} from "./inventoryUnitConversion.js";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toPositiveNumber(value, message) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(message);
  return parsed;
}

function toWastePercent(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Hao hụt phải nằm trong khoảng từ 0% đến 100%.");
  }
  return parsed;
}

export function calculateSalesRecipeComponent({
  quantity = 0,
  conversionToBase = 1,
  wastePercent = 0,
  averageCost = 0
} = {}) {
  const netBaseQuantity = Number(quantity || 0) * Number(conversionToBase || 1);
  const requiredBaseQuantity = netBaseQuantity * (1 + Number(wastePercent || 0) / 100);
  return {
    netBaseQuantity,
    requiredBaseQuantity,
    estimatedCost: requiredBaseQuantity * Number(averageCost || 0)
  };
}

export function normalizeInventorySalesRecipeInput(input = {}, {
  menuEntities = [],
  items = [],
  units = []
} = {}) {
  const menuEntityType = ["product", "topping"].includes(input.menuEntityType)
    ? input.menuEntityType
    : "product";
  const menuEntityId = toText(input.menuEntityId);
  const menuEntity = menuEntities.find((entity) => entity.id === menuEntityId && entity.type === menuEntityType);
  if (!menuEntity) throw new Error("Vui lòng chọn món hoặc topping trong Menu.");

  const yieldQuantity = toPositiveNumber(input.yieldQuantity || 1, "Số phần chuẩn phải lớn hơn 0.");
  const usedItems = new Set();
  const components = (Array.isArray(input.components) ? input.components : []).map((component, index) => {
    const itemId = toText(component.itemId);
    const item = items.find((row) => row.id === itemId && row.isActive !== false);
    if (!item) throw new Error(`Thành phần dòng ${index + 1} không còn sử dụng.`);
    if (usedItems.has(itemId)) throw new Error("Mỗi nguyên vật liệu chỉ được xuất hiện một lần.");
    usedItems.add(itemId);

    const quantity = toPositiveNumber(component.quantity, `Số lượng dòng ${index + 1} phải lớn hơn 0.`);
    const wastePercent = toWastePercent(component.wastePercent);
    const unitId = toText(component.unitId);
    const unit = getInventoryCompatibleUnits(item, units).find((row) => row.id === unitId);
    if (!unit) throw new Error(`Đơn vị dòng ${index + 1} không cùng hệ với đơn vị tồn.`);

    return {
      itemId,
      quantity,
      unitId,
      wastePercent,
      displayOrder: index,
      notes: toText(component.notes),
      conversionToBase: getInventoryUnitToBaseFactor(item, unit)
    };
  });
  if (!components.length) throw new Error("Định lượng món bán phải có ít nhất một thành phần.");

  return {
    id: toText(input.id),
    menuEntityType,
    menuEntityId,
    menuEntityName: toText(menuEntity.name),
    branchUuid: toText(input.branchUuid),
    yieldQuantity,
    effectiveFrom: toText(input.effectiveFrom) || new Date().toISOString().slice(0, 10),
    notes: toText(input.notes),
    components
  };
}

export function normalizeInventoryChannelMappingInput(input = {}, { menuEntities = [] } = {}) {
  const partnerSource = ["grabfood", "shopeefood", "xanhngon", "other"].includes(input.partnerSource)
    ? input.partnerSource
    : "other";
  const mappingKind = input.mappingKind === "option" ? "option" : "item";
  const branchUuid = toText(input.branchUuid);
  const externalItemName = toText(input.externalItemName);
  const externalOptionGroup = mappingKind === "option" ? toText(input.externalOptionGroup) : "";
  const externalOptionName = mappingKind === "option" ? toText(input.externalOptionName) : "";
  const ignoreInventory = input.ignoreInventory === true;
  if (!branchUuid) throw new Error("Vui lòng chọn chi nhánh của món app.");
  if (!externalItemName) throw new Error("Vui lòng nhập tên món trên app.");
  if (mappingKind === "option" && (!externalOptionGroup || !externalOptionName)) {
    throw new Error("Vui lòng nhập đủ nhóm và lựa chọn của combo.");
  }

  const usedTargets = new Set();
  const targets = ignoreInventory ? [] : (Array.isArray(input.targets) ? input.targets : []).map((target, index) => {
    const menuEntityType = target.menuEntityType === "topping" ? "topping" : "product";
    const menuEntityId = toText(target.menuEntityId);
    const entity = menuEntities.find((row) => row.id === menuEntityId && row.type === menuEntityType);
    if (!entity) throw new Error(`Món Menu dòng ${index + 1} không còn sử dụng.`);
    const key = `${menuEntityType}:${menuEntityId}`;
    if (usedTargets.has(key)) throw new Error("Mỗi món Menu chỉ được gán một lần.");
    usedTargets.add(key);
    return {
      menuEntityType,
      menuEntityId,
      menuEntityName: toText(entity.name),
      quantity: toPositiveNumber(target.quantity || 1, `Số lượng dòng ${index + 1} phải lớn hơn 0.`),
      displayOrder: index
    };
  });
  if (!ignoreInventory && !targets.length) {
    throw new Error("Vui lòng gán ít nhất một món Menu hoặc chọn Không trừ kho.");
  }

  return {
    id: toText(input.id),
    partnerSource,
    branchUuid,
    mappingKind,
    externalItemId: toText(input.externalItemId),
    externalItemName,
    externalOptionGroup,
    externalOptionName,
    ignoreInventory,
    notes: toText(input.notes),
    targets
  };
}

export function getChannelCandidateIdentity(row = {}) {
  const isOption = row.candidateKind === "option" || row.mappingKind === "option";
  const partnerSource = toText(row.partnerSource).toLowerCase();
  const canonicalItemName = toText(row.externalItemName)
    .replace(/\s*\((?:tự trộn|trộn đều topping|trộn đều|trộn sẵn|để riêng tự trộn)\)\s*$/iu, "")
    .toLocaleLowerCase("vi");
  return [
    partnerSource,
    partnerSource === "shopeefood" ? "*" : toText(row.branchUuid).toLowerCase(),
    isOption ? "option" : "item",
    isOption ? "" : toText(row.externalItemId).toLowerCase(),
    isOption ? "*" : canonicalItemName,
    toText(row.externalOptionGroup).toLocaleLowerCase("vi"),
    toText(row.externalOptionName).toLocaleLowerCase("vi")
  ].join("|");
}

export default {
  calculateSalesRecipeComponent,
  getChannelCandidateIdentity,
  normalizeInventoryChannelMappingInput,
  normalizeInventorySalesRecipeInput
};
