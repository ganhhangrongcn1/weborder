import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import {
  buildInventoryStockReportRows,
  countInventoryStockAttention
} from "./inventoryStockReportCalculations.js";

const REPORT_LIMIT = 5000;

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function normalizeReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42P01", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_report_missing", message: "Schema báo cáo tồn kho chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_report_denied", message: "Tài khoản chưa có quyền xem báo cáo kho." };
  }
  return { status: "error", code: "inventory_report_failed", message: toText(error.message) || "Không tải được báo cáo kho." };
}

function normalizeBalance(row = {}) {
  return {
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    quantity: Number(row.quantity || 0),
    averageCost: Number(row.average_cost || 0),
    updatedAt: toText(row.updated_at)
  };
}

export async function readInventoryStockReport() {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const result = await client
    .from("inventory_stock_balances")
    .select("warehouse_id,item_id,quantity,average_cost,updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(0, REPORT_LIMIT - 1);
  recordAdminRequest("read inventory stock report", "inventory_stock_balances");
  if (result.error) return { ok: false, ...normalizeReadError(result.error), rows: [] };

  return {
    ok: true,
    status: "ready",
    rows: (result.data || []).map(normalizeBalance),
    totalCount: Number(result.count || 0),
    limited: Number(result.count || 0) > REPORT_LIMIT
  };
}

export async function readInventoryStockAttentionCount({ warehouseId = "" } = {}) {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  let balanceQuery = client
    .from("inventory_stock_balances")
    .select("warehouse_id,item_id,quantity");
  let warehouseQuery = client
    .from("inventory_warehouses")
    .select("id,is_active,warehouse_type")
    .eq("is_active", true)
    .is("deleted_at", null);
  if (warehouseId) {
    balanceQuery = balanceQuery.eq("warehouse_id", warehouseId);
    warehouseQuery = warehouseQuery.eq("id", warehouseId);
  }

  const [balanceResult, warehouseResult, itemResult] = await Promise.all([
    balanceQuery.range(0, REPORT_LIMIT - 1),
    warehouseQuery.range(0, REPORT_LIMIT - 1),
    client
      .from("inventory_items")
      .select("id,minimum_stock,reorder_point,is_active,metadata")
      .eq("is_active", true)
      .range(0, REPORT_LIMIT - 1)
  ]);
  recordAdminRequest("count inventory stock attention", "inventory_stock_balances,inventory_warehouses,inventory_items");
  const firstError = balanceResult.error || warehouseResult.error || itemResult.error;
  if (firstError) throw new Error(normalizeReadError(firstError).message);

  const warehouses = (warehouseResult.data || []).map((warehouse) => ({
    id: toText(warehouse.id),
    warehouseType: toText(warehouse.warehouse_type),
    isActive: warehouse.is_active !== false
  }));
  const items = (itemResult.data || []).map((item) => ({
    id: toText(item.id),
    minimumStock: Number(item.minimum_stock || 0),
    reorderPoint: Number(item.reorder_point || 0),
    metadata: item.metadata || {},
    warehouseIds: Array.isArray(item.metadata?.warehouse_ids)
      ? item.metadata.warehouse_ids.map(toText).filter(Boolean)
      : [],
    isActive: item.is_active !== false
  }));
  const rows = (balanceResult.data || []).map((row) => ({
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    quantity: Number(row.quantity || 0)
  }));
  const completeRows = buildInventoryStockReportRows(rows, warehouses, items);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return countInventoryStockAttention(completeRows, itemById);
}

export default { readInventoryStockAttentionCount, readInventoryStockReport };
