import { getSupabaseAdminAuthClient, initSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

const FUNCTION_NAME = "checklist-supervisor-account-api";
const REQUEST_TIMEOUT_MS = 15000;

function timeoutResult() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: null, error: new Error("Dịch vụ phản hồi quá lâu. Vui lòng thử tải lại.") }), REQUEST_TIMEOUT_MS);
  });
}

async function invoke(payload) {
  const client = getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
  if (!client) return { ok: false, message: "Supabase Admin chưa sẵn sàng." };
  try {
    const { data, error } = await Promise.race([
      client.functions.invoke(FUNCTION_NAME, { body: payload }),
      timeoutResult()
    ]);
    if (error) {
      try { const body = await error.context?.json?.(); if (body?.message) return { ok: false, message: body.message }; } catch { /* best effort */ }
      return { ok: false, message: error.message || "Không gọi được dịch vụ tài khoản giám sát." };
    }
    return data?.ok ? data : { ok: false, message: data?.message || "Thao tác thất bại." };
  } catch (error) { return { ok: false, message: error.message || "Không kết nối được dịch vụ tài khoản giám sát." }; }
}

export function listSupervisorAccounts() { return invoke({ action: "list" }); }
export function createSupervisorAccount(form) { return invoke({ action: "create", name: form.name, phone: form.phone, email: form.email, password: form.password, branch_uuids: form.branchUuids }); }
export function updateSupervisorAccount(account) { return invoke({ action: "update", auth_user_id: account.auth_user_id, branch_uuids: account.branch_uuids, is_active: account.status === "active" }); }
