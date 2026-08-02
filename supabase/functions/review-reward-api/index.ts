import { createClient } from "npm:@supabase/supabase-js@2";

type Row = Record<string, any>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const jsonHeaders = { ...cors, "Content-Type": "application/json; charset=utf-8" };
const BUCKET = "review-reward-proofs";
const ORDER_SOURCES = new Set(["grabfood", "shopeefood", "xanhngon"]);
const text = (value: unknown = "") => String(value ?? "").trim();
const reply = (body: Row, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const phoneKey = (value: unknown) => {
  let digits = text(value).replace(/\D/g, "");
  if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
  return digits;
};
const platformSettings = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : { grabfood: true, shopeefood: true, xanhngon: true, googlemaps: true };
const boundedRewardPoints = (value: unknown, fallback = 5000) =>
  Math.min(100000, Math.max(1, Number(value) || fallback));
const rewardPointsForSource = (settings: Row, source: unknown) =>
  text(source).toLowerCase() === "googlemaps"
    ? boundedRewardPoints(settings.google_reward_points, boundedRewardPoints(settings.reward_points))
    : boundedRewardPoints(settings.reward_points);

async function getIdentity(request: Request, client: ReturnType<typeof createClient>) {
  const token = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await client.auth.getUser(token);
  const userId = text(data?.user?.id);
  if (!userId) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("id,auth_user_id,phone,name,role,status,branch_uuid")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile || text(profile.status || "active").toLowerCase() !== "active") return null;
  return profile as Row;
}

