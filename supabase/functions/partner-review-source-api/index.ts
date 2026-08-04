import { createClient } from "npm:@supabase/supabase-js@2";

type Row = Record<string, unknown>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const headers = { ...cors, "Content-Type": "application/json; charset=utf-8" };
const platforms = new Set(["grabfood", "shopeefood", "xanhngon", "other"]);
const text = (value: unknown = "") => String(value ?? "").trim();
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const reply = (body: Row, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const hasAutomationAccess = (request: Request) => {
  const expected = text(Deno.env.get("PARTNER_REVIEW_AUTOMATION_SECRET"));
  const provided = text(request.headers.get("x-automation-secret"));
  return Boolean(expected && provided && provided === expected);
};
const boundedIntervalMinutes = (value: unknown) =>
  Math.min(1440, Math.max(5, Math.round(Number(value) || 60)));
const AUTOMATION_LEASE_MS = 30 * 60 * 1000;

function hasActiveAutomationLease(source: Row, now = Date.now()) {
  const metadata = object(source.metadata);
  const expiresAt = Date.parse(text(metadata.local_worker_lease_expires_at));
  return Boolean(text(metadata.local_worker_lease_token) && Number.isFinite(expiresAt) && expiresAt > now);
}

function automationSource(row: Row) {
  const metadata = object(row.metadata);
  return {
    ...publicSource(row),
    lease_token: text(metadata.local_worker_lease_token)
  };
}

function releaseAutomationLease(metadataValue: unknown) {
  const metadata = { ...object(metadataValue) };
  delete metadata.local_worker_lease_token;
  delete metadata.local_worker_lease_owner;
  delete metadata.local_worker_lease_expires_at;
  return metadata;
}

function automationLeaseMatches(source: Row, body: Row) {
  const storedToken = text(object(source.metadata).local_worker_lease_token);
  const providedToken = text(body.lease_token);
  return !storedToken || Boolean(providedToken && providedToken === storedToken);
}

async function tryClaimAutomationSource(
  client: ReturnType<typeof createClient>,
  source: Row,
  workerId: string
) {
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  const metadata = {
    ...object(source.metadata),
    local_worker_last_attempt_at: now.toISOString(),
    local_worker_id: workerId,
    local_worker_lease_token: leaseToken,
    local_worker_lease_owner: workerId,
    local_worker_lease_expires_at: new Date(now.getTime() + AUTOMATION_LEASE_MS).toISOString()
  };
  let query = client
    .from("partner_review_sources")
    .update({
      sync_status: "running",
      metadata,
      updated_at: now.toISOString()
    })
    .eq("id", source.id);
  const previousUpdatedAt = text(source.updated_at);
  query = previousUpdatedAt ? query.eq("updated_at", previousUpdatedAt) : query.is("updated_at", null);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  return data ? automationSource(data as Row) : null;
}

async function getWorkerSettings(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from("partner_review_worker_settings")
    .select("sync_interval_minutes,last_worker_cycle_at,next_worker_cycle_at,last_worker_id,updated_at")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return {
    sync_interval_minutes: boundedIntervalMinutes(data?.sync_interval_minutes),
    last_worker_cycle_at: data?.last_worker_cycle_at || null,
    next_worker_cycle_at: data?.next_worker_cycle_at || null,
    last_worker_id: text(data?.last_worker_id),
    updated_at: data?.updated_at || null
  };
}

function publicSource(row: Row) {
  return {
    id: text(row.id),
    platform: text(row.platform),
    account_key: text(row.account_key),
    display_name: text(row.display_name),
    merchant_id: text(row.merchant_id),
    branch_uuid: text(row.branch_uuid),
    branch_code: text(row.branch_code),
    login_identifier_hint: text(row.login_identifier_hint),
    credentials_configured: Boolean(row.username_secret_id && row.password_secret_id),
    session_configured: Boolean(row.session_secret_id || row.access_token_secret_id),
    browser_profile_name: text(row.browser_profile_name),
    auth_status: text(row.auth_status || "not_configured"),
    sync_status: text(row.sync_status || "idle"),
    sync_enabled: row.sync_enabled !== false,
    busy_enabled: row.busy_enabled === true,
    store_control_action: text(row.store_control_action),
    store_control_status: text(row.store_control_status || "idle"),
    store_control_requested_at: row.store_control_requested_at || null,
    store_control_finished_at: row.store_control_finished_at || null,
    store_control_error: text(row.store_control_error),
    auto_reply_enabled: false,
    last_auth_at: row.last_auth_at || null,
    token_expires_at: row.token_expires_at || null,
    last_sync_at: row.last_sync_at || null,
    last_error: text(row.last_error),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

async function getAdmin(request: Request, serviceClient: ReturnType<typeof createClient>) {
  const token = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userData } = await serviceClient.auth.getUser(token);
  const userId = text(userData?.user?.id);
  if (!userId) return null;
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id,role,status,branch_uuid")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (
    !profile ||
    text(profile.role).toLowerCase() !== "admin" ||
    text(profile.status || "active").toLowerCase() !== "active"
  ) return null;
  return profile as Row;
}

async function storeSecret(
  client: ReturnType<typeof createClient>,
  value: string,
  name: string,
  description: string
) {
  const { data, error } = await client.rpc("partner_review_store_secret", {
    p_secret: value,
    p_name: name,
    p_description: description
  });
  if (error) throw error;
  return text(data);
}

async function readSecret(client: ReturnType<typeof createClient>, id: unknown) {
  if (!id) return "";
  const { data, error } = await client.rpc("partner_review_read_secret", {
    p_secret_id: id
  });
  if (error) throw error;
  return text(data);
}

async function listSources(client: ReturnType<typeof createClient>, admin: Row) {
  let query = client.from("partner_review_sources").select("*").order("created_at");
  if (text(admin.branch_uuid)) query = query.eq("branch_uuid", text(admin.branch_uuid));
  const { data, error } = await query;
  if (error) {
    console.error("[partner-review-source-api] list failed", error);
    return reply({ ok: false, message: "Không tải được danh sách nguồn đánh giá." }, 500);
  }
  try {
    const settings = await getWorkerSettings(client);
    return reply({ ok: true, sources: (data || []).map((row) => publicSource(row as Row)), settings });
  } catch (settingsError) {
    console.error("[partner-review-source-api] worker settings failed", settingsError);
    return reply({ ok: false, message: "Không tải được lịch đồng bộ đánh giá." }, 500);
  }
}

async function saveWorkerSettings(client: ReturnType<typeof createClient>, body: Row) {
  const syncIntervalMinutes = Math.round(Number(body.sync_interval_minutes));
  if (!Number.isInteger(syncIntervalMinutes) || syncIntervalMinutes < 5 || syncIntervalMinutes > 1440) {
    return reply({ ok: false, message: "Thời gian đồng bộ phải từ 5 phút đến 24 giờ." }, 400);
  }
  const updatedAt = new Date().toISOString();
  const { error } = await client.from("partner_review_worker_settings").upsert({
    id: "default",
    sync_interval_minutes: syncIntervalMinutes,
    updated_at: updatedAt
  }, { onConflict: "id" });
  if (error) {
    console.error("[partner-review-source-api] worker settings save failed", error);
    return reply({ ok: false, message: "Không lưu được lịch đồng bộ đánh giá." }, 500);
  }
  return reply({ ok: true, message: "Đã cập nhật thời gian đồng bộ.", settings: await getWorkerSettings(client) });
}

async function requestWorkerStart(client: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("partner_review_worker_settings")
    .update({ next_worker_cycle_at: now, updated_at: now })
    .eq("id", "default")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[partner-review-source-api] worker start request failed", error);
    return reply({ ok: false, message: "Không ghi được yêu cầu đồng bộ ngay." }, 500);
  }
  return reply({
    ok: true,
    message: "Đã ghi nhận yêu cầu. Máy đồng bộ đã cài worker sẽ nhận lệnh trong tối đa 1 phút.",
    request_accepted_at: now,
    settings: await getWorkerSettings(client)
  });
}

