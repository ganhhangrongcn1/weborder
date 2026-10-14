import { getSupabaseAdminAuthClient, initSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";
import { recruitmentRequest } from "./repositories/recruitmentRepository.js";
import { shouldWriteDomainToSupabase } from "./repositories/writeThroughPolicy.js";

export async function adminRecruitmentRequest(action, payload = {}) {
  if (action === "admin_save_form" && !shouldWriteDomainToSupabase("recruitment")) throw new Error("Hệ thống đang ở chế độ chỉ đọc.");
  const client = getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
  if (!client) throw new Error("Chưa kết nối được hệ thống Admin.");
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error("Bạn đăng nhập lại Admin giúp Gánh nha.");
  return recruitmentRequest({ action, ...payload }, data.session.access_token);
}
