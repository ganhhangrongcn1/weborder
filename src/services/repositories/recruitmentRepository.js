import { getSupabaseEnvConfig } from "../supabase/runtimeFlags.js";

export async function recruitmentRequest(body, token = "") {
  const { url, anonKey } = getSupabaseEnvConfig();
  if (!url || !anonKey) throw new Error("Gánh chưa kết nối được hệ thống nhận hồ sơ. Bạn thử lại sau nha.");
  let response;
  try {
    response = await fetch(`${url}/functions/v1/recruitment-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: globalThis.AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error("Chưa xác nhận được hồ sơ đã lưu. Bạn bấm gửi lại giúp Gánh nha; nội dung vẫn được giữ ở đây.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.message || "Chưa gửi được hồ sơ. Bạn thử lại sau nha.");
    error.fields = result?.fields;
    throw error;
  }
  return result;
}

export async function postRecruitmentApplication(payload, requestId, formVersion) {
  const result = await recruitmentRequest({ action: "submit", requestId, application: payload, formVersion });
  if (!result.applicationId) throw new Error("Chưa xác nhận được hồ sơ đã lưu. Bạn thử lại nha.");
  return result;
}
