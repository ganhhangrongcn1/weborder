import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

const EMPTY_DASHBOARD = {
  generatedAt: "",
  kpis: {
    inventoryValue: 0,
    outOfStockCount: 0,
    reorderCount: 0,
    expiredCount: 0,
    expiringCount: 0,
    pendingCount: 0
  },
  activity7d: {
    receiptValue: 0,
    issueValue: 0,
    countVarianceValue: 0,
    incompleteTransfers: 0
  },
  actions: [],
  warehouses: []
};

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function normalizeAction(row = {}) {
  return {
    priority: toNumber(row.priority),
    kind: toText(row.kind),
    title: toText(row.title),
    description: toText(row.description),
    warehouseId: toText(row.warehouse_id),
    warehouseName: toText(row.warehouse_name),
    itemId: toText(row.item_id),
    itemCode: toText(row.item_code),
    itemName: toText(row.item_name),
    documentId: toText(row.document_id),
    documentNo: toText(row.document_no),
    documentType: toText(row.document_type),
    status: toText(row.status),
    routePage: toText(row.route_page || "reports"),
    stockState: toText(row.stock_state || "all"),
    quantity: row.quantity == null ? null : toNumber(row.quantity),
    expiresOn: toText(row.expires_on),
    lotNumber: toText(row.lot_number),
    occurredAt: toText(row.occurred_at)
  };
}

function normalizeWarehouse(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    name: toText(row.name),
    warehouseType: toText(row.warehouse_type),
    inventoryValue: toNumber(row.inventory_value),
    outOfStockCount: toNumber(row.out_of_stock_count),
    reorderCount: toNumber(row.reorder_count),
    expiryCount: toNumber(row.expiry_count),
    pendingCount: toNumber(row.pending_count)
  };
}

function normalizeDashboard(data = {}) {
  const kpis = data.kpis || {};
  const activity = data.activity_7d || {};
  return {
    generatedAt: toText(data.generated_at),
    kpis: {
      inventoryValue: toNumber(kpis.inventory_value),
      outOfStockCount: toNumber(kpis.out_of_stock_count),
      reorderCount: toNumber(kpis.reorder_count),
      expiredCount: toNumber(kpis.expired_count),
      expiringCount: toNumber(kpis.expiring_count),
      pendingCount: toNumber(kpis.pending_count)
    },
    activity7d: {
      receiptValue: toNumber(activity.receipt_value),
      issueValue: toNumber(activity.issue_value),
      countVarianceValue: toNumber(activity.count_variance_value),
      incompleteTransfers: toNumber(activity.incomplete_transfers)
    },
    actions: (Array.isArray(data.actions) ? data.actions : []).map(normalizeAction),
    warehouses: (Array.isArray(data.warehouses) ? data.warehouses : []).map(normalizeWarehouse)
  };
}

function normalizeReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42883", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_dashboard_missing", message: "Nguồn Tổng quan kho chưa được triển khai trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_dashboard_denied", message: "Tài khoản chưa có quyền xem Tổng quan kho." };
  }
  return { status: "error", code: "inventory_dashboard_failed", message: toText(error.message) || "Không tải được Tổng quan kho." };
}

export async function readInventoryDashboard() {
  const client = await getInventoryClient();
  if (!client) {
    return { ok: false, status: "setup", data: EMPTY_DASHBOARD, message: "Chưa kết nối được Supabase cho phân hệ Kho." };
  }

  const { data, error } = await client.rpc("get_inventory_dashboard_summary");
  recordAdminRequest("read inventory dashboard", "get_inventory_dashboard_summary");
  if (error) return { ok: false, ...normalizeReadError(error), data: EMPTY_DASHBOARD };

  return { ok: true, status: "ready", code: "", message: "", data: normalizeDashboard(data || {}) };
}

export { EMPTY_DASHBOARD };

export default { readInventoryDashboard };
