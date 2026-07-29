import {
  getProfileByAuthUserId,
  getSession,
  signInWithPassword,
  signOut,
  subscribeAuth
} from "../repositories/authRepository.js";

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    name: String(profile.name || "Quản trị viên").trim(),
    role: String(profile.role || "").trim().toLowerCase(),
    status: String(profile.status || "").trim().toLowerCase()
  };
}

async function resolveAccess(session) {
  if (!session?.user?.id) return { session: null, profile: null };
  const profile = normalizeProfile(await getProfileByAuthUserId(session.user.id));
  const allowed = profile?.status === "active" && profile?.role === "admin";
  if (!allowed) throw new Error("admin_access_denied");
  return { session, profile };
}

export async function loadAdminAccess() {
  return resolveAccess(await getSession());
}

export async function loginAdmin(credentials) {
  return resolveAccess(await signInWithPassword(credentials));
}

export async function logoutAdmin() {
  await signOut();
}

export function subscribeAdminSession(callback) {
  return subscribeAuth(async (session) => {
    try {
      callback(await resolveAccess(session));
    } catch (error) {
      callback({ session: null, profile: null, error });
    }
  });
}

export function getAuthMessage(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("missing_supabase_config")) return "Chưa cấu hình kết nối Supabase cho ứng dụng checklist.";
  if (message.includes("invalid login credentials")) return "Email hoặc mật khẩu chưa đúng.";
  if (message.includes("admin_access_denied")) return "Tài khoản chưa có quyền admin đang hoạt động.";
  if (message.includes("failed to fetch")) return "Không thể kết nối Supabase. Vui lòng kiểm tra mạng.";
  return "Không thể xác minh tài khoản. Vui lòng thử lại.";
}