async function requestStoreControl(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const sourceId = text(body.source_id);
  const action = text(body.store_control_action).toLowerCase();
  if (!sourceId || !["busy", "normal"].includes(action)) {
    return reply({ ok: false, message: "Lệnh trạng thái cửa hàng không hợp lệ." }, 400);
  }
  const now = new Date().toISOString();
  let query = client
    .from("partner_review_sources")
    .update({
      store_control_action: action,
      store_control_status: "pending",
      store_control_requested_at: now,
      store_control_finished_at: null,
      store_control_error: null,
      ...(action === "normal" ? { busy_enabled: false } : {}),
      updated_at: now
    })
    .eq("id", sourceId)
    .eq("platform", "grabfood");
  if (text(admin.branch_uuid)) query = query.eq("branch_uuid", text(admin.branch_uuid));
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) {
    console.error("[partner-review-source-api] store control request failed", error);
    return reply({ ok: false, message: "Không gửi được lệnh tới cửa hàng Grab." }, 500);
  }
  return reply({
    ok: true,
    message: action === "busy" ? "Đã gửi lệnh Bận 15 phút." : "Đã gửi lệnh Mở bình thường.",
    source: publicSource(data as Row)
  });
}

async function listReviews(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 200);
  let query = client
    .from("partner_reviews")
    .select(`
      id,platform,external_review_id,source_id,branch_uuid,branch_code,rating,
      content,customer_display_name,external_order_id,booking_code,review_status,
      is_new,ordered_items,aspects,replies,image_urls,review_created_at,
      content_modified_at,created_at,
      source:partner_review_sources(id,display_name,account_key,platform)
    `)
    .order("review_created_at", { ascending: false })
    .limit(limit);

  const adminBranchUuid = text(admin.branch_uuid);
  const branchUuid = text(body.branch_uuid);
  const sourceId = text(body.source_id);
  const platform = text(body.platform).toLowerCase();
  const rating = Number(body.rating);

  if (adminBranchUuid) query = query.eq("branch_uuid", adminBranchUuid);
  else if (branchUuid) query = query.eq("branch_uuid", branchUuid);
  if (sourceId) query = query.eq("source_id", sourceId);
  if (platform && platforms.has(platform)) query = query.eq("platform", platform);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) query = query.eq("rating", rating);

  const { data, error } = await query;
  if (error) {
    console.error("[partner-review-source-api] review list failed", error);
    return reply({ ok: false, message: "Không tải được danh sách đánh giá." }, 500);
  }
  return reply({ ok: true, reviews: data || [] });
}

