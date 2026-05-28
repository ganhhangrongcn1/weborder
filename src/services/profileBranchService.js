import { getRuntimeSupabaseClient } from "./repositories/repositoryRuntime.js";
import { initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { isSupabaseRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeRpcMessage(error, fallback = "Không thể cập nhật profile chi nhánh.") {
  const message = toText(error?.message || error);
  return message || fallback;
}

async function getClientReady() {
  const existing = getRuntimeSupabaseClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  return getRuntimeSupabaseClient();
}

function mapRpcResult(row = {}, fallbackMessage = "") {
  return {
    ok: Boolean(row?.ok),
    message: toText(row?.message) || fallbackMessage,
    profileId: toText(row?.profile_id),
    phone: toText(row?.phone),
    role: toText(row?.role),
    status: toText(row?.status),
    branchUuid: toText(row?.branch_uuid),
    branchName: toText(row?.branch_name)
  };
}

export async function assignOperationalProfileBranch({
  profileId,
  branchUuid = "",
  allowGlobalAdmin = false
}) {
  if (!isSupabaseRuntimeWriteEnabled()) {
    return { ok: false, message: "Supabase runtime write đang tắt." };
  }
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };

  try {
    const { data, error } = await client.rpc("assign_operational_profile_branch", {
      p_profile_id: toText(profileId) || null,
      p_branch_uuid: toText(branchUuid) || null,
      p_allow_global_admin: Boolean(allowGlobalAdmin)
    });
    if (error) return { ok: false, message: normalizeRpcMessage(error) };
    const row = Array.isArray(data) ? data[0] : data;
    return mapRpcResult(row, "Đã cập nhật chi nhánh profile.");
  } catch (error) {
    return { ok: false, message: normalizeRpcMessage(error) };
  }
}

export async function upsertOperationalProfile({
  phone,
  name = "",
  role,
  status = "active",
  branchUuid = "",
  email = "",
  authUserId = "",
  allowGlobalAdmin = false
}) {
  if (!isSupabaseRuntimeWriteEnabled()) {
    return { ok: false, message: "Supabase runtime write đang tắt." };
  }
  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chưa sẵn sàng." };

  try {
    const { data, error } = await client.rpc("upsert_operational_profile", {
      p_phone: toText(phone),
      p_name: toText(name),
      p_role: toText(role),
      p_status: toText(status) || "active",
      p_branch_uuid: toText(branchUuid) || null,
      p_email: toText(email) || null,
      p_auth_user_id: toText(authUserId) || null,
      p_allow_global_admin: Boolean(allowGlobalAdmin)
    });
    if (error) return { ok: false, message: normalizeRpcMessage(error, "Không thể lưu profile vận hành.") };
    const row = Array.isArray(data) ? data[0] : data;
    return mapRpcResult(row, "Đã lưu profile vận hành.");
  } catch (error) {
    return { ok: false, message: normalizeRpcMessage(error, "Không thể lưu profile vận hành.") };
  }
}
