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

function findActiveSalesRecipe(recipes = [], entityType = "product", entityId = "", branchUuid = "", effectiveFrom = "") {
  return recipes
    .filter((recipe) => (
      recipe.status === "active"
      && !recipe.deletedAt
      && recipe.menuEntityType === entityType
      && recipe.menuEntityId === entityId
      && (!recipe.branchUuid || recipe.branchUuid === branchUuid)
      && (!branchUuid ? !recipe.branchUuid : true)
      && (!recipe.effectiveFrom || recipe.effectiveFrom <= effectiveFrom)
      && (!recipe.effectiveTo || recipe.effectiveTo >= effectiveFrom)
    ))
    .sort((left, right) => Number(Boolean(right.branchUuid)) - Number(Boolean(left.branchUuid)) || Number(right.version || 0) - Number(left.version || 0))[0] || null;
}

export function hasInventorySalesRecipeDependency({
  recipes = [],
  sourceEntityType = "product",
  sourceEntityId = "",
  targetEntityType = "product",
  targetEntityId = "",
  branchUuid = "",
  effectiveFrom = "",
  visited = new Set()
} = {}) {
  const sourceKey = `${sourceEntityType}:${sourceEntityId}`;
  if (sourceEntityType === targetEntityType && sourceEntityId === targetEntityId) return true;
  if (visited.has(sourceKey)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(sourceKey);
  const recipe = findActiveSalesRecipe(recipes, sourceEntityType, sourceEntityId, branchUuid, effectiveFrom);
  if (!recipe) return false;

  const dependencies = recipe.sharedMenuEntityId
    ? [{ menuEntityType: recipe.sharedMenuEntityType, menuEntityId: recipe.sharedMenuEntityId }]
    : (Array.isArray(recipe.sources) ? recipe.sources : []);
  return dependencies.some((source) => hasInventorySalesRecipeDependency({
    recipes,
    sourceEntityType: source.menuEntityType,
    sourceEntityId: source.menuEntityId,
    targetEntityType,
    targetEntityId,
    branchUuid,
    effectiveFrom,
    visited: nextVisited
  }));
}

export function normalizeInventorySalesRecipeInput(input = {}, {
  menuEntities = [],
  items = [],
  units = [],
  recipes = []
} = {}) {
  const menuEntityType = ["product", "topping"].includes(input.menuEntityType)
    ? input.menuEntityType
    : "product";
  const menuEntityId = toText(input.menuEntityId);
  const menuEntity = menuEntities.find((entity) => entity.id === menuEntityId && entity.type === menuEntityType);
  if (!menuEntity) throw new Error("Vui lòng chọn món hoặc topping trong Menu.");

  const recipeMode = ["shared", "composed"].includes(input.recipeMode) ? input.recipeMode : "direct";
  const sharedMenuEntityType = recipeMode === "shared"
    ? (input.sharedMenuEntityType === "topping" ? "topping" : "product")
    : "";
  const sharedMenuEntityId = recipeMode === "shared" ? toText(input.sharedMenuEntityId) : "";
  const sharedMenuEntity = sharedMenuEntityId
    ? menuEntities.find((entity) => entity.id === sharedMenuEntityId && entity.type === sharedMenuEntityType)
    : null;
  if (recipeMode === "shared" && !sharedMenuEntity) {
    throw new Error("Vui lòng chọn định lượng gốc muốn dùng chung.");
  }
  if (sharedMenuEntity && sharedMenuEntity.id === menuEntityId && sharedMenuEntity.type === menuEntityType) {
    throw new Error("Một món không thể dùng chung định lượng với chính nó.");
  }

  const yieldQuantity = toPositiveNumber(input.yieldQuantity || 1, "Số phần chuẩn phải lớn hơn 0.");
  const branchUuid = toText(input.branchUuid);
  const effectiveFrom = toText(input.effectiveFrom) || new Date().toISOString().slice(0, 10);
  const usedSources = new Set();
  const sources = (recipeMode === "composed" ? (Array.isArray(input.sources) ? input.sources : []) : []).map((source, index) => {
    const menuEntityType = source.menuEntityType === "topping" ? "topping" : "product";
    const menuEntityId = toText(source.menuEntityId);
    const entity = menuEntities.find((row) => row.id === menuEntityId && row.type === menuEntityType);
    if (!entity) throw new Error(`Món gốc dòng ${index + 1} không còn sử dụng.`);
    if (menuEntityType === input.menuEntityType && menuEntityId === toText(input.menuEntityId)) {
      throw new Error("Một combo không thể chứa chính nó.");
    }
    const key = `${menuEntityType}:${menuEntityId}`;
    if (usedSources.has(key)) throw new Error("Mỗi món gốc chỉ được thêm một lần trong combo.");
    usedSources.add(key);
    if (!findActiveSalesRecipe(recipes, menuEntityType, menuEntityId, branchUuid, effectiveFrom)) {
      throw new Error(`${entity.name} chưa có định lượng đang áp dụng phù hợp.`);
    }
    if (hasInventorySalesRecipeDependency({
      recipes,
      sourceEntityType: menuEntityType,
      sourceEntityId: menuEntityId,
      targetEntityType: input.menuEntityType,
      targetEntityId: toText(input.menuEntityId),
      branchUuid,
      effectiveFrom
    })) throw new Error("Không thể ghép vì các định lượng sẽ tham chiếu vòng lặp.");
    return {
      menuEntityType,
      menuEntityId,
      menuEntityName: toText(entity.name),
      quantity: toPositiveNumber(source.quantity || 1, `Số lượng món gốc dòng ${index + 1} phải lớn hơn 0.`),
      displayOrder: index
    };
  });
  if (recipeMode === "composed" && !sources.length) throw new Error("Combo phải có ít nhất một món gốc.");
  const usedItems = new Set();
  const components = (recipeMode === "direct" ? (Array.isArray(input.components) ? input.components : []) : []).map((component, index) => {
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
  if (recipeMode === "direct" && !components.length) throw new Error("Định lượng món bán phải có ít nhất một thành phần.");

  return {
    id: toText(input.id),
    menuEntityType,
    menuEntityId,
    menuEntityName: toText(menuEntity.name),
    branchUuid,
    yieldQuantity,
    effectiveFrom,
    notes: toText(input.notes),
    sharedMenuEntityType: sharedMenuEntity?.type || "",
    sharedMenuEntityId: sharedMenuEntity?.id || "",
    sharedMenuEntityName: toText(sharedMenuEntity?.name),
    sources,
    components
  };
}

export function getInventorySalesRecipeCoverage(menuEntity = {}, recipes = []) {
  const related = recipes.filter((recipe) => (
    recipe.menuEntityType === menuEntity.type
    && recipe.menuEntityId === menuEntity.id
    && !recipe.deletedAt
  ));
  if (related.some((recipe) => recipe.status === "active")) return "active";
  if (related.some((recipe) => recipe.status === "draft")) return "draft";
  return "missing";
}

export function getInventorySalesRecipeScopeConflict({
  recipes = [],
  menuEntityType = "product",
  menuEntityId = "",
  branchUuid = "",
  recipeId = "",
  allowActiveVersion = false
} = {}) {
  if (!menuEntityId) return null;
  const related = recipes.filter((recipe) => (
    recipe.id !== recipeId
    && recipe.menuEntityType === menuEntityType
    && recipe.menuEntityId === menuEntityId
    && String(recipe.branchUuid || "") === String(branchUuid || "")
    && !recipe.deletedAt
  ));
  const draft = related.find((recipe) => recipe.status === "draft");
  if (draft) return { type: "draft", recipe: draft };
  const active = related.find((recipe) => recipe.status === "active");
  if (active && !allowActiveVersion) return { type: "active", recipe: active };
  return null;
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
  const status = input.status === "inactive" ? "inactive" : "active";
  if (!branchUuid) throw new Error("Vui lòng chọn chi nhánh của món app.");
  if (!externalItemName) throw new Error("Vui lòng nhập tên món trên app.");
  if (mappingKind === "option" && (!externalOptionGroup || !externalOptionName)) {
    throw new Error("Vui lòng nhập đủ nhóm và lựa chọn của combo.");
  }

  const usedTargets = new Set();
  const targets = ignoreInventory || status === "inactive" ? [] : (Array.isArray(input.targets) ? input.targets : []).map((target, index) => {
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
  if (status === "active" && !ignoreInventory && !targets.length) {
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
    status,
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
    isOption ? "*" : toText(row.externalOptionGroup).toLocaleLowerCase("vi"),
    toText(row.externalOptionName).toLocaleLowerCase("vi")
  ].join("|");
}

export function isChannelCandidateMapped(candidate = {}, mappings = []) {
  const isOption = candidate.candidateKind === "option" || candidate.mappingKind === "option";
  if (!isOption) {
    const identity = getChannelCandidateIdentity(candidate);
    return mappings.some((mapping) => getChannelCandidateIdentity(mapping) === identity);
  }

  const source = toText(candidate.partnerSource).toLowerCase();
  const branch = toText(candidate.branchUuid).toLowerCase();
  const optionGroup = toText(candidate.externalOptionGroup).toLocaleLowerCase("vi");
  const optionName = toText(candidate.externalOptionName).toLocaleLowerCase("vi");
  return mappings.some((mapping) => {
    if (mapping.mappingKind !== "option") return false;
    if (toText(mapping.partnerSource).toLowerCase() !== source) return false;
    if (source !== "shopeefood" && toText(mapping.branchUuid).toLowerCase() !== branch) return false;
    if (toText(mapping.externalOptionName).toLocaleLowerCase("vi") !== optionName) return false;
    const mappedGroup = toText(mapping.externalOptionGroup).toLocaleLowerCase("vi");
    return mappedGroup === "*" || (optionGroup !== "*" && mappedGroup === optionGroup);
  });
}

export default {
  calculateSalesRecipeComponent,
  getInventorySalesRecipeCoverage,
  getInventorySalesRecipeScopeConflict,
  getChannelCandidateIdentity,
  isChannelCandidateMapped,
  hasInventorySalesRecipeDependency,
  normalizeInventoryChannelMappingInput,
  normalizeInventorySalesRecipeInput
};