async function saveSource(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const id = text(body.id) || crypto.randomUUID();
  const platform = text(body.platform).toLowerCase();
  const accountKey = text(body.account_key);
  const displayName = text(body.display_name);
  const branchUuid = text(body.branch_uuid);
  if (!platforms.has(platform) || !accountKey || !displayName || !branchUuid) {
    return reply({ ok: false, message: "Vui lòng nhập đủ nền tảng, mã gian hàng, tên và chi nhánh." }, 400);
  }
  if (text(admin.branch_uuid) && text(admin.branch_uuid) !== branchUuid) {
    return reply({ ok: false, message: "Admin không có quyền quản lý chi nhánh đã chọn." }, 403);
  }

  const { data: existing } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  let usernameSecretId = text(existing?.username_secret_id);
  let passwordSecretId = text(existing?.password_secret_id);
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  try {
    if (username) {
      usernameSecretId = await storeSecret(
        client, username, `partner-review:${id}:username`, `${platform} username`
      );
    }
    if (password) {
      passwordSecretId = await storeSecret(
        client, password, `partner-review:${id}:password`, `${platform} password`
      );
    }
  } catch (error) {
    console.error("[partner-review-source-api] Vault write failed", error);
    return reply({ ok: false, message: "Không lưu được thông tin đăng nhập vào Supabase Vault." }, 500);
  }

  const loginHint = username
    ? username.includes("@")
      ? username.replace(/^(.{2}).*(@.*)$/, "$1***$2")
      : `***${username.slice(-4)}`
    : text(existing?.login_identifier_hint);

  const { data, error } = await client
    .from("partner_review_sources")
    .upsert({
      id,
      platform,
      account_key: accountKey,
      display_name: displayName,
      merchant_id: text(body.merchant_id) || null,
      branch_uuid: branchUuid,
      branch_code: text(body.branch_code),
      login_identifier_hint: loginHint,
      username_secret_id: usernameSecretId || null,
      password_secret_id: passwordSecretId || null,
      browser_profile_name: text(body.browser_profile_name),
      auth_status: usernameSecretId && passwordSecretId
        ? text(existing?.auth_status || "ready")
        : "not_configured",
      sync_enabled: body.sync_enabled !== false,
      busy_enabled: body.busy_enabled === true,
      auto_reply_enabled: false,
      updated_at: new Date().toISOString()
    }, { onConflict: "platform,account_key" })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    console.error("[partner-review-source-api] save failed", error);
    return reply({ ok: false, message: "Không lưu được nguồn đánh giá." }, 500);
  }
  return reply({ ok: true, message: "Đã lưu nguồn đánh giá.", source: publicSource(data as Row) });
}

