import { getSupabaseAdminAuthClient, getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { canWriteInventoryDocuments } from "./inventoryDocumentService.js";

export function validateLotDisposalQuantity(value, remainingQuantity) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(remainingQuantity)
    || Math.abs(quantity - Number(quantity.toFixed(6))) > 1e-9) {
    throw new Error("Số lượng hủy phải lớn hơn 0 và không vượt số còn lại của lô (tối đa 6 số lẻ).");
  }
  return quantity;
}

export async function createLotDisposalDraft({ lot, quantity, reason, requestId }) {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const amount = validateLotDisposalQuantity(quantity, lot.remainingQuantity);
  const client = getSupabaseAdminAuthClient() || getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) throw new Error("Chưa kết nối được dữ liệu kho.");
  const { data, error } = await client.rpc("inventory_create_lot_disposal_draft", {
    p_lot_id: lot.id, p_quantity: amount, p_reason: reason.trim(), p_request_id: requestId
  });
  if (error) throw new Error(error.code === "PGRST202"
    ? "Chức năng hủy đúng lô chưa được triển khai trên máy chủ. Chưa tạo phiếu."
    : error.message);
  return data;
}

export default { createLotDisposalDraft, validateLotDisposalQuantity };
