import {
  getSupabaseRuntimeClient, initSupabaseRuntimeClient,
  getSupabaseKitchenAuthClient, getSupabaseAdminAuthClient
} from "../supabase/supabaseRuntimeClient.js";
import { shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";

async function rpc(name, payload, { write = false, staff = false } = {}) {
  if (write && !shouldWriteDomainToSupabase("loyalty")) {
    throw new Error("Hệ thống đang tạm ngưng nhận điểm. Vui lòng thử lại sau.");
  }
  const client = staff
    ? getSupabaseKitchenAuthClient() || getSupabaseAdminAuthClient()
    : getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
  if (!client) throw new Error("Chưa kết nối được hệ thống. Vui lòng thử lại.");
  const { data, error } = await client.rpc(name, payload);
  if (error) throw new Error(error.message || "Chưa xử lý được bill. Vui lòng thử lại.");
  return data;
}

export default {
  read: (token) => rpc("get_receipt_loyalty", { p_token: token }),
  claim: (token, phone) => rpc("claim_receipt_loyalty", { p_token: token, p_phone: phone }, { write: true }),
  link: (source, id) => rpc("get_receipt_loyalty_link", { p_source: source, p_id: id }, { write: true, staff: true }),
  summary: (phone) => rpc("get_receipt_point_summary", { p_phone: phone })
};
