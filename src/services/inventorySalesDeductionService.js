import { getSupabaseAdminAuthClient, getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

export function normalizeSalesDeductionSetting(row = {}) {
  return {
    branchUuid: row.branch_uuid || "",
    branchName: row.branch_name || "Chi nhánh",
    enabled: row.enabled === true,
    enabledFrom: row.enabled_from || "",
    updatedAt: row.updated_at || null,
    hasWarehouse: row.has_warehouse === true
  };
}

export function canRetrySalesDeduction(event = {}) {
  return !event.deductionExcluded && ["blocked", "ignored"].includes(event.processingStatus);
}

async function client() {
  const value = getSupabaseAdminAuthClient() || getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!value) throw new Error("Chưa kết nối dữ liệu Kho.");
  return value;
}

export async function readSalesDeductionSettings() {
  const { data, error } = await (await client()).rpc("inventory_read_sales_deduction_settings");
  if (error) throw new Error(error.message || "Không tải được cài đặt tự trừ kho.");
  return { rows: (data?.rows || []).map(normalizeSalesDeductionSetting), canManage: data?.can_manage === true };
}

export async function saveSalesDeductionSetting(row, enabled) {
  if (!isInventoryRuntimeWriteEnabled()) throw new Error("Thao tác ghi dữ liệu Kho đang bị khóa.");
  if (!row?.branchUuid || typeof enabled !== "boolean") throw new Error("Cài đặt chi nhánh không hợp lệ.");
  const { data, error } = await (await client()).rpc("inventory_set_sales_deduction", {
    p_branch_uuid: row.branchUuid, p_enabled: enabled, p_expected_updated_at: row.updatedAt || null
  });
  if (error) throw new Error(error.message || "Không lưu được cài đặt tự trừ kho.");
  if (data?.enabled !== enabled) throw new Error("Chưa xác nhận được chế độ đã lưu. Hãy tải lại.");
  return data;
}

export const canWriteSalesDeductionSettings = () => isInventoryRuntimeWriteEnabled();
export default { readSalesDeductionSettings, saveSalesDeductionSetting };
