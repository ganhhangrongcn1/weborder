import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient
} from "./supabase/supabaseRuntimeClient.js";

const FUNCTION_NAME = "partner-review-source-api";
const REQUEST_TIMEOUT_MS = 15000;
const toText = (value = "") => String(value || "").trim();
let adminClientPromise = null;

async function getAdminClient() {
  const existing = getSupabaseAdminAuthClient();
  if (existing) return existing;
  if (!adminClientPromise) {
    adminClientPromise = initSupabaseAdminAuthClient()
      .finally(() => {
        adminClientPromise = null;
      });
  }
  return adminClientPromise;
}

async function invoke(payload) {
  const client = await getAdminClient();
  if (!client?.functions?.invoke) return { ok: false, message: "Supabase Admin chưa sẵn sàng." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let { data: sessionData } = await client.auth.getSession();
    let accessToken = String(sessionData?.session?.access_token || "").trim();
    let validation = accessToken ? await client.auth.getUser(accessToken) : null;
    if (!accessToken || validation?.error || !validation?.data?.user) {
      const refreshed = await client.auth.refreshSession();
      sessionData = refreshed.data;
      accessToken = String(sessionData?.session?.access_token || "").trim();
      validation = accessToken ? await client.auth.getUser(accessToken) : null;
    }
    if (!accessToken || validation?.error || !validation?.data?.user) {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      return { ok: false, message: "Phiên admin đã hết hạn. Vui lòng đăng nhập lại." };
    }
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    });
    if (error) {
      let message = error.message || "Không gọi được dịch vụ nguồn đánh giá.";
      try {
        const body = await error.context?.json?.();
        message = body?.message || message;
      } catch {
        // Response body is best-effort.
      }
      return { ok: false, message };
    }
    return data?.ok ? data : { ok: false, message: data?.message || "Thao tác thất bại." };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      message: timedOut
        ? "Supabase phản hồi quá lâu. Vui lòng bấm Làm mới."
        : error?.message || "Không kết nối được dịch vụ đánh giá."
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function listPartnerReviewSources() {
  const result = await invoke({ action: "list" });
  return { ...result, sources: Array.isArray(result.sources) ? result.sources : [] };
}

export async function listPartnerReviews(filters = {}) {
  const result = await invoke({
    action: "list_reviews",
    source_id: toText(filters.sourceId),
    branch_uuid: toText(filters.branchUuid),
    platform: toText(filters.platform),
    rating: Number(filters.rating) || 0,
    limit: Number(filters.limit) || 100
  });
  return { ...result, reviews: Array.isArray(result.reviews) ? result.reviews : [] };
}

export async function savePartnerReviewSource(source = {}) {
  return invoke({
    action: "save",
    id: toText(source.id),
    platform: toText(source.platform),
    account_key: toText(source.accountKey),
    display_name: toText(source.displayName),
    merchant_id: toText(source.merchantId),
    branch_uuid: toText(source.branchUuid),
    branch_code: toText(source.branchCode),
    username: String(source.username || ""),
    password: String(source.password || ""),
    browser_profile_name: toText(source.browserProfileName),
    sync_enabled: source.syncEnabled !== false,
    auto_reply_enabled: false
  });
}

export default { listPartnerReviewSources, listPartnerReviews, savePartnerReviewSource };
