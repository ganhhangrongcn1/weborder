import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient
} from "./supabase/supabaseRuntimeClient.js";

const FUNCTION_NAME = "branch-account-api";

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeAccount(row = {}) {
  return {
    id: toText(row.id || row.profile_id),
    authUserId: toText(row.auth_user_id || row.authUserId),
    phone: toText(row.phone),
    name: toText(row.name),
    email: toText(row.email),
    role: toText(row.role),
    status: toText(row.status || "active"),
    branchUuid: toText(row.branch_uuid || row.branchUuid),
    branchName: toText(row.branch_name || row.branchName),
    createdAt: toText(row.created_at || row.createdAt),
    updatedAt: toText(row.updated_at || row.updatedAt)
  };
}

async function getClientReady() {
  const existing = getSupabaseAdminAuthClient();
  if (existing) return existing;
  const initialized = await initSupabaseAdminAuthClient();
  if (initialized) return initialized;
  return getSupabaseAdminAuthClient();
}

async function normalizeFunctionError(error, fallbackMessage = "Không gọi được dịch vụ tài khoản chi nhánh.") {
  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      const message = toText(body?.message);
      if (message) return message;
    }
  } catch {
    // The function response body is best-effort only.
  }
  const message = error?.message || "";
  if (message.toLowerCase().includes("failed to send a request")) {
    return "Chưa gọi được Edge Function tạo tài khoản. Vui lòng deploy branch-account-api trên Supabase rồi thử lại.";
  }
  return message || fallbackMessage;
}

async function invokeBranchAccountFunction(payload = {}) {
  const client = await getClientReady();
  if (!client?.functions?.invoke) {
    return {
      ok: false,
      message: "Supabase admin chưa sẵn sàng để quản lý tài khoản chi nhánh."
    };
  }

  try {
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
      body: payload
    });
    if (error) {
      return {
        ok: false,
        message: await normalizeFunctionError(error)
      };
    }
    if (!data?.ok) {
      return {
        ok: false,
        message: data?.message || "Thao tác tài khoản chi nhánh thất bại."
      };
    }
    return data;
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "Không kết nối được dịch vụ tài khoản chi nhánh."
    };
  }
}

export async function listBranchAccounts() {
  const result = await invokeBranchAccountFunction({ action: "list" });
  if (!result.ok) return result;
  return {
    ok: true,
    accounts: Array.isArray(result.accounts) ? result.accounts.map(normalizeAccount) : []
  };
}

export async function createBranchAccount({
  name = "",
  phone = "",
  email = "",
  password = "",
  role = "staff",
  branchUuid = "",
  status = "active"
} = {}) {
  const result = await invokeBranchAccountFunction({
    action: "create",
    name: toText(name),
    phone: toText(phone),
    email: toText(email),
    password: String(password || ""),
    role: toText(role),
    branch_uuid: toText(branchUuid),
    status: toText(status) || "active"
  });
  if (!result.ok) return result;
  return {
    ok: true,
    message: result.message || "Đã tạo tài khoản chi nhánh.",
    account: normalizeAccount(result.account || {})
  };
}

export default {
  listBranchAccounts,
  createBranchAccount
};
