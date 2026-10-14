import { getSupabaseEnvConfig } from "../supabase/runtimeFlags.js";

export async function postRecruitmentApplication(payload, requestId) {
  const { url, anonKey } = getSupabaseEnvConfig();
  if (!url || !anonKey) throw new Error("Gánh chưa kết nối được hệ thống nhận hồ sơ. Bạn thử lại sau nha.");
  let response;
  try {
    response = await fetch(`${url}/functions/v1/recruitment-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ action: "submit", requestId, application: payload }),
      signal: globalThis.AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error("Chưa xác nhận được hồ sơ đã lưu. Bạn bấm gửi lại giúp Gánh nha; nội dung vẫn được giữ ở đây.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok || !body?.applicationId) {
    const error = new Error(body?.message || "Chưa gửi được hồ sơ. Bạn thử lại sau nha.");
    error.fields = body?.fields;
    throw error;
  }
  return body;
}
