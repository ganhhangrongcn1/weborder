const DRAFT_STORAGE_KEY = "ghr_inventory_warehouse_drafts_v1";
const ALLOWED_TYPES = new Set(["central", "branch", "department", "mobile", "other"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function readRows() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRows(rows = []) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(rows));
}

function createDraftId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createWarehouseCode(type = "other") {
  const prefix = {
    central: "CTR",
    branch: "BR",
    department: "DPT",
    mobile: "MB",
    other: "OTH"
  }[type] || "OTH";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `WH-${prefix}-${date}-${suffix}`;
}

export function normalizeWarehouseDraftInput(input = {}) {
  const warehouseType = ALLOWED_TYPES.has(toText(input.warehouseType))
    ? toText(input.warehouseType)
    : "branch";
  const name = toText(input.name);
  const branchUuid = toText(input.branchUuid);

  if (!name) throw new Error("Vui lòng nhập tên kho.");
  if (["branch", "department"].includes(warehouseType) && !branchUuid) {
    throw new Error("Vui lòng chọn chi nhánh cho kho này.");
  }
  const departmentCode = toText(input.departmentCode).toUpperCase().replace(/\s+/g, "_");
  if (warehouseType === "department" && !departmentCode) {
    throw new Error("Vui lòng nhập mã khu cho kho bộ phận.");
  }
  if (departmentCode && !/^[A-Z0-9_-]+$/.test(departmentCode)) {
    throw new Error("Mã khu chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới.");
  }

  return {
    name,
    warehouseType,
    branchUuid,
    departmentCode,
    departmentName: toText(input.departmentName),
    address: toText(input.address),
    supplyWarehouseId: toText(input.supplyWarehouseId),
    allowNegativeStock: Boolean(input.allowNegativeStock),
    isDefaultForBranch: warehouseType === "branch" && input.isDefaultForBranch !== false
  };
}

export function listInventoryWarehouseDrafts() {
  return readRows().map((row) => ({ ...row, isDraft: true }));
}

export function createInventoryWarehouseDraft(input = {}) {
  const normalized = normalizeWarehouseDraftInput(input);
  let rows = readRows();

  if (normalized.warehouseType === "central" && rows.some((row) => row.warehouseType === "central" && row.isActive !== false)) {
    throw new Error("Bản nháp đã có một kho trung tâm đang hoạt động.");
  }

  if (normalized.isDefaultForBranch) {
    rows = rows.map((row) => row.branchUuid === normalized.branchUuid
      ? { ...row, isDefaultForBranch: false }
      : row);
  }

  const now = new Date().toISOString();
  const warehouse = {
    id: createDraftId(),
    code: createWarehouseCode(normalized.warehouseType),
    ...normalized,
    branchId: null,
    managerName: "",
    managerPhone: "",
    allowsDirectReceipt: normalized.warehouseType === "central",
    isActive: true,
    isDraft: true,
    createdAt: now,
    updatedAt: now
  };

  rows.push(warehouse);
  writeRows(rows);
  return warehouse;
}

export function removeInventoryWarehouseDrafts(ids = []) {
  const removableIds = new Set((Array.isArray(ids) ? ids : []).map(toText).filter(Boolean));
  if (!removableIds.size) return listInventoryWarehouseDrafts();
  const rows = readRows().filter((row) => !removableIds.has(toText(row.id)));
  writeRows(rows);
  return listInventoryWarehouseDrafts();
}

export function reconcileInventoryWarehouseDrafts(warehouses = []) {
  const remoteWarehouses = Array.isArray(warehouses) ? warehouses : [];
  const drafts = listInventoryWarehouseDrafts();
  const publishedDraftIds = drafts
    .filter((draft) => remoteWarehouses.some((warehouse) => (
      warehouse?.isDraft !== true
      && warehouse?.isActive !== false
      && toText(warehouse?.name).toLocaleLowerCase("vi-VN") === toText(draft?.name).toLocaleLowerCase("vi-VN")
      && toText(warehouse?.warehouseType) === toText(draft?.warehouseType)
      && toText(warehouse?.branchUuid) === toText(draft?.branchUuid)
    )))
    .map((draft) => draft.id);

  return {
    publishedDraftIds,
    drafts: removeInventoryWarehouseDrafts(publishedDraftIds)
  };
}

export default {
  listInventoryWarehouseDrafts,
  createInventoryWarehouseDraft,
  removeInventoryWarehouseDrafts,
  reconcileInventoryWarehouseDrafts
};
