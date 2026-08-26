import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function normalizeError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42883", "PGRST202"].includes(code) || message.includes("inventory_get_stock_flow_report")) {
    return { status: "setup", code: "stock_flow_report_missing", message: "Báo cáo Nhập – Xuất – Tồn chưa được triển khai trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "stock_flow_report_denied", message: "Tài khoản chưa có quyền xem báo cáo của kho này." };
  }
  return { status: "error", code: "stock_flow_report_failed", message: toText(error.message) || "Không tải được báo cáo Nhập – Xuất – Tồn." };
}

function normalizeRow(row = {}) {
  return {
    warehouseId: toText(row.warehouse_id),
    warehouseCode: toText(row.warehouse_code),
    warehouseName: toText(row.warehouse_name),
    itemId: toText(row.item_id),
    itemCode: toText(row.item_code),
    itemName: toText(row.item_name),
    groupId: toText(row.group_id),
    groupName: toText(row.group_name),
    baseUnitId: toText(row.base_unit_id),
    unitName: toText(row.unit_name) || "Đơn vị tồn",
    openingQuantity: Number(row.opening_quantity || 0),
    inboundQuantity: Number(row.inbound_quantity || 0),
    outboundQuantity: Number(row.outbound_quantity || 0),
    closingQuantity: Number(row.closing_quantity || 0),
    openingValue: Number(row.opening_value || 0),
    inboundValue: Number(row.inbound_value || 0),
    outboundValue: Number(row.outbound_value || 0),
    closingValue: Number(row.closing_value || 0),
    movementCount: Number(row.movement_count || 0)
  };
}

export async function readInventoryStockFlowReport({
  fromDate,
  toDate,
  warehouseId = "",
  itemId = "",
  groupId = "",
  search = "",
  page = 1,
  pageSize = 100
} = {}) {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const safePage = Math.max(1, Number(page || 1));
  const safePageSize = Math.min(500, Math.max(20, Number(pageSize || 100)));
  const { data, error } = await client.rpc("inventory_get_stock_flow_report", {
    p_from_date: fromDate || null,
    p_to_date: toDate || null,
    p_warehouse_id: warehouseId || null,
    p_item_id: itemId || null,
    p_group_id: groupId || null,
    p_search: toText(search) || null,
    p_limit: safePageSize,
    p_offset: (safePage - 1) * safePageSize
  });
  recordAdminRequest("read inventory stock flow report", "inventory_get_stock_flow_report");
  if (error) return { ok: false, ...normalizeError(error), rows: [] };

  const payload = data && typeof data === "object" ? data : {};
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
  const totalCount = Number(payload.total_count || 0);
  return {
    ok: true,
    status: "ready",
    rows: Array.isArray(payload.rows) ? payload.rows.map(normalizeRow) : [],
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / safePageSize)),
    summary: {
      openingValue: Number(summary.opening_value || 0),
      inboundValue: Number(summary.inbound_value || 0),
      outboundValue: Number(summary.outbound_value || 0),
      closingValue: Number(summary.closing_value || 0),
      movementCount: Number(summary.movement_count || 0)
    }
  };
}

export default { readInventoryStockFlowReport };
