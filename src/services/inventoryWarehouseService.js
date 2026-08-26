import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { normalizeWarehouseDraftInput } from "./inventoryWarehouseDraftService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

const WAREHOUSE_SELECT = [
  "id",
  "code",
  "name",
  "warehouse_type",
  "branch_id",
  "branch_uuid",
  "department_code",
  "department_name",
  "address",
  "manager_name",
  "manager_phone",
  "supply_warehouse_id",
  "allows_direct_receipt",
  "allow_negative_stock",
  "is_default_for_branch",
  "is_active",
  "updated_at"
].join(",");

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST202"]);
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);
const PERMISSION_CODES = new Set(["42501"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function isUuidLike(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(toText(value));
}

function createWarehouseCode(type = "other") {
  const prefix = { central: "CTR", branch: "BR", department: "DPT", mobile: "MB", other: "OTH" }[type] || "OTH";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 4).toUpperCase()
    : String(Math.floor(1000 + Math.random() * 9000));
  return `WH-${prefix}-${date}-${suffix}`;
}

function warehouseMatchesDraft(warehouse = {}, draft = {}) {
  return warehouse.isActive !== false
    && toText(warehouse.name).toLocaleLowerCase("vi-VN") === toText(draft.name).toLocaleLowerCase("vi-VN")
    && toText(warehouse.warehouseType) === toText(draft.warehouseType)
    && toText(warehouse.branchUuid) === toText(draft.branchUuid);
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

export function normalizeInventoryWarehouse(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    warehouseType: toText(row.warehouse_type || "other").toLowerCase(),
    branchId: row.branch_id ?? null,
    branchUuid: toText(row.branch_uuid),
    departmentCode: toText(row.department_code),
    departmentName: toText(row.department_name),
    address: toText(row.address),
    managerName: toText(row.manager_name),
    managerPhone: toText(row.manager_phone),
    supplyWarehouseId: toText(row.supply_warehouse_id),
    allowsDirectReceipt: Boolean(row.allows_direct_receipt),
    allowNegativeStock: Boolean(row.allow_negative_stock),
    isDefaultForBranch: Boolean(row.is_default_for_branch),
    isActive: row.is_active !== false,
    updatedAt: toText(row.updated_at)
  };
}

export function getInventoryWarehouseReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();

  if (MISSING_TABLE_CODES.has(code) || message.includes("could not find the table") || message.includes("does not exist")) {
    return {
      status: "setup",
      code: "inventory_schema_missing",
      message: "Schema Kho chưa được triển khai trên Supabase đang chạy. Màn hình vẫn ở chế độ chỉ đọc an toàn."
    };
  }

  if (MISSING_COLUMN_CODES.has(code) || message.includes("could not find") && message.includes("column")) {
    return {
      status: "setup",
      code: "inventory_schema_outdated",
      message: "Schema Kho chưa đủ phiên bản Phase 3. Cần kiểm tra migration trước khi kết nối dữ liệu."
    };
  }

  if (PERMISSION_CODES.has(code) || message.includes("permission denied") || message.includes("row-level security")) {
    return {
      status: "error",
      code: "inventory_access_denied",
      message: "Phiên hiện tại chưa có quyền đọc danh sách kho. Cần đăng nhập Admin và kiểm tra RLS trước khi vận hành."
    };
  }

  return {
    status: "error",
    code: "inventory_read_failed",
    message: toText(error.message) || "Không tải được danh sách kho."
  };
}

export async function readInventoryWarehouses({ branchUuid = "", limit = 200 } = {}) {
  const client = await getInventoryClient();

  if (!client) {
    return {
      ok: false,
      status: "setup",
      code: "supabase_not_ready",
      warehouses: [],
      message: "Chưa kết nối được Supabase cho phân hệ Kho."
    };
  }

  let query = client
    .from("inventory_warehouses")
    .select(WAREHOUSE_SELECT)
    .is("deleted_at", null)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .limit(Math.max(20, Math.min(500, Number(limit || 200))));

  if (branchUuid && branchUuid !== "all" && isUuidLike(branchUuid)) {
    query = query.eq("branch_uuid", branchUuid);
  }

  const { data, error } = await query;
  recordAdminRequest("read inventory warehouses", "inventory_warehouses");

  if (error) {
    const normalizedError = getInventoryWarehouseReadError(error);
    return {
      ok: false,
      ...normalizedError,
      warehouses: []
    };
  }

  return {
    ok: true,
    status: "ready",
    code: "",
    warehouses: (Array.isArray(data) ? data : []).map(normalizeInventoryWarehouse),
    message: ""
  };
}

export function canWriteInventoryWarehouses() {
  return isInventoryRuntimeWriteEnabled();
}