async function getAutomationCredentials(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  const expected = text(Deno.env.get("PARTNER_REVIEW_AUTOMATION_SECRET"));
  const provided = text(request.headers.get("x-automation-secret"));
  if (!expected || !provided || provided !== expected) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const { data: source } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("id", text(body.source_id))
    .eq("sync_enabled", true)
    .maybeSingle();
  if (!source) return reply({ ok: false, message: "Không tìm thấy nguồn đồng bộ." }, 404);
  try {
    return reply({
      ok: true,
      source: publicSource(source as Row),
      credentials: {
        username: await readSecret(client, source.username_secret_id),
        password: await readSecret(client, source.password_secret_id),
        session: await readSecret(client, source.session_secret_id),
        access_token: await readSecret(client, source.access_token_secret_id)
      }
    });
  } catch (error) {
    console.error("[partner-review-source-api] Vault read failed", error);
    return reply({ ok: false, message: "Không đọc được bí mật đồng bộ." }, 500);
  }
}

async function getNextAutomationSource(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const { data, error } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("sync_enabled", true)
    .eq("platform", "grabfood");
  if (error) {
    console.error("[partner-review-source-api] next source failed", error);
    return reply({ ok: false, message: "Không chọn được gian hàng cần đồng bộ." }, 500);
  }
  const sources = ((data || []) as Row[]).filter((source) => !hasActiveAutomationLease(source));
  if (!sources.length) return reply({ ok: true, source: null });

  const attemptTime = (source: Row) => {
    const metadata = object(source.metadata);
    const value = text(metadata.local_worker_last_attempt_at)
      || text(source.last_sync_at)
      || text(source.created_at);
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  sources.sort((left, right) => attemptTime(left) - attemptTime(right));
  try {
    for (const source of sources) {
      const claimed = await tryClaimAutomationSource(client, source, text(body.worker_id));
      if (claimed) return reply({ ok: true, source: claimed });
    }
  } catch (updateError) {
    console.error("[partner-review-source-api] source claim failed", updateError);
    return reply({ ok: false, message: "Không nhận được lượt đồng bộ." }, 500);
  }
  return reply({ ok: true, source: null });
}

async function getAutomationSources(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const limit = Math.min(8, Math.max(1, Number(body.limit) || 4));
  const { data, error } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("sync_enabled", true)
    .eq("platform", "grabfood");
  if (error) {
    console.error("[partner-review-source-api] source batch failed", error);
    return reply({ ok: false, message: "Không chọn được các gian hàng cần đồng bộ." }, 500);
  }

  const attemptTime = (source: Row) => {
    const metadata = object(source.metadata);
    const value = text(metadata.local_worker_last_attempt_at)
      || text(source.last_sync_at)
      || text(source.created_at);
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const candidates = ((data || []) as Row[])
    .filter((source) => !hasActiveAutomationLease(source))
    .sort((left, right) => attemptTime(left) - attemptTime(right))
    .slice(0, Math.max(limit * 2, limit));
  const settings = await getWorkerSettings(client);
  if (!candidates.length) return reply({ ok: true, sources: [], settings });

  const workerId = text(body.worker_id);
  const claimed: Row[] = [];
  try {
    for (const source of candidates) {
      if (claimed.length >= limit) break;
      const result = await tryClaimAutomationSource(client, source, workerId);
      if (result) claimed.push(result);
    }
  } catch (updateError) {
    console.error("[partner-review-source-api] source batch claim failed", updateError);
    return reply({ ok: false, message: "Không nhận được nhóm đồng bộ." }, 500);
  }
  return reply({ ok: true, sources: claimed, settings });
}

async function getAutomationSettings(request: Request, client: ReturnType<typeof createClient>) {
  if (!hasAutomationAccess(request)) return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  return reply({ ok: true, settings: await getWorkerSettings(client) });
}

async function getAutomationBusyPermission(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const sourceId = text(body.source_id);
  if (!sourceId) return reply({ ok: false, message: "Thiếu nguồn đồng bộ." }, 400);
  const { data, error } = await client
    .from("partner_review_sources")
    .select("id,busy_enabled,sync_enabled")
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !data) return reply({ ok: false, message: "Không tìm thấy nguồn đồng bộ." }, 404);
  return reply({
    ok: true,
    source_id: sourceId,
    busy_enabled: data.sync_enabled === true && data.busy_enabled === true
  });
}

async function claimAutomationStoreCommands(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const limit = Math.min(5, Math.max(1, Number(body.limit) || 5));
  const { data, error } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("platform", "grabfood")
    .eq("store_control_status", "pending")
    .order("store_control_requested_at", { ascending: true })
    .limit(limit);
  if (error) return reply({ ok: false, message: "Không đọc được lệnh trạng thái cửa hàng." }, 500);
  const claimed: Row[] = [];
  for (const source of data || []) {
    const { data: row } = await client
      .from("partner_review_sources")
      .update({ store_control_status: "running", store_control_error: null })
      .eq("id", source.id)
      .eq("store_control_status", "pending")
      .select("*")
      .maybeSingle();
    if (row) claimed.push(row as Row);
  }
  return reply({ ok: true, sources: claimed.map(publicSource) });
}

async function finishAutomationStoreCommand(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const sourceId = text(body.source_id);
  const requestedAt = text(body.store_control_requested_at);
  const succeeded = body.succeeded === true;
  if (!sourceId || !requestedAt) return reply({ ok: false, message: "Thiếu định danh lệnh." }, 400);
  const result = object(body.result);
  const errorMessage = text(body.error).slice(0, 500);
  const { data: source } = await client
    .from("partner_review_sources")
    .select("metadata")
    .eq("id", sourceId)
    .maybeSingle();
  const { error } = await client
    .from("partner_review_sources")
    .update({
      store_control_status: succeeded ? "success" : "error",
      store_control_finished_at: new Date().toISOString(),
      store_control_error: succeeded ? null : errorMessage || "Grab không nhận lệnh.",
      metadata: {
        ...object(source?.metadata),
        last_store_control_result: result
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", sourceId)
    .eq("store_control_requested_at", requestedAt);
  if (error) return reply({ ok: false, message: "Không ghi được kết quả lệnh cửa hàng." }, 500);
  return reply({ ok: true });
}

async function saveAutomationHeartbeat(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  const now = new Date().toISOString();
  const nextRunAt = new Date(text(body.next_run_at));
  if (!Number.isFinite(nextRunAt.getTime())) return reply({ ok: false, message: "Thời gian chạy kế tiếp không hợp lệ." }, 400);
  const heartbeatUpdate: Row = {
    next_worker_cycle_at: nextRunAt.toISOString(),
    last_worker_id: text(body.worker_id),
    updated_at: now
  };
  if (body.cycle_completed !== false) heartbeatUpdate.last_worker_cycle_at = now;
  const { error } = await client.from("partner_review_worker_settings").update(heartbeatUpdate).eq("id", "default");
  if (error) return reply({ ok: false, message: "Không ghi được lịch chạy worker." }, 500);
  return reply({ ok: true });
}

async function markAutomationFailure(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const sourceId = text(body.source_id);
  const { data: source } = await client
    .from("partner_review_sources")
    .select("id,metadata")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source) return reply({ ok: false, message: "Không tìm thấy nguồn đồng bộ." }, 404);
  if (!automationLeaseMatches(source as Row, body)) {
    return reply({ ok: false, message: "Lượt đồng bộ đã được worker khác tiếp nhận." }, 409);
  }

  const now = new Date().toISOString();
  const releasedMetadata = releaseAutomationLease(source.metadata);
  const update: Row = {
    sync_status: "failed",
    last_error: text(body.error_message).slice(0, 2000),
    metadata: {
      ...releasedMetadata,
      local_worker_last_attempt_at: now,
      local_worker_id: text(body.worker_id)
    },
    updated_at: now
  };
  if (body.auth_expired === true) update.auth_status = "expired";
  let updateQuery = client
    .from("partner_review_sources")
    .update(update)
    .eq("id", sourceId);
  const storedLeaseToken = text(object(source.metadata).local_worker_lease_token);
  if (storedLeaseToken) {
    updateQuery = updateQuery.contains("metadata", { local_worker_lease_token: storedLeaseToken });
  }
  const { data: updatedSource, error } = await updateQuery.select("id").maybeSingle();
  if (error || !updatedSource) {
    console.error("[partner-review-source-api] failure update failed", error);
    return reply({ ok: false, message: "Không ghi được trạng thái lỗi hoặc lượt đồng bộ đã đổi worker." }, 409);
  }
  return reply({ ok: true, source_id: sourceId });
}

async function saveAutomationSession(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  const expected = text(Deno.env.get("PARTNER_REVIEW_AUTOMATION_SECRET"));
  const provided = text(request.headers.get("x-automation-secret"));
  if (!expected || !provided || provided !== expected) {
    return reply({ ok: false, message: "Automation secret khong hop le." }, 403);
  }

  const sourceId = text(body.source_id);
  const session = object(body.session);
  if (!sourceId || !Object.keys(session).length) {
    return reply({ ok: false, message: "Thieu nguon hoac phien dang nhap." }, 400);
  }

  const { data: source } = await client
    .from("partner_review_sources")
    .select("id,platform")
    .eq("id", sourceId)
    .eq("sync_enabled", true)
    .maybeSingle();
  if (!source) return reply({ ok: false, message: "Khong tim thay nguon dong bo." }, 404);
  if (!automationLeaseMatches(source as Row, body)) {
    return reply({ ok: false, message: "Luot dong bo da duoc worker khac tiep nhan." }, 409);
  }

  try {
    const sessionSecretId = await storeSecret(
      client,
      JSON.stringify(session),
      `partner-review:${sourceId}:session`,
      `${text(source.platform)} browser session`
    );
    const accessToken = text(body.access_token);
    const accessTokenSecretId = accessToken
      ? await storeSecret(
        client,
        accessToken,
        `partner-review:${sourceId}:access-token`,
        `${text(source.platform)} access token`
      )
      : null;
    const now = new Date().toISOString();
    const update: Row = {
      session_secret_id: sessionSecretId,
      auth_status: "ready",
      last_auth_at: now,
      last_error: null,
      updated_at: now
    };
    if (accessTokenSecretId) update.access_token_secret_id = accessTokenSecretId;
    if (text(body.token_expires_at)) update.token_expires_at = text(body.token_expires_at);

    const { error } = await client
      .from("partner_review_sources")
      .update(update)
      .eq("id", sourceId);
    if (error) throw error;
    return reply({ ok: true, source_id: sourceId, auth_status: "ready" });
  } catch (error) {
    console.error("[partner-review-source-api] session write failed", error);
    return reply({
      ok: false,
      message: "Khong luu duoc phien dang nhap.",
      detail: error instanceof Error ? error.message : JSON.stringify(error)
    }, 500);
  }
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function saveAutomationReviews(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  const expected = text(Deno.env.get("PARTNER_REVIEW_AUTOMATION_SECRET"));
  const provided = text(request.headers.get("x-automation-secret"));
  if (!expected || !provided || provided !== expected) {
    return reply({ ok: false, message: "Automation secret khong hop le." }, 403);
  }

  const sourceId = text(body.source_id);
  const reviews = arrayValue(body.reviews).map((review) => object(review));
  const overview = object(body.overview);
  const session = object(body.session);
  const busyResult = object(body.busy_result);
  if (!sourceId) return reply({ ok: false, message: "Thieu nguon dong bo." }, 400);

  const { data: source } = await client
    .from("partner_review_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("sync_enabled", true)
    .maybeSingle();
  if (!source) return reply({ ok: false, message: "Khong tim thay nguon dong bo." }, 404);
  if (!automationLeaseMatches(source as Row, body)) {
    return reply({ ok: false, message: "Luot dong bo da duoc worker khac tiep nhan." }, 409);
  }

  const startedAt = new Date().toISOString();
  const { data: run } = await client
    .from("partner_review_sync_runs")
    .insert({
      source_id: sourceId,
      platform: text(source.platform),
      status: "running",
      fetched_count: reviews.length,
      started_at: startedAt
    })
    .select("id")
    .maybeSingle();

  try {
    const rows = reviews
      .filter((review) => text(review.reviewID))
      .map((review) => ({
        platform: text(source.platform),
        external_review_id: text(review.reviewID),
        source_id: sourceId,
        branch_uuid: source.branch_uuid || null,
        branch_code: text(source.branch_code),
        rating: Number(review.rating) || null,
        content: text(review.description),
        customer_display_name: text(review.eaterName),
        external_order_id: text(review.orderID) || null,
        booking_code: text(review.bookingCode) || null,
        review_status: text(review.status),
        is_new: Boolean(review.isNew),
        ordered_items: arrayValue(review.orderedItems),
        aspects: arrayValue(review.reviewAspects),
        replies: arrayValue(review.reviewReplies),
        image_urls: arrayValue(review.paxReviewImageUrls),
        review_created_at: text(review.createdAt) || null,
        content_modified_at: text(review.contentLastModifiedAt) || null,
        raw_data: review,
        updated_at: new Date().toISOString()
      }));

    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await client
        .from("partner_reviews")
        .upsert(rows.slice(index, index + 500), {
          onConflict: "platform,external_review_id"
        });
      if (error) throw error;
    }

    let sessionSecretId = text(source.session_secret_id);
    if (Object.keys(session).length) {
      sessionSecretId = await storeSecret(
        client,
        JSON.stringify(session),
        `partner-review:${sourceId}:session`,
        `${text(source.platform)} browser session`
      );
    }

    const merchantId = text(body.merchant_id)
      || text(reviews.find((review) => text(review.merchantID))?.merchantID)
      || text(source.merchant_id);
    const finishedAt = new Date().toISOString();
    const releasedMetadata = releaseAutomationLease(source.metadata);
    let sourceUpdateQuery = client
      .from("partner_review_sources")
      .update({
        merchant_id: merchantId || null,
        session_secret_id: sessionSecretId || null,
        auth_status: "ready",
        sync_status: "success",
        last_auth_at: Object.keys(session).length ? finishedAt : source.last_auth_at,
        last_sync_at: finishedAt,
        last_error: null,
        metadata: {
          ...releasedMetadata,
          feedback_overview: overview,
          last_fetched_count: reviews.length,
          last_busy_result: busyResult,
          ...(busyResult.applied === true ? { last_busy_at: finishedAt } : {})
        },
        updated_at: finishedAt
      })
      .eq("id", sourceId);
    const storedLeaseToken = text(object(source.metadata).local_worker_lease_token);
    if (storedLeaseToken) {
      sourceUpdateQuery = sourceUpdateQuery.contains("metadata", { local_worker_lease_token: storedLeaseToken });
    }
    const { data: updatedSource, error: sourceError } = await sourceUpdateQuery.select("id").maybeSingle();
    if (sourceError || !updatedSource) {
      throw sourceError || new Error("Lượt đồng bộ đã được worker khác tiếp nhận.");
    }

    if (run?.id) {
      await client
        .from("partner_review_sync_runs")
        .update({
          status: "success",
          upserted_count: rows.length,
          finished_at: finishedAt
        })
        .eq("id", run.id);
    }
    return reply({
      ok: true,
      source_id: sourceId,
      fetched_count: reviews.length,
      upserted_count: rows.length,
      merchant_id: merchantId
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    const finishedAt = new Date().toISOString();
    const storedLeaseToken = text(object(source.metadata).local_worker_lease_token);
    let failureUpdateQuery = client
      .from("partner_review_sources")
      .update({
        sync_status: "failed",
        last_error: detail,
        metadata: {
          ...releaseAutomationLease(source.metadata),
          local_worker_last_attempt_at: finishedAt,
          local_worker_id: text(body.worker_id)
        },
        updated_at: finishedAt
      })
      .eq("id", sourceId);
    if (storedLeaseToken) {
      failureUpdateQuery = failureUpdateQuery.contains("metadata", { local_worker_lease_token: storedLeaseToken });
    }
    await failureUpdateQuery;
    if (run?.id) {
      await client
        .from("partner_review_sync_runs")
        .update({
          status: "failed",
          error_message: detail,
          finished_at: finishedAt
        })
        .eq("id", run.id);
    }
    return reply({ ok: false, message: "Khong luu duoc danh gia.", detail }, 500);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, message: "Method không được hỗ trợ." }, 405);

  const url = text(Deno.env.get("SUPABASE_URL"));
  const serviceKey = text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !serviceKey) return reply({ ok: false, message: "Thiếu cấu hình Supabase." }, 500);
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const body = object(await request.json().catch(() => ({})));
  const action = text(body.action).toLowerCase();
  if (action === "automation_next_source") {
    return getNextAutomationSource(request, client, body);
  }
  if (action === "automation_sources") {
    return getAutomationSources(request, client, body);
  }
  if (action === "automation_settings") {
    return getAutomationSettings(request, client);
  }
  if (action === "automation_busy_permission") {
    return getAutomationBusyPermission(request, client, body);
  }
  if (action === "automation_store_commands") {
    return claimAutomationStoreCommands(request, client, body);
  }
  if (action === "automation_store_command_result") {
    return finishAutomationStoreCommand(request, client, body);
  }
  if (action === "automation_heartbeat") {
    return saveAutomationHeartbeat(request, client, body);
  }
  if (action === "automation_credentials") {
    return getAutomationCredentials(request, client, body);
  }
  if (action === "automation_session") {
    return saveAutomationSession(request, client, body);
  }
  if (action === "automation_reviews") {
    return saveAutomationReviews(request, client, body);
  }
  if (action === "automation_failure") {
    return markAutomationFailure(request, client, body);
  }

  const admin = await getAdmin(request, client);
  if (!admin) return reply({ ok: false, message: "Chỉ admin mới được quản lý nguồn đánh giá." }, 403);
  if (action === "list") return listSources(client, admin);
  if (action === "list_reviews") return listReviews(client, admin, body);
  if (action === "save") return saveSource(client, admin, body);
  if (action === "save_worker_settings") return saveWorkerSettings(client, body);
  if (action === "request_worker_start") return requestWorkerStart(client);
  if (action === "store_control") return requestStoreControl(client, admin, body);
  return reply({ ok: false, message: "Action không được hỗ trợ." }, 400);
});
