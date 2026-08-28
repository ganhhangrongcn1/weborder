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

export const INVENTORY_BOM_SCOPE_OPTIONS = [
  { value: "central", label: "Sản xuất / đóng gói tại Kho Tổng", warehouseType: "central" },
  { value: "branch", label: "Sơ chế dùng chung cho tất cả Kho chi nhánh", warehouseType: "branch" },
  { value: "department", label: "Sơ chế tại Kho bộ phận", warehouseType: "department" }
];

export function getInventoryBomScopeOptions(warehouses = []) {
  const availableTypes = new Set(
    warehouses
      .filter((warehouse) => warehouse?.isActive !== false)
      .map((warehouse) => warehouse?.warehouseType)
      .filter(Boolean)
  );
  return INVENTORY_BOM_SCOPE_OPTIONS.filter((option) => availableTypes.has(option.warehouseType));
}

export function calculateBomComponentRequirement({
  quantity = 0,
  wastePercent = 0,
  conversionToBase = 1
} = {}) {
  const netBaseQuantity = Number(quantity || 0) * Number(conversionToBase || 1);
  const grossBaseQuantity = netBaseQuantity * (1 + Number(wastePercent || 0) / 100);
  return {
    netBaseQuantity,
    grossBaseQuantity,
    wasteBaseQuantity: grossBaseQuantity - netBaseQuantity
  };
}

export function hasInventoryBomCycle({ outputItemId = "", componentItemIds = [], boms = [] } = {}) {
  const outputId = toText(outputItemId);
  if (!outputId) return false;

  const graph = new Map();
  boms.forEach((bom) => {
    if (bom?.deletedAt || bom?.status === "inactive" || !bom?.outputItemId) return;
    const children = graph.get(bom.outputItemId) || new Set();
    (bom.components || []).forEach((component) => {
      if (component?.componentItemId) children.add(component.componentItemId);
    });
    graph.set(bom.outputItemId, children);
  });
  graph.set(outputId, new Set(componentItemIds.map(toText).filter(Boolean)));

  const visiting = new Set();
  const visited = new Set();
  const visit = (itemId) => {
    if (visiting.has(itemId)) return true;
    if (visited.has(itemId)) return false;
    visiting.add(itemId);
    for (const childId of graph.get(itemId) || []) {
      if (visit(childId)) return true;
    }
    visiting.delete(itemId);
    visited.add(itemId);
    return false;
  };

  return visit(outputId);
}

export function normalizeInventoryBomDraft(input = {}, { items = [], units = [], warehouses = [], boms = [] } = {}) {
  const outputItemId = toText(input.outputItemId);
  const outputItem = items.find((item) => item.id === outputItemId);
  if (!outputItem || outputItem.itemType !== "semi_finished") {
    throw new Error("Vui lòng chọn một bán thành phẩm làm đầu ra.");
  }

  const yieldQuantity = toPositiveNumber(input.yieldQuantity, "Sản lượng chuẩn phải lớn hơn 0.");
  const yieldUnitId = toText(input.yieldUnitId);
  const compatibleYieldUnits = getInventoryCompatibleUnits(outputItem, units);
  if (!compatibleYieldUnits.some((unit) => unit.id === yieldUnitId)) {
    throw new Error("Đơn vị sản lượng không cùng hệ với đơn vị tồn của bán thành phẩm.");
  }

  const productionScope = ["central", "branch", "department", "any"].includes(input.productionScope)
    ? input.productionScope
    : "central";
  const defaultWarehouseId = toText(input.defaultWarehouseId);
  const isSharedBranchRecipe = productionScope === "branch" && !defaultWarehouseId;
  const defaultWarehouse = warehouses.find((warehouse) => warehouse.id === defaultWarehouseId && warehouse.isActive !== false);
  if (!defaultWarehouse && !isSharedBranchRecipe) throw new Error("Vui lòng chọn Kho thực hiện cho công thức chế biến.");
  const expectedWarehouseType = { central: "central", branch: "branch", department: "department" }[productionScope];
  if (expectedWarehouseType && defaultWarehouse && defaultWarehouse.warehouseType !== expectedWarehouseType) {
    throw new Error("Kho thực hiện không phù hợp với loại công thức đã chọn.");
  }
  const rawComponents = Array.isArray(input.components) ? input.components : [];
  if (!rawComponents.length) throw new Error("BOM phải có ít nhất một thành phần.");

  const usedItemIds = new Set();
  const components = rawComponents.map((component, index) => {
    const componentItemId = toText(component.componentItemId);
    const componentItem = items.find((item) => item.id === componentItemId);
    if (!componentItem || componentItem.isActive === false) {
      throw new Error(`Thành phần dòng ${index + 1} không còn sử dụng.`);
    }
    if (componentItemId === outputItemId) {
      throw new Error("Bán thành phẩm không thể dùng chính nó làm thành phần.");
    }
    if (usedItemIds.has(componentItemId)) {
      throw new Error("Mỗi nguyên vật liệu chỉ được xuất hiện một lần trong BOM.");
    }
    usedItemIds.add(componentItemId);

    const quantity = toPositiveNumber(component.quantity, `Số lượng dòng ${index + 1} phải lớn hơn 0.`);
    const wastePercent = toWastePercent(component.wastePercent);
    const unitId = toText(component.unitId);
    const compatibleUnits = getInventoryCompatibleUnits(componentItem, units);
    const unit = compatibleUnits.find((option) => option.id === unitId);
    if (!unit) throw new Error(`Đơn vị dòng ${index + 1} chưa được cấu hình là đơn vị sử dụng hoặc mua / nhập của nguyên vật liệu.`);

    return {
      componentItemId,
      quantity,
      unitId,
      wastePercent,
      displayOrder: index,
      notes: toText(component.notes),
      conversionToBase: getInventoryUnitToBaseFactor(componentItem, unit)
    };
  });

  if (hasInventoryBomCycle({
    outputItemId,
    componentItemIds: components.map((component) => component.componentItemId),
    boms: boms.filter((bom) => bom.id !== input.id)
  })) {
    throw new Error("BOM tạo vòng lặp giữa các bán thành phẩm.");
  }

  return {
    id: toText(input.id),
    outputItemId,
    yieldQuantity,
    yieldUnitId,
    productionScope,
    defaultWarehouseId,
    effectiveFrom: toText(input.effectiveFrom) || new Date().toISOString().slice(0, 10),
    notes: toText(input.notes),
    components
  };
}

export default {
  calculateBomComponentRequirement,
  getInventoryBomScopeOptions,
  hasInventoryBomCycle,
  normalizeInventoryBomDraft
};
