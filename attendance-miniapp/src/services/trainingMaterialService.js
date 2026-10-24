import { getAttendanceClient } from "./attendanceAuthService.js";
export const TRAINING_MATERIALS = [
  { id: "guide", title: "Hướng dẫn chấm công", name: "huong-dan-cham-cong.pdf", type: "application/pdf" },
  { id: "video", title: "Video hướng dẫn chấm công", name: "huong-dan-cham-cong.mp4", type: "video/mp4" },
];
export async function loadTrainingMaterial(id, signal) {
  const material = TRAINING_MATERIALS.find((item) => item.id === id);
  if (!material) throw new Error("Không tìm thấy tài liệu.");
  const api = getAttendanceClient();
  const { data } = await api.auth.getSession();
  if (!data.session) throw new Error("Vui lòng đăng nhập lại để tải tài liệu.");
  const env = import.meta.env || {};
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/attendance-training-assets`, {
    method: "POST", signal: signal || AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error("Chưa tải được tài liệu. Vui lòng kiểm tra mạng hoặc đăng nhập lại.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error("Tệp tài liệu không hợp lệ.");
  return { ...material, blob: new Blob([blob], { type: material.type }) };
}
