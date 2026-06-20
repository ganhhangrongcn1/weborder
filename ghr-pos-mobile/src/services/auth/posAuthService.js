import { supabase } from "../supabase/client";

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeProfile(profile = null) {
  if (!profile || typeof profile !== "object") return null;
  const metadata = profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {};
  return {
    ...profile,
    id: toText(profile.id),
    authUserId: toText(profile.auth_user_id || profile.authUserId),
    name: toText(profile.name),
    email: toText(profile.email).toLowerCase(),
    role: toText(profile.role).toLowerCase(),
    status: toText(profile.status).toLowerCase(),
    branchUuid: toText(profile.branch_uuid || profile.branchUuid || metadata.branch_uuid || metadata.branchUuid),
    branchName: toText(profile.branch_name || profile.branchName || metadata.branch_name || metadata.branchName),
    branchAlias: toText(profile.branch_alias || profile.branchAlias || metadata.branch_alias || metadata.branchAlias),
    metadata
  };
}

async function readProfileBySession(session) {
  if (!supabase || !session?.user?.id) return null;
  const authUserId = toText(session.user.id);
  const email = toText(session.user.email).toLowerCase();

  let query = await supabase
    .from("profiles")
    .select("id,auth_user_id,name,email,role,status,branch_uuid,branch_name,branch_alias,metadata")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!query.error && query.data) {
    return normalizeProfile(query.data);
  }

  query = await supabase
    .from("profiles")
    .select("id,auth_user_id,name,email,role,status,branch_uuid,branch_name,branch_alias,metadata")
    .ilike("email", email)
    .maybeSingle();

  if (query.error) {
    throw query.error;
  }
  return normalizeProfile(query.data);
}

export async function signInPosOperator({ email, password }) {
  if (!supabase) {
    return { ok: false, message: "Thiếu cấu hình Supabase cho app mobile." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: toText(email),
    password: String(password || "")
  });
  if (error) {
    return { ok: false, message: error.message || "Đăng nhập thất bại." };
  }

  const profile = await readProfileBySession(data.session);
  if (!profile) {
    return { ok: false, message: "Tài khoản chưa có profile vận hành." };
  }
  if (!["admin", "staff", "kitchen"].includes(profile.role) || profile.status !== "active") {
    return { ok: false, message: "Tài khoản không có quyền POS hoặc chưa active." };
  }

  return {
    ok: true,
    session: data.session,
    profile
  };
}

export async function restorePosSession() {
  if (!supabase) {
    return { ok: false, message: "Thiếu cấu hình Supabase cho app mobile." };
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return { ok: false, session: null, profile: null, message: error?.message || "" };
  }
  const profile = await readProfileBySession(data.session);
  if (!profile) {
    return { ok: false, session: null, profile: null, message: "Không tìm thấy profile vận hành." };
  }
  return {
    ok: true,
    session: data.session,
    profile
  };
}

export async function signOutPosOperator() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
