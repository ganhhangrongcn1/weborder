import { getAttendanceClient } from "./attendanceAuthService.js";

export function validateRemoteState(state, actorId) {
  if (state?.version !== 1 || !Array.isArray(state.records) || !Array.isArray(state.requests) || !state.phones
    || state.records.some((row) => row.employeeId !== actorId) || state.requests.some((row) => row.employeeId !== actorId)) {
    throw new Error("Dữ liệu tài khoản không hợp lệ. Chưa ghi thay đổi.");
  }
  if (new TextEncoder().encode(JSON.stringify(state)).length > 1024 * 1024) throw new Error("Dữ liệu vượt dung lượng cho phép. Vui lòng chọn tệp nhỏ hơn.");
  return state;
}
export async function loadAttendance(actor) {
  if (!actor?.id) throw new Error("Vui lòng đăng nhập lại.");
  const { data, error } = await getAttendanceClient().from("attendance_preview_accounts")
    .select("state,revision").eq("user_id", actor.id).eq("is_active", true).maybeSingle();
  if (error || !data) throw new Error("Không tải được dữ liệu. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.");
  validateRemoteState(data.state, actor.id);
  return data;
}
export async function mutateAttendance(actor, reducer) {
  const current = await loadAttendance(actor);
  const state = validateRemoteState(reducer(current.state), actor.id);
  const { data, error } = await getAttendanceClient().from("attendance_preview_accounts")
    .update({ state, revision: current.revision + 1 }).eq("user_id", actor.id).eq("revision", current.revision)
    .select("state").maybeSingle();
  if (error) throw new Error("Chưa lưu được dữ liệu lên máy chủ. Vui lòng thử lại.");
  if (!data) throw new Error("Dữ liệu đã thay đổi ở thiết bị khác. Vui lòng tải lại trước khi thao tác.");
  return data.state;
}
