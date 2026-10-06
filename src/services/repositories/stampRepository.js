import { getSupabaseCustomerAuthClient, initSupabaseCustomerAuthClient, getSupabaseAdminAuthClient, initSupabaseAdminAuthClient } from "../supabase/supabaseRuntimeClient.js";
import { isSupabaseRuntimeWriteEnabled } from "../supabase/runtimeFlags.js";
import { getSupabaseKitchenAuthClient, initSupabaseKitchenAuthClient } from "../supabase/supabaseRuntimeClient.js";

export async function getStampClient(admin = false, kitchen = false) {
  if (kitchen) return getSupabaseKitchenAuthClient() || await initSupabaseKitchenAuthClient();
  return admin
    ? getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient()
    : getSupabaseCustomerAuthClient() || await initSupabaseCustomerAuthClient();
}
export async function stampRpc(name, args, { admin = false, kitchen = false, write = false } = {}) {
  if (write && !isSupabaseRuntimeWriteEnabled()) throw new Error("Chưa bật ghi dữ liệu máy chủ.");
  const client = await getStampClient(admin, kitchen);
  if (!client) throw new Error("Chưa kết nối được chương trình tích tem.");
  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), write ? 15000 : 4000);
  let response;
  try { response = await client.rpc(name, args).abortSignal(controller.signal); }
  finally { clearTimeout(timeout); }
  const { data, error } = response;
  if (error) throw error;
  return data;
}
export default { getStampClient, stampRpc };