async function getSettings(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from("review_reward_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return data as Row;
}

function isCompletedOrder(order: Row) {
  return text(order.order_status).toLowerCase() === "completed"
    || text(order.nexpos_status).toUpperCase() === "FINISH"
    || text(order.kitchen_status).toLowerCase() === "served";
}

function publicOrder(order: Row, claim: Row | null = null, cutoff = 0) {
  const orderTime = Date.parse(order.order_time || order.created_at);
  const expired = !claim && (!Number.isFinite(orderTime) || orderTime < cutoff);
  return {
    id: order.id,
    order_code: text(order.display_order_code || order.order_code),
    partner_source: text(order.partner_source),
    branch_name: text(order.branch_name || order.nexpos_hub_name),
    total_amount: Number(order.total_amount || 0),
    order_time: order.order_time || order.created_at,
    locked: Boolean(claim) || expired,
    expired,
    reward_status: claim ? "submitted" : expired ? "expired" : "eligible",
    claim_status: claim?.status || null
  };
}

async function customerDashboard(client: ReturnType<typeof createClient>, identity: Row) {
  const settings = await getSettings(client);
  const key = phoneKey(identity.phone);
  if (!key) {
    return reply({
      ok: false,
      code: "PHONE_REQUIRED",
      message: "Tài khoản chưa có số điện thoại hợp lệ."
    }, 400);
  }
  const cutoff = Date.now() - Number(settings.claim_window_hours || 48) * 3600000;
  const { data: orders, error } = await client
    .from("partner_orders")
    .select("id,display_order_code,order_code,partner_source,branch_name,nexpos_hub_name,total_amount,order_time,created_at,order_status,nexpos_status,kitchen_status")
    .eq("customer_phone_key", key)
    .order("order_time", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[review-reward-api] partner orders query", error);
    return reply({
      ok: false,
      code: "PARTNER_ORDERS_QUERY_FAILED",
      message: "Chưa tải được đơn đối tác. Vui lòng thử lại."
    }, 500);
  }
  const [{ data: claims, error: claimsError }, { data: branches, error: branchesError }] = await Promise.all([
    client
      .from("review_reward_claims")
      .select("id,partner_order_id,partner_source,branch_uuid,order_code,status,reward_points,submitted_at,reviewed_at,rejection_reason,resubmit_until,resubmission_count,metadata")
      .eq("auth_user_id", identity.auth_user_id)
      .order("submitted_at", { ascending: false })
      .limit(50),
    client
      .from("branches")
      .select("branch_uuid,name,address,map_url,lat,lng,is_open,data")
      .not("branch_uuid", "is", null)
      .or("is_open.is.null,is_open.eq.true")
      .order("name", { ascending: true })
  ]);
  if (claimsError) {
    console.error("[review-reward-api] customer claims query", claimsError);
    return reply({
      ok: false,
      code: "REWARD_HISTORY_QUERY_FAILED",
      message: "Chưa tải được lịch sử chương trình. Vui lòng thử lại."
    }, 500);
  }
  if (branchesError) {
    console.error("[review-reward-api] branches query", branchesError);
    return reply({ ok: false, code: "BRANCHES_QUERY_FAILED", message: "Chưa tải được danh sách chi nhánh." }, 500);
  }
  const claimMap = new Map((claims || []).map((claim) => [claim.partner_order_id, claim]));
  const enabledPlatforms = platformSettings(settings.platforms);
  const eligible = (orders || [])
    .filter((order) => ORDER_SOURCES.has(text(order.partner_source)))
    .filter((order) => enabledPlatforms[text(order.partner_source)] !== false)
    .filter(isCompletedOrder)
    .map((order) => publicOrder(order, claimMap.get(order.id) || null, cutoff));
  return reply({
    ok: true,
    settings: {
      enabled: settings.enabled !== false,
      reward_points: boundedRewardPoints(settings.reward_points),
      google_reward_points: boundedRewardPoints(settings.google_reward_points, boundedRewardPoints(settings.reward_points)),
      claim_window_hours: Number(settings.claim_window_hours || 48),
      platforms: enabledPlatforms
    },
    orders: eligible,
    branches: (branches || []).map((branch) => ({
      id: branch.branch_uuid,
      name: text(branch.name),
      address: text(branch.address),
      map: text(branch.map_url),
      googleReviewUrl: text(branch.data?.googleReviewUrl || branch.data?.google_review_url),
      lat: branch.lat,
      lng: branch.lng,
      locked: (claims || []).some((claim) =>
        text(claim.partner_source) === "googlemaps" && text(claim.branch_uuid) === text(branch.branch_uuid)
      )
    })),
    claims: (claims || []).map((claim) => ({
      ...claim,
      can_resubmit: claim.status === "rejected"
        && Boolean(claim.resubmit_until)
        && Date.parse(claim.resubmit_until) >= Date.now()
    }))
  });
}

async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function submitClaim(client: ReturnType<typeof createClient>, identity: Row, body: Row) {
  const settings = await getSettings(client);
  if (settings.enabled === false) return reply({ ok: false, message: "Chương trình hiện đang tạm dừng." }, 400);
  const orderId = text(body.partner_order_id);
  const requestedSource = text(body.partner_source).toLowerCase();
  const branchId = text(body.branch_uuid);
  const match = text(body.proof_data_url).match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
  const isGoogleMaps = requestedSource === "googlemaps";
  if ((!isGoogleMaps && !orderId) || (isGoogleMaps && !branchId) || !match) {
    return reply({ ok: false, message: "Vui lòng chọn nguồn, đơn hoặc chi nhánh và tải ảnh đánh giá." }, 400);
  }
  const contentType = match[1];
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  if (!bytes.length || bytes.length > 1048576) {
    return reply({ ok: false, message: "Ảnh sau khi nén phải nhỏ hơn 1 MB." }, 400);
  }
  const rejectedClaimId = text(body.claim_id);
  if (rejectedClaimId) {
    return resubmitRejectedClaim(client, identity, body, rejectedClaimId, bytes, contentType);
  }
  const key = phoneKey(identity.phone);
  if (isGoogleMaps) {
    if (platformSettings(settings.platforms).googlemaps === false) {
      return reply({ ok: false, message: "Google Maps chưa được bật nhận thưởng." }, 400);
    }
    const { data: branch } = await client
      .from("branches")
      .select("branch_uuid,name,address,map_url,lat,lng,is_open,data")
      .eq("branch_uuid", branchId)
      .or("is_open.is.null,is_open.eq.true")
      .maybeSingle();
    if (!branch) return reply({ ok: false, message: "Chi nhánh đã chọn không hợp lệ." }, 400);
    const { data: existing } = await client
      .from("review_reward_claims")
      .select("id")
      .eq("auth_user_id", identity.auth_user_id)
      .eq("partner_source", "googlemaps")
      .eq("branch_uuid", branch.branch_uuid)
      .maybeSingle();
    if (existing) return reply({ ok: false, message: "Chi nhánh này đã được gửi yêu cầu thưởng Google Maps." }, 409);
    return createClaim(client, identity, settings, bytes, contentType, {
      partner_order_id: null,
      partner_source: "googlemaps",
      branch_uuid: branch.branch_uuid,
      order_code: null,
      metadata: {
        original_name: text(body.original_name).slice(0, 160),
        branch_name: text(branch.name),
        branch_address: text(branch.address)
      }
    });
  }
  const { data: order } = await client
    .from("partner_orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_phone_key", key)
    .maybeSingle();
  if (!order || !isCompletedOrder(order as Row)) {
    return reply({ ok: false, message: "Đơn không hợp lệ hoặc chưa hoàn tất." }, 400);
  }
  const source = text(order.partner_source);
  if (!ORDER_SOURCES.has(source) || platformSettings(settings.platforms)[source] === false) {
    return reply({ ok: false, message: "Nền tảng này chưa được bật nhận thưởng." }, 400);
  }
  const orderTime = Date.parse(order.order_time || order.created_at);
  const cutoff = Date.now() - Number(settings.claim_window_hours || 48) * 3600000;
  if (!Number.isFinite(orderTime) || orderTime < cutoff) {
    return reply({ ok: false, message: "Đơn đã quá thời hạn gửi đánh giá." }, 400);
  }
  const { data: existing } = await client
    .from("review_reward_claims")
    .select("id")
    .eq("partner_order_id", orderId)
    .maybeSingle();
  if (existing) return reply({ ok: false, message: "Đơn này đã gửi ảnh đánh giá trước đó." }, 409);

  return createClaim(client, identity, settings, bytes, contentType, {
    partner_order_id: order.id,
    partner_source: source,
    branch_uuid: order.branch_uuid || null,
    order_code: text(order.display_order_code || order.order_code),
    metadata: { original_name: text(body.original_name).slice(0, 160) }
  });
}

async function resubmitRejectedClaim(
  client: ReturnType<typeof createClient>,
  identity: Row,
  body: Row,
  claimId: string,
  bytes: Uint8Array,
  contentType: string
) {
  const { data: claim } = await client
    .from("review_reward_claims")
    .select("*")
    .eq("id", claimId)
    .eq("auth_user_id", identity.auth_user_id)
    .eq("status", "rejected")
    .maybeSingle();
  if (!claim) return reply({ ok: false, message: "Yêu cầu này không còn ở trạng thái cần bổ sung." }, 409);
  if (!claim.resubmit_until || Date.parse(claim.resubmit_until) < Date.now()) {
    return reply({ ok: false, message: "Đã quá 24 giờ để gửi lại ảnh. Vui lòng liên hệ Gánh để được hỗ trợ." }, 409);
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const newPath = `${identity.auth_user_id}/${claim.id}-${Date.now()}.${extension}`;
  const digest = await sha256Hex(bytes);
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(newPath, bytes, { contentType, upsert: false });
  if (uploadError) return reply({ ok: false, message: "Không lưu được ảnh đánh giá mới." }, 500);

  const previousHistory = Array.isArray(claim.metadata?.rejection_history)
    ? claim.metadata.rejection_history
    : [];
  const now = new Date().toISOString();
  const metadata = {
    ...(claim.metadata || {}),
    original_name: text(body.original_name).slice(0, 160),
    rejection_history: [
      ...previousHistory,
      {
        reason: text(claim.rejection_reason),
        rejected_at: claim.reviewed_at,
        resubmitted_at: now
      }
    ].slice(-10)
  };
  const { data: updated, error } = await client
    .from("review_reward_claims")
    .update({
      proof_path: newPath,
      proof_size_bytes: bytes.length,
      proof_sha256: digest,
      status: "pending",
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by: null,
      proof_delete_after: null,
      proof_deleted_at: null,
      resubmit_until: null,
      resubmission_count: Number(claim.resubmission_count || 0) + 1,
      submitted_at: now,
      updated_at: now,
      metadata
    })
    .eq("id", claim.id)
    .eq("auth_user_id", identity.auth_user_id)
    .eq("status", "rejected")
    .select("id,status,reward_points,submitted_at,resubmission_count")
    .maybeSingle();
  if (error || !updated) {
    await client.storage.from(BUCKET).remove([newPath]);
    const duplicate = text(error?.code) === "23505";
    return reply({
      ok: false,
      message: duplicate ? "Ảnh này đã được dùng trước đó. Vui lòng chọn ảnh khác." : "Chưa gửi lại được ảnh. Vui lòng thử lại."
    }, duplicate ? 409 : 500);
  }
  if (claim.proof_path && claim.proof_path !== newPath) {
    await client.storage.from(BUCKET).remove([claim.proof_path]);
  }
  return reply({ ok: true, message: "Đã gửi lại ảnh. Gánh sẽ kiểm tra sớm cho anh/chị.", claim: updated });
}

async function createClaim(
  client: ReturnType<typeof createClient>,
  identity: Row,
  settings: Row,
  bytes: Uint8Array,
  contentType: string,
  claimInput: Row
) {
  const id = crypto.randomUUID();
  const extension = contentType === "image/jpeg"
    ? "jpg"
    : contentType === "image/png"
      ? "png"
      : "webp";
  const path = `${identity.auth_user_id}/${id}.${extension}`;
  const digest = await sha256Hex(bytes);
  const { data: duplicateProof } = await client
    .from("review_reward_claims")
    .select("id,auth_user_id,partner_source,branch_uuid,order_code")
    .eq("proof_sha256", digest)
    .maybeSingle();
  if (duplicateProof) {
    return reply({
      ok: false,
      code: "PROOF_ALREADY_USED",
      message: duplicateProof.auth_user_id === identity.auth_user_id
        ? "Ảnh này đã được dùng ở một yêu cầu trước. Vui lòng chọn ảnh chụp mới của đúng chi nhánh hoặc đơn hàng."
        : "Ảnh này đã được dùng để nhận điểm. Vui lòng chọn ảnh khác."
    }, 409);
  }
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) return reply({ ok: false, message: "Không lưu được ảnh đánh giá." }, 500);
  const { data: claim, error } = await client
    .from("review_reward_claims")
    .insert({
      id,
      auth_user_id: identity.auth_user_id,
      customer_phone: phoneKey(identity.phone),
      ...claimInput,
      reward_points: rewardPointsForSource(settings, claimInput.partner_source),
      proof_path: path,
      proof_size_bytes: bytes.length,
      proof_sha256: digest
    })
    .select("id,status,reward_points,submitted_at")
    .maybeSingle();
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    const duplicate = text(error.code) === "23505";
    const errorText = `${text(error.message)} ${text(error.details)}`.toLowerCase();
    const duplicateMessage = errorText.includes("proof_sha256")
      ? "Ảnh này đã được dùng ở một yêu cầu trước. Vui lòng chọn ảnh chụp mới."
      : claimInput.partner_source === "googlemaps"
        ? "Chi nhánh này đã có yêu cầu nhận điểm Google Maps."
        : "Đơn hàng này đã có yêu cầu nhận điểm đánh giá.";
    return reply({
      ok: false,
      message: duplicate
        ? duplicateMessage
        : "Không tạo được yêu cầu nhận điểm."
    }, duplicate ? 409 : 500);
  }
  return reply({ ok: true, message: "Đã gửi ảnh. Quán sẽ kiểm tra và cộng điểm cho anh/chị.", claim });
}

