import {
  getSupabaseAdminAuthClient,
  getSupabaseCustomerAuthClient,
  initSupabaseAdminAuthClient,
  initSupabaseCustomerAuthClient
} from "./supabase/supabaseRuntimeClient.js";

async function getFunctionErrorMessage(error, fallbackMessage) {
  let message = String(error?.message || fallbackMessage).trim();
  let code = "REQUEST_FAILED";
  try {
    const response = error?.context;
    const body = typeof response?.clone === "function"
      ? await response.clone().json()
      : await response?.json?.();
    message = String(body?.message || body?.error || message).trim();
    code = String(body?.code || code).trim();
  } catch {
    // The Edge response body is optional and may already have been consumed.
  }
  return { message: message || fallbackMessage, code };
}

export class ReviewRewardRequestError extends Error {
  constructor(message, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ReviewRewardRequestError";
    this.code = code;
  }
}

async function invoke(scope, action, payload = {}) {
  const client = scope === "admin"
    ? getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient()
    : getSupabaseCustomerAuthClient() || await initSupabaseCustomerAuthClient();
  if (!client) {
    throw new ReviewRewardRequestError(
      "Chưa kết nối được hệ thống. Vui lòng thử lại.",
      "CONNECTION_FAILED"
    );
  }
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
    throw new ReviewRewardRequestError(
      scope === "admin"
        ? "Phiên admin đã hết hạn. Vui lòng đăng nhập lại."
        : "Vui lòng đăng nhập tài khoản thành viên.",
      "AUTH_REQUIRED"
    );
  }
  const { data, error } = await client.functions.invoke("review-reward-api", {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (error) {
    const detail = await getFunctionErrorMessage(
      error,
      "Chưa tải được chương trình. Vui lòng thử lại."
    );
    throw new ReviewRewardRequestError(
      data?.message || detail.message,
      data?.code || detail.code
    );
  }
  if (!data?.ok) {
    throw new ReviewRewardRequestError(
      data?.message || "Chưa xử lý được yêu cầu. Vui lòng thử lại.",
      data?.code || "REQUEST_FAILED"
    );
  }
  return data;
}

export const getCustomerReviewRewards = () => invoke("customer", "customer_dashboard");

export const submitReviewReward = (payload) =>
  invoke("customer", "submit_claim", payload);

export const getAdminReviewRewards = () => invoke("admin", "admin_dashboard");

export const saveReviewRewardSettings = (settings) =>
  invoke("admin", "save_settings", settings);

export const reviewRewardClaim = (claimId, decision, reason = "") =>
  invoke("admin", "review_claim", {
    claim_id: claimId,
    decision,
    reason
  });
