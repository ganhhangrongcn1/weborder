import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import { convertInventoryQuantityToBase } from "./inventoryUnitConversion.js";

const MASTER_DATA_CONFIG = {
  items: {
    table: "inventory_items",
    label: "nguyên vật liệu",
    select: `
      id,code,name,item_type,group_id,base_unit_id,purchase_unit_id,
      purchase_to_base_ratio,default_purchase_price,minimum_stock,reorder_point,is_active,notes,metadata,updated_at,
      itemGroup:inventory_item_groups!inventory_items_group_id_fkey(id,code,name),
      baseUnit:inventory_units!inventory_items_base_unit_id_fkey(id,code,name),
      purchaseUnit:inventory_units!inventory_items_purchase_unit_id_fkey(id,code,name)
    `
  },
  units: {
    table: "inventory_units",
    label: "đơn vị tính",
    select: "id,code,name,symbol,unit_type,decimal_places,base_unit_id,conversion_factor,display_order,is_active,updated_at",
    orderColumn: "display_order"
  },
  "item-categories": {
    table: "inventory_item_groups",
    label: "danh mục nguyên vật liệu",
    select: "id,code,name,description,display_order,is_active,updated_at",
    orderColumn: "display_order"
  },
  suppliers: {
    table: "inventory_suppliers",
    label: "nhà cung cấp",
    select: "id,code,name,contact_name,phone,email,address,payment_notes,is_active,updated_at"
  }
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST202"]);
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST200", "PGRST204"]);
const PERMISSION_CODES = new Set(["42501"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeCode(value = "") {
  return toText(value)
    .replace(/[đĐ]/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createInventoryMasterDataCode(value = "", existingCodes = []) {
  const baseCode = normalizeCode(value);
  if (!baseCode) return "";

  const usedCodes = new Set(existingCodes.map((code) => normalizeCode(code)).filter(Boolean));
  if (!usedCodes.has(baseCode)) return baseCode;

  let suffix = 2;
  while (usedCodes.has(`${baseCode}_${suffix}`)) suffix += 1;
  return `${baseCode}_${suffix}`;
}

function inferUnitType(input = {}) {
  const symbol = normalizeCode(input.symbol).replace(/_/g, "");
  const name = normalizeCode(input.name);
  if (["G", "GR", "GRAM", "KG", "MG", "TAN", "TON"].includes(symbol)
    || /(GRAM|KILOGAM|MILIGAM|TAN)/.test(name)) return "weight";
  if (["ML", "L", "LIT"].includes(symbol)
    || /(MILILIT|LIT)/.test(name)) return "volume";
  if (["MM", "CM", "M", "KM"].includes(symbol)
    || /(MILIMET|CENTIMET|MET|KILOMET)/.test(name)) return "length";
  return "count";
}

function requireText(value, message) {
  const normalized = toText(value);
  if (!normalized) throw new Error(message);
  return normalized;
}

export function normalizeInventoryMasterDataInput(domain, input = {}) {
  const name = requireText(input.name, "Vui lòng nhập tên dữ liệu.");
  const shouldAutoGenerateCode = domain === "units" || domain === "item-categories";
  const code = normalizeCode(input.code || (shouldAutoGenerateCode ? name : ""));
  if (domain !== "items" && !code) throw new Error("Vui lòng nhập mã quản lý.");
  if (code && !/^[A-Z0-9_-]+$/.test(code)) {
    throw new Error("Mã quản lý chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới.");
  }

  if (domain === "units") {
    const unitType = ["count", "weight", "volume", "length", "other"].includes(input.unitType)
      ? input.unitType
      : inferUnitType(input);
    return {
      code,
      name,
      symbol: toText(input.symbol) || null,
      unit_type: unitType,
      decimal_places: unitType === "count" ? 0 : 3,
      base_unit_id: null,
      conversion_factor: 1,
      display_order: Math.max(0, Math.trunc(Number(input.displayOrder || 0))),
      is_active: input.isActive !== false
    };
  }

  if (domain === "item-categories") {
    return {
      code,
      name,
      description: toText(input.description) || null,
      display_order: Math.max(0, Math.trunc(Number(input.displayOrder || 0))),
      is_active: input.isActive !== false
    };
  }

  if (domain === "suppliers") {
    return {
      code,
      name,
      contact_name: toText(input.contactName) || null,
      phone: toText(input.phone) || null,
      email: toText(input.email) || null,
      address: toText(input.address) || null,
      payment_notes: toText(input.paymentNotes) || null,
      is_active: input.isActive !== false
    };
  }

  if (domain === "items") {
    const displayUnitId = toText(input.displayUnitId) || toText(input.purchaseUnitId) || toText(input.baseUnitId);
    const purchaseUnitId = toText(input.purchaseUnitId) || displayUnitId;
    const requestedRatio = Number(input.purchaseToBaseRatio ?? 1);
    const ratio = purchaseUnitId === displayUnitId ? 1 : requestedRatio;
    const stockSettingsFactor = input.stockSettingsUnit === "purchase" ? ratio : 1;
    const minimumStock = Math.max(0, convertInventoryQuantityToBase(input.minimumStock, stockSettingsFactor));
    const reorderPoint = Math.max(0, convertInventoryQuantityToBase(input.reorderPoint, stockSettingsFactor));
    const orderQuantity = Math.max(0, convertInventoryQuantityToBase(input.orderQuantity, stockSettingsFactor));
    const maximumStock = Math.max(0, convertInventoryQuantityToBase(input.maximumStock, stockSettingsFactor));
    const defaultWastePercent = Number(input.defaultWastePercent || 0);
    const trackExpiry = input.trackExpiry === true;
    const shelfLifeDays = Math.trunc(Number(input.shelfLifeDays || 0));
    const expiryWarningDays = Math.trunc(Number(input.expiryWarningDays || 0));
    const requestedItemType = toText(input.itemType).toLowerCase();
    const isDirectSale = requestedItemType === "direct_sale";
    const isTool = requestedItemType === "tool";
    const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {};
    if (!displayUnitId) throw new Error("Vui lòng chọn đơn vị tồn kho.");
    if (!Number.isFinite(requestedRatio) || requestedRatio <= 0) throw new Error("Tỷ lệ quy đổi mua phải lớn hơn 0.");
    if (!Number.isFinite(defaultWastePercent) || defaultWastePercent < 0 || defaultWastePercent > 100) {
      throw new Error("Hao hụt mặc định phải nằm trong khoảng từ 0% đến 100%.");
    }
    if (trackExpiry && (!Number.isFinite(shelfLifeDays) || shelfLifeDays < 1)) {
      throw new Error("Thời hạn sử dụng phải từ 1 ngày trở lên.");
    }
    if (trackExpiry && (!Number.isFinite(expiryWarningDays) || expiryWarningDays < 0 || expiryWarningDays > shelfLifeDays)) {
      throw new Error("Số ngày cảnh báo phải từ 0 đến thời hạn sử dụng.");
    }
    if (maximumStock > 0 && maximumStock < minimumStock) {
      throw new Error("Tồn tối đa phải bằng 0 hoặc lớn hơn tồn tối thiểu.");
    }
    if (isDirectSale) {
      metadata.usage_mode = "direct_sale";
      delete metadata.item_kind;
    } else if (isTool) {
      metadata.item_kind = "tool";
      delete metadata.usage_mode;
    } else {
      delete metadata.usage_mode;
      delete metadata.item_kind;
    }
    metadata.display_unit_id = displayUnitId;
    metadata.order_quantity = orderQuantity;
    metadata.maximum_stock = maximumStock;
    metadata.default_waste_percent = defaultWastePercent;
    metadata.track_expiry = trackExpiry;
    metadata.shelf_life_days = trackExpiry ? shelfLifeDays : 0;
    metadata.expiry_warning_days = trackExpiry ? expiryWarningDays : 0;
    const warehouseIds = Array.isArray(input.warehouseIds)
      ? [...new Set(input.warehouseIds.map(toText).filter(Boolean))]
      : [];
    if (warehouseIds.length) metadata.warehouse_ids = warehouseIds;
    else delete metadata.warehouse_ids;
    return {
      ...(code ? { code } : {}),
      name,
      item_type: isDirectSale
        ? "finished_good"
        : isTool
        ? "other"
        : ["ingredient", "semi_finished", "finished_good", "packaging", "consumable", "other"].includes(requestedItemType)
        ? requestedItemType
        : "ingredient",
      group_id: toText(input.groupId) || null,
      base_unit_id: displayUnitId,
      purchase_unit_id: purchaseUnitId,
      purchase_to_base_ratio: ratio,
      minimum_stock: minimumStock,
      reorder_point: reorderPoint,
      notes: toText(input.notes) || null,
      metadata,
      is_active: input.isActive !== false
    };
  }

  throw new Error("Loại dữ liệu nền không hợp lệ.");
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

async function getActorId(client) {
  const { data } = await client.auth.getSession();
  return toText(data?.session?.user?.id);
}

export function normalizeInventoryUnit(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    symbol: toText(row.symbol),
    unitType: toText(row.unit_type || "other").toLowerCase(),
    decimalPlaces: Math.max(0, Math.min(6, Number(row.decimal_places ?? 3))),
    baseUnitId: toText(row.base_unit_id),
    conversionFactor: Math.max(0, Number(row.conversion_factor ?? 1)),
    displayOrder: Math.max(0, Number(row.display_order || 0)),
    isActive: row.is_active !== false,
    updatedAt: toText(row.updated_at)
  };
}

export function normalizeInventoryItemCategory(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    description: toText(row.description),
    displayOrder: Math.max(0, Number(row.display_order || 0)),
    isActive: row.is_active !== false,
    updatedAt: toText(row.updated_at)
  };
}

function normalizeReference(row = {}) {
  return {
    id: toText(row?.id),
    code: toText(row?.code),
    name: toText(row?.name)
  };
}

export function normalizeInventoryItem(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? { ...row.metadata }
    : {};
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    itemType: metadata.item_kind === "tool"
      ? "tool"
      : metadata.usage_mode === "direct_sale"
      ? "direct_sale"
      : toText(row.item_type || "other").toLowerCase(),
    groupId: toText(row.group_id),
    itemGroup: normalizeReference(row.itemGroup),
    baseUnitId: toText(row.base_unit_id),
    baseUnit: normalizeReference(row.baseUnit),
    displayUnitId: toText(metadata.display_unit_id || row.purchase_unit_id || row.base_unit_id),
    purchaseUnitId: toText(row.purchase_unit_id),
    purchaseUnit: normalizeReference(row.purchaseUnit),
    purchaseToBaseRatio: Math.max(0, Number(row.purchase_to_base_ratio ?? 1)),
    defaultPurchasePrice: Math.max(0, Number(row.default_purchase_price ?? 0)),
    minimumStock: Math.max(0, Number(row.minimum_stock ?? 0)),
    reorderPoint: Math.max(0, Number(row.reorder_point ?? 0)),
    orderQuantity: Math.max(0, Number(metadata.order_quantity ?? 0)),
    maximumStock: Math.max(0, Number(metadata.maximum_stock ?? 0)),
    defaultWastePercent: Math.max(0, Math.min(100, Number(metadata.default_waste_percent ?? 0))),
    trackExpiry: metadata.track_expiry === true,
    shelfLifeDays: Math.max(0, Math.trunc(Number(metadata.shelf_life_days ?? 0))),
    expiryWarningDays: Math.max(0, Math.trunc(Number(metadata.expiry_warning_days ?? 0))),
    warehouseIds: Array.isArray(metadata.warehouse_ids)
      ? [...new Set(metadata.warehouse_ids.map(toText).filter(Boolean))]
      : [],
    notes: toText(row.notes),
    metadata,
    isActive: row.is_active !== false,
    updatedAt: toText(row.updated_at)
  };
}

export function isInventoryItemAvailableAtWarehouse(item = {}, warehouseId = "") {
  const targetWarehouseId = toText(warehouseId);
  const warehouseIds = Array.isArray(item.warehouseIds)
    ? item.warehouseIds.map(toText).filter(Boolean)
    : [];
  return !targetWarehouseId || !warehouseIds.length || warehouseIds.includes(targetWarehouseId);
}

export function filterInventoryItemsByWarehouse(items = [], warehouseId = "") {
  return items.filter((item) => isInventoryItemAvailableAtWarehouse(item, warehouseId));
}

export function normalizeInventorySupplier(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    contactName: toText(row.contact_name),
    phone: toText(row.phone),
    email: toText(row.email),
    address: toText(row.address),
    paymentNotes: toText(row.payment_notes),
    isActive: row.is_active !== false,
    updatedAt: toText(row.updated_at)
  };
}

function normalizeMasterDataRows(domain, rows = []) {
  const normalizers = {
    items: normalizeInventoryItem,
    units: normalizeInventoryUnit,
    "item-categories": normalizeInventoryItemCategory,
    suppliers: normalizeInventorySupplier
  };
  const normalizer = normalizers[domain] || normalizeInventoryItemCategory;
  return rows.map(normalizer);
}

export function getInventoryMasterDataReadError(error = {}, domain = "units") {
  const config = MASTER_DATA_CONFIG[domain] || MASTER_DATA_CONFIG.units;
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();

  if (MISSING_TABLE_CODES.has(code) || message.includes("could not find the table") || message.includes("does not exist")) {
    return {
      status: "setup",
      code: "inventory_schema_missing",
      message: `Bảng ${config.label} chưa được triển khai trên Supabase đang chạy. Màn hình vẫn ở chế độ chỉ đọc an toàn.`
    };
  }

  if (MISSING_COLUMN_CODES.has(code) || message.includes("could not find") && message.includes("column")) {
    return {
      status: "setup",
      code: "inventory_schema_outdated",
      message: `Schema ${config.label} chưa đủ phiên bản Phase 3. Cần kiểm tra migration trước khi kết nối dữ liệu.`
    };
  }

  if (PERMISSION_CODES.has(code) || message.includes("permission denied") || message.includes("row-level security")) {
    return {
      status: "error",
      code: "inventory_access_denied",
      message: `Phiên hiện tại chưa có quyền đọc ${config.label}. Cần kiểm tra Data API grant và RLS trước khi vận hành.`
    };
  }

  return {
    status: "error",
    code: "inventory_master_data_read_failed",
    message: toText(error.message) || `Không tải được ${config.label}.`
  };
}

export async function readInventoryMasterData({ domain = "units", limit = 500 } = {}) {
  const config = MASTER_DATA_CONFIG[domain];
  if (!config) {
    return {
      ok: false,
      status: "error",
      code: "inventory_domain_invalid",
      rows: [],
      message: "Loại dữ liệu nền không hợp lệ."
    };
  }

  const client = await getInventoryClient();

  if (!client) {
    return {
      ok: false,
      status: "setup",
      code: "supabase_not_ready",
      rows: [],
      message: "Chưa kết nối được Supabase cho phân hệ Kho."
    };
  }

  let query = client
    .from(config.table)
    .select(config.select)
    .is("deleted_at", null)
    .order("is_active", { ascending: false });

  if (config.orderColumn) {
    query = query.order(config.orderColumn, { ascending: true });
  }

  const { data, error } = await query
    .order("name", { ascending: true })
    .limit(Math.max(20, Math.min(1000, Number(limit || 500))));

  recordAdminRequest(`read inventory ${domain}`, config.table);

  if (error) {
    return {
      ok: false,
      ...getInventoryMasterDataReadError(error, domain),
      rows: []
    };
  }

  return {
    ok: true,
    status: "ready",
    code: "",
    rows: normalizeMasterDataRows(domain, Array.isArray(data) ? data : []),
    message: ""
  };
}

export function canWriteInventoryMasterData() {
  return isInventoryRuntimeWriteEnabled();
}

export async function updateInventoryItemDefaultPurchasePrice({ id = "", value = 0 } = {}) {
  const itemId = toText(id);
  const defaultPurchasePrice = Number(value);
  if (!itemId) throw new Error("Nguyên vật liệu cần cập nhật không hợp lệ.");
  if (!Number.isFinite(defaultPurchasePrice) || defaultPurchasePrice < 0) {
    throw new Error("Giá mua mặc định phải từ 0 đồng trở lên.");
  }
  if (!canWriteInventoryMasterData()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  }

  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");

  const { data, error } = await client
    .from(MASTER_DATA_CONFIG.items.table)
    .update({
      default_purchase_price: defaultPurchasePrice,
      updated_at: new Date().toISOString(),
      updated_by: actorId
    })
    .eq("id", itemId)
    .eq("item_type", "ingredient")
    .is("deleted_at", null)
    .select(MASTER_DATA_CONFIG.items.select)
    .maybeSingle();
  recordAdminRequest("update inventory item default purchase price", MASTER_DATA_CONFIG.items.table);

  if (error) {
    const normalized = getInventoryMasterDataReadError(error, "items");
    throw new Error(normalized.message);
  }
  if (!data) throw new Error("Chỉ nguyên vật liệu mới được thiết lập giá mua mặc định.");
  return normalizeInventoryItem(data);
}

export async function saveInventoryMasterData({ domain = "units", id = "", input = {} } = {}) {
  const config = MASTER_DATA_CONFIG[domain];
  if (!config) throw new Error("Loại dữ liệu nền không hợp lệ.");
  if (!canWriteInventoryMasterData()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn. Cần duyệt migration và bật cờ vận hành riêng cho Kho.");
  }

  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");

  const now = new Date().toISOString();
  const payload = {
    ...normalizeInventoryMasterDataInput(domain, input),
    updated_at: now,
    updated_by: actorId
  };

  const recordId = toText(id);
  let restoredArchivedRecord = false;
  let targetId = recordId;

  if (!recordId && payload.code) {
    const { data: existing, error: lookupError } = await client
      .from(config.table)
      .select("id,deleted_at")
      .eq("code", payload.code)
      .maybeSingle();

    if (lookupError) {
      const normalized = getInventoryMasterDataReadError(lookupError, domain);
      throw new Error(normalized.message);
    }

    if (existing?.id && existing?.deleted_at) {
      restoredArchivedRecord = true;
      targetId = toText(existing.id);
    } else if (existing?.id) {
      throw new Error(`Mã ${config.label} đã tồn tại.`);
    }
  }

  if (!recordId && !restoredArchivedRecord) payload.created_by = actorId;

  const writePayload = restoredArchivedRecord
    ? { ...payload, deleted_at: null, deleted_by: null }
    : payload;
  const query = targetId
    ? client.from(config.table).update(writePayload).eq("id", targetId)
    : client.from(config.table).insert(writePayload);
  const { data, error } = await query.select(config.select).single();
  recordAdminRequest(`${recordId ? "update" : restoredArchivedRecord ? "restore" : "create"} inventory ${domain}`, config.table);

  if (error) {
    if (error.code === "23505") throw new Error(`Mã ${config.label} đã tồn tại.`);
    if (error.code === "23503") throw new Error("Dữ liệu liên kết không còn tồn tại. Hãy tải lại danh sách.");
    if (error.code === "23514") throw new Error("Dữ liệu chưa đúng quy tắc vận hành Kho.");
    const normalized = getInventoryMasterDataReadError(error, domain);
    throw new Error(normalized.message);
  }

  return normalizeMasterDataRows(domain, [data])[0];
}

export async function archiveInventoryMasterData({ domain = "units", id = "" } = {}) {
  const config = MASTER_DATA_CONFIG[domain];
  if (!config || !toText(id)) throw new Error("Dữ liệu cần lưu trữ không hợp lệ.");
  if (!canWriteInventoryMasterData()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  }

  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");

  const now = new Date().toISOString();
  const { error } = await client
    .from(config.table)
    .update({ deleted_at: now, deleted_by: actorId, updated_at: now, updated_by: actorId })
    .eq("id", toText(id));
  recordAdminRequest(`archive inventory ${domain}`, config.table);

  if (error) {
    const normalized = getInventoryMasterDataReadError(error, domain);
    throw new Error(normalized.message);
  }

  return true;
}

export default {
  readInventoryMasterData,
  saveInventoryMasterData,
  archiveInventoryMasterData,
  updateInventoryItemDefaultPurchasePrice,
  canWriteInventoryMasterData
};