async function requireAdmin(request: Request, client: ReturnType<typeof createClient>) {
  const identity = await getIdentity(request, client);
  return identity && text(identity.role).toLowerCase() === "admin" ? identity : null;
}

async function adminDashboard(client: ReturnType<typeof createClient>, admin: Row) {
  const settings = await getSettings(client);
  let query = client.from("review_reward_claims").select("*").order("submitted_at", { ascending: false }).limit(200);
  if (text(admin.branch_uuid)) query = query.eq("branch_uuid", admin.branch_uuid);
  const { data: claims, error } = await query;
  if (error) return reply({ ok: false, message: "Không tải được danh sách chờ duyệt." }, 500);

  const claimRows = claims || [];
  const orderIds = [...new Set(claimRows.map((claim) => text(claim.partner_order_id)).filter(Boolean))];
  const authUserIds = [...new Set(claimRows.map((claim) => text(claim.auth_user_id)).filter(Boolean))];
  const customerPhones = [...new Set(claimRows.map((claim) => phoneKey(claim.customer_phone)).filter(Boolean))];
  const [ordersResult, profilesResult, accountsResult] = await Promise.all([
    orderIds.length
      ? client.from("partner_orders")
        .select("id,display_order_code,order_code,partner_source,customer_name,customer_phone,branch_name,nexpos_hub_name,total_amount,order_time,created_at,order_status,nexpos_status")
        .in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    authUserIds.length
      ? client.from("profiles").select("auth_user_id,name,phone").in("auth_user_id", authUserIds)
      : Promise.resolve({ data: [], error: null }),
    customerPhones.length
      ? client.from("loyalty_accounts").select("customer_phone,total_points").in("customer_phone", customerPhones)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (ordersResult.error) console.error("[review-reward-api] admin partner orders query", ordersResult.error);
  if (profilesResult.error) console.error("[review-reward-api] admin profiles query", profilesResult.error);
  if (accountsResult.error) console.error("[review-reward-api] admin loyalty accounts query", accountsResult.error);

  const orderMap = new Map((ordersResult.data || []).map((order) => [text(order.id), order]));
  const profileMap = new Map((profilesResult.data || []).map((profile) => [text(profile.auth_user_id), profile]));
  const accountMap = new Map(
    (accountsResult.data || []).map((account) => [phoneKey(account.customer_phone), account])
  );
  const rows = await Promise.all(claimRows.map(async (claim) => {
    let proof_url = "";
    if (!claim.proof_deleted_at) {
      const { data } = await client.storage.from(BUCKET).createSignedUrl(claim.proof_path, 600);
      proof_url = data?.signedUrl || "";
    }
    const order = orderMap.get(text(claim.partner_order_id)) || null;
    const profile = profileMap.get(text(claim.auth_user_id)) || null;
    const loyaltyAccount = accountMap.get(phoneKey(claim.customer_phone)) || null;
    return {
      ...claim,
      proof_url,
      customer: profile
        ? { name: text(profile.name), phone: phoneKey(profile.phone) }
        : null,
      order: order
        ? {
          customer_name: text(order.customer_name),
          customer_phone: phoneKey(order.customer_phone),
          order_code: text(order.display_order_code || order.order_code),
          branch_name: text(order.branch_name || order.nexpos_hub_name),
          total_amount: Number(order.total_amount || 0),
          order_time: order.order_time || order.created_at,
          order_status: text(order.order_status || order.nexpos_status)
        }
        : null,
      current_points: Number(loyaltyAccount?.total_points || 0)
    };
  }));
  return reply({ ok: true, settings, claims: rows });
}

async function saveSettings(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const rewardPoints = boundedRewardPoints(body.reward_points);
  const googleRewardPoints = boundedRewardPoints(body.google_reward_points, rewardPoints);
  const windowHours = Math.min(168, Math.max(1, Number(body.claim_window_hours) || 48));
  const retentionDays = Math.min(3, Math.max(2, Number(body.proof_retention_days) || 3));
  const platforms = platformSettings(body.platforms);
  const { data, error } = await client.from("review_reward_settings").upsert({
    id: "default",
    enabled: body.enabled !== false,
    reward_points: rewardPoints,
    google_reward_points: googleRewardPoints,
    claim_window_hours: windowHours,
    proof_retention_days: retentionDays,
    platforms: {
      grabfood: platforms.grabfood !== false,
      shopeefood: platforms.shopeefood !== false,
      xanhngon: platforms.xanhngon !== false,
      googlemaps: platforms.googlemaps !== false
    },
    updated_by: admin.auth_user_id,
    updated_at: new Date().toISOString()
  }).select("*").maybeSingle();
  if (error) return reply({ ok: false, message: "Không lưu được cấu hình." }, 500);
  return reply({ ok: true, message: "Đã lưu cấu hình nhận điểm.", settings: data });
}

async function reviewClaim(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const id = text(body.claim_id);
  const decision = text(body.decision).toLowerCase();
  if (!id || !["approve", "reject"].includes(decision)) {
    return reply({ ok: false, message: "Thao tác duyệt không hợp lệ." }, 400);
  }
  const settings = await getSettings(client);
  if (decision === "reject") {
    const now = new Date();
    let rejectQuery = client.from("review_reward_claims").update({
      status: "rejected",
      rejection_reason: text(body.reason).slice(0, 500) || "Ảnh chưa thể hiện đánh giá 5 sao hợp lệ.",
      reviewed_at: now.toISOString(),
      reviewed_by: admin.auth_user_id,
      resubmit_until: new Date(now.getTime() + 24 * 3600000).toISOString(),
      proof_delete_after: new Date(now.getTime() + Number(settings.proof_retention_days) * 86400000).toISOString(),
      updated_at: now.toISOString()
    }).eq("id", id).eq("status", "pending");
    if (text(admin.branch_uuid)) rejectQuery = rejectQuery.eq("branch_uuid", admin.branch_uuid);
    const { data, error } = await rejectQuery.select("*").maybeSingle();
    if (error || !data) return reply({ ok: false, message: "Yêu cầu đã được xử lý trước đó." }, 409);
    return reply({ ok: true, message: "Đã từ chối yêu cầu." });
  }

  let approvalQuery = client.from("review_reward_claims").update({
    status: "processing",
    updated_at: new Date().toISOString()
  }).eq("id", id).eq("status", "pending");
  if (text(admin.branch_uuid)) approvalQuery = approvalQuery.eq("branch_uuid", admin.branch_uuid);
  const { data: claim } = await approvalQuery.select("*").maybeSingle();
  if (!claim) return reply({ ok: false, message: "Yêu cầu đã được xử lý trước đó." }, 409);
  const { data: approvalRows, error: loyaltyError } = await client.rpc("approve_review_reward_claim", {
    p_claim_id: claim.id,
    p_reviewer_auth_user_id: admin.auth_user_id
  });
  if (loyaltyError) {
    await client.from("review_reward_claims").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "processing");
    return reply({ ok: false, message: "Chưa cộng được điểm. Yêu cầu vẫn được giữ để duyệt lại." }, 500);
  }
  const approval = Array.isArray(approvalRows) ? approvalRows[0] : approvalRows;
  return reply({
    ok: true,
    message: approval?.message || `Đã duyệt và cộng ${claim.reward_points} điểm.`
  });
}

async function cleanup(client: ReturnType<typeof createClient>) {
  const { data } = await client.from("review_reward_claims")
    .select("id,proof_path")
    .is("proof_deleted_at", null)
    .lte("proof_delete_after", new Date().toISOString())
    .limit(100);
  const rows = data || [];
  if (!rows.length) return reply({ ok: true, deleted: 0 });
  const paths = rows.map((row) => row.proof_path).filter(Boolean);
  const { error } = await client.storage.from(BUCKET).remove(paths);
  if (error) return reply({ ok: false, message: "Chưa dọn được ảnh đã hết hạn." }, 500);
  await client.from("review_reward_claims")
    .update({ proof_deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", rows.map((row) => row.id));
  return reply({ ok: true, deleted: rows.length });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, message: "Method not allowed." }, 405);
  const client = createClient(
    text(Deno.env.get("SUPABASE_URL")),
    text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  try {
    const body = await request.json() as Row;
    const action = text(body.action);
    if (action === "cleanup") {
      const secret = text(Deno.env.get("PARTNER_REVIEW_AUTOMATION_SECRET"));
      if (secret && text(request.headers.get("x-automation-secret")) === secret) return cleanup(client);
      const admin = await requireAdmin(request, client);
      return admin ? cleanup(client) : reply({ ok: false, message: "Không có quyền." }, 403);
    }
    if (action === "customer_dashboard" || action === "submit_claim") {
      const identity = await getIdentity(request, client);
      if (!identity) {
        return reply({
          ok: false,
          code: "AUTH_REQUIRED",
          message: "Vui lòng đăng nhập tài khoản thành viên."
        }, 401);
      }
      return action === "customer_dashboard"
        ? customerDashboard(client, identity)
        : submitClaim(client, identity, body);
    }
    const admin = await requireAdmin(request, client);
    if (!admin) return reply({ ok: false, message: "Không có quyền quản trị." }, 403);
    if (action === "admin_dashboard") return adminDashboard(client, admin);
    if (action === "save_settings") return saveSettings(client, admin, body);
    if (action === "review_claim") return reviewClaim(client, admin, body);
    return reply({ ok: false, message: "Thao tác không hợp lệ." }, 400);
  } catch (error) {
    console.error("[review-reward-api]", error);
    return reply({ ok: false, message: "Hệ thống chưa xử lý được yêu cầu." }, 500);
  }
});