export async function saveInventoryWarehouse({ id = "", input = {} } = {}) {
  if (!canWriteInventoryWarehouses()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn. Cần duyệt migration và bật cờ vận hành riêng cho Kho.");
  }

  const normalized = normalizeWarehouseDraftInput(input);
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");

  const payload = {
    name: normalized.name,
    warehouse_type: normalized.warehouseType,
    branch_uuid: normalized.branchUuid || null,
    department_code: normalized.departmentCode || null,
    department_name: normalized.departmentName || null,
    address: normalized.address || null,
    supply_warehouse_id: normalized.supplyWarehouseId || null,
    allow_negative_stock: normalized.allowNegativeStock,
    allows_direct_receipt: normalized.warehouseType === "central",
    is_default_for_branch: normalized.isDefaultForBranch,
    is_active: true,
    updated_by: actorId
  };

  if (!toText(id)) {
    payload.code = createWarehouseCode(normalized.warehouseType);
    payload.created_by = actorId;
  } else {
    payload.updated_at = new Date().toISOString();
  }

  const query = toText(id)
    ? client.from("inventory_warehouses").update(payload).eq("id", toText(id))
    : client.from("inventory_warehouses").insert(payload);
  const { data, error } = await query.select(WAREHOUSE_SELECT).single();
  recordAdminRequest(`${id ? "update" : "create"} inventory warehouse`, "inventory_warehouses");

  if (error) {
    if (error.code === "23505") {
      throw new Error("Chi nhánh đã có kho mặc định hoặc mã khu này đã tồn tại.");
    }
    if (error.code === "23503") throw new Error("Chi nhánh hoặc kho cấp hàng không còn tồn tại.");
    if (error.code === "23514") throw new Error("Thông tin kho chưa đúng quy tắc vận hành.");
    throw new Error(getInventoryWarehouseReadError(error).message);
  }

  return normalizeInventoryWarehouse(data);
}

export async function setInventoryBranchDefaultWarehouse({ branchUuid = "", warehouseId = "" } = {}) {
  if (!canWriteInventoryWarehouses()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  }

  const normalizedBranchUuid = toText(branchUuid);
  const normalizedWarehouseId = toText(warehouseId);
  if (!isUuidLike(normalizedBranchUuid) || !isUuidLike(normalizedWarehouseId)) {
    throw new Error("Chi nhánh hoặc kho trừ mặc định không hợp lệ.");
  }

  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const { error } = await client.rpc("inventory_set_branch_default_warehouse", {
    p_branch_uuid: normalizedBranchUuid,
    p_warehouse_id: normalizedWarehouseId
  });
  recordAdminRequest("set branch default inventory warehouse", "inventory_warehouses");

  if (error) {
    if (error.code === "42501") throw new Error("Chỉ Admin được đổi kho trừ mặc định của chi nhánh.");
    throw new Error(getInventoryWarehouseReadError(error).message);
  }

  return normalizedWarehouseId;
}

export async function publishInventoryWarehouseDrafts({ drafts = [], existingWarehouses = [] } = {}) {
  if (!canWriteInventoryWarehouses()) {
    throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  }

  const pendingDrafts = (Array.isArray(drafts) ? drafts : []).filter((draft) => draft?.isDraft);
  if (!pendingDrafts.length) {
    return { created: [], matched: [], publishedDraftIds: [] };
  }

  const centralDrafts = pendingDrafts.filter((draft) => draft.warehouseType === "central");
  if (centralDrafts.length > 1) {
    throw new Error("Có nhiều hơn một bản nháp kho trung tâm. Vui lòng giữ lại đúng một kho trước khi chuyển.");
  }

  const currentWarehouses = [...(Array.isArray(existingWarehouses) ? existingWarehouses : [])];
  const created = [];
  const matched = [];
  const publishedDraftIds = [];

  const publishOne = async (draft, inputOverrides = {}) => {
    const existing = currentWarehouses.find((warehouse) => warehouseMatchesDraft(warehouse, draft));
    if (existing) {
      matched.push(existing);
      publishedDraftIds.push(draft.id);
      return existing;
    }

    const warehouse = await saveInventoryWarehouse({
      input: {
        ...draft,
        ...inputOverrides
      }
    });
    currentWarehouses.push(warehouse);
    created.push(warehouse);
    publishedDraftIds.push(draft.id);
    return warehouse;
  };

  let centralWarehouse = currentWarehouses.find((warehouse) => warehouse.isActive !== false && warehouse.warehouseType === "central") || null;
  if (centralDrafts[0]) {
    centralWarehouse = await publishOne(centralDrafts[0]);
  }

  const remainingDrafts = pendingDrafts.filter((draft) => draft.warehouseType !== "central");
  for (const draft of remainingDrafts) {
    const needsSupplyWarehouse = ["branch", "department"].includes(draft.warehouseType);
    if (needsSupplyWarehouse && !centralWarehouse?.id) {
      throw new Error(`Chưa có kho trung tâm để cấp hàng cho “${draft.name}”.`);
    }
    await publishOne(draft, {
      supplyWarehouseId: needsSupplyWarehouse ? centralWarehouse.id : draft.supplyWarehouseId
    });
  }

  return { created, matched, publishedDraftIds };
}

export async function archiveInventoryWarehouse(id = "") {
  if (!toText(id)) throw new Error("Kho cần lưu trữ không hợp lệ.");
  if (!canWriteInventoryWarehouses()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");

  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");
  const now = new Date().toISOString();

  const { error } = await client
    .from("inventory_warehouses")
    .update({ deleted_at: now, deleted_by: actorId, updated_at: now, updated_by: actorId })
    .eq("id", toText(id));
  recordAdminRequest("archive inventory warehouse", "inventory_warehouses");

  if (error) throw new Error(getInventoryWarehouseReadError(error).message);
  return true;
}

export default {
  readInventoryWarehouses,
  setInventoryBranchDefaultWarehouse,
  saveInventoryWarehouse,
  publishInventoryWarehouseDrafts,
  archiveInventoryWarehouse,
  canWriteInventoryWarehouses
};
