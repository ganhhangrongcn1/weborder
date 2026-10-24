import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
let client;
const TEST_EMAIL = "attendance.test.20261023@example.invalid";
export function resolveLoginEmail(value) {
  const login = String(value || "").trim().toLowerCase();
  return login === "test" ? TEST_EMAIL : login;
}
export function getAttendanceClient() {
  if (!url || !key) throw new Error("Chưa cấu hình kết nối đăng nhập. Vui lòng liên hệ quản lý.");
  // Keep this app's session in memory, separate from the POS/admin web session.
  client ||= createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: true },
    global: { fetch: (input, options = {}) => fetch(input, { ...options, signal: options.signal || AbortSignal.timeout(15000) }) } });
  return client;
}
export function actorFromAccount(row, user) {
  if (!row || !row.is_active || row.user_id !== user?.id || row.role !== "employee") throw new Error("Tài khoản chưa được cấp quyền sử dụng ứng dụng.");
  return { id: user.id, username: user.email === TEST_EMAIL ? "test" : user.email, name: row.display_name, code: row.employee_code, role: row.role };
}
export async function loginAttendance(email, password) {
  const api = getAttendanceClient();
  const { data, error } = await api.auth.signInWithPassword({ email: resolveLoginEmail(email), password });
  if (error) throw new Error(error.status === 400 ? "Tài khoản hoặc mật khẩu chưa đúng." : "Chưa đăng nhập được. Vui lòng kiểm tra kết nối và thử lại.");
  try {
    const { data: row, error: accessError } = await api.from("attendance_preview_accounts")
      .select("user_id,display_name,employee_code,role,is_active").eq("user_id", data.user.id).maybeSingle();
    if (accessError) throw new Error("Chưa kiểm tra được quyền tài khoản. Vui lòng thử lại.");
    return actorFromAccount(row, data.user);
  } catch (failure) { await api.auth.signOut({ scope: "local" }); throw failure; }
}
export async function logoutAttendance() {
  const { error } = await getAttendanceClient().auth.signOut({ scope: "local" });
  if (error) throw new Error("Chưa đăng xuất được. Vui lòng thử lại.");
}
