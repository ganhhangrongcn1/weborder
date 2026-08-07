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

function normalizePhoneKey(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

function phoneCandidates(phoneKeys: string[]) {
  const values = new Set<string>();
  phoneKeys.forEach((phoneKey) => {
    const normalized = normalizePhoneKey(phoneKey);
    if (!normalized) return;
    values.add(normalized);
    if (/^0\d{9}$/.test(normalized)) {
      values.add(`84${normalized.slice(1)}`);
      values.add(`+84${normalized.slice(1)}`);
    }
  });
  return [...values];
}

function maskPhone(value: unknown) {
  const phone = normalizePhoneKey(value);
  if (phone.length < 7) return "";
  return `${phone.slice(0, 3)} *** ${phone.slice(-3)}`;
}

function reviewOrderKey(platform: unknown, externalOrderId: unknown) {
  return `${text(platform).toLowerCase()}::${text(externalOrderId)}`;
}

function partnerOrderPhoneKey(order: Row) {
  return normalizePhoneKey(
    order.customer_phone_key || order.customer_phone || order.claimed_customer_phone
  );
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function enrichReviews(
  client: ReturnType<typeof createClient>,
  admin: Row,
  reviewRows: Row[]
) {
  const externalOrderIds = [...new Set(
    reviewRows.map((review) => text(review.external_order_id)).filter(Boolean)
  )];
  if (!externalOrderIds.length) return reviewRows;

  let orderQuery = client
    .from("partner_orders")
    .select(`
      id,order_code,display_order_code,nexpos_order_id,partner_source,
      branch_uuid,branch_code,branch_name,customer_name,customer_phone,
      customer_phone_key,claimed_customer_phone,total_amount,order_status,
      kitchen_status,order_time,created_at
    `)
    .in("nexpos_order_id", externalOrderIds);
  if (text(admin.branch_uuid)) orderQuery = orderQuery.eq("branch_uuid", text(admin.branch_uuid));
  const { data: orderData, error: orderError } = await orderQuery;
  if (orderError) throw orderError;

  const matchedOrders = (orderData || []) as Row[];
  const orderByReviewKey = new Map<string, Row>();
  matchedOrders.forEach((order) => {
    const key = reviewOrderKey(order.partner_source, order.nexpos_order_id);
    const current = orderByReviewKey.get(key);
    if (!current || timestamp(order.order_time || order.created_at) > timestamp(current.order_time || current.created_at)) {
      orderByReviewKey.set(key, order);
    }
  });

  const matchedOrderIds = matchedOrders.map((order) => text(order.id)).filter(Boolean);
  let itemRows: Row[] = [];
  if (matchedOrderIds.length) {
    const { data, error } = await client
      .from("partner_order_items")
      .select(`
        id,partner_order_id,partner_item_name,web_product_name,quantity,
        unit_price,line_total,options,note,item_status,line_index
      `)
      .in("partner_order_id", matchedOrderIds)
      .order("line_index", { ascending: true });
    if (error) throw error;
    itemRows = (data || []) as Row[];
  }
  const itemsByOrderId = new Map<string, Row[]>();
  itemRows.forEach((item) => {
    const orderId = text(item.partner_order_id);
    const current = itemsByOrderId.get(orderId) || [];
    current.push(item);
    itemsByOrderId.set(orderId, current);
  });

  const phoneKeys = [...new Set(matchedOrders.map(partnerOrderPhoneKey).filter((phone) => phone.length >= 9))];
  const candidates = phoneCandidates(phoneKeys);
  const partnerHistoryById = new Map<string, Row>();
  let webHistory: Row[] = [];
  let profiles: Row[] = [];
  if (candidates.length) {
    const partnerHistorySelect = "id,customer_phone_key,customer_phone,claimed_customer_phone,total_amount,order_time,created_at";
    const [byKey, byPhone, byClaimed, webResult, profileResult] = await Promise.all([
      client.from("partner_orders").select(partnerHistorySelect).in("customer_phone_key", candidates),
      client.from("partner_orders").select(partnerHistorySelect).in("customer_phone", candidates),
      client.from("partner_orders").select(partnerHistorySelect).in("claimed_customer_phone", candidates),
      client.from("orders").select("id,customer_phone,total_amount,created_at").in("customer_phone", candidates),
      client.from("profiles").select("id,phone,name,total_orders,total_spent,member_rank,status").in("phone", candidates)
    ]);
    [byKey, byPhone, byClaimed].forEach((result) => {
      if (result.error) console.error("[partner-review-source-api] customer partner history failed", result.error);
      ((result.data || []) as Row[]).forEach((order) => partnerHistoryById.set(text(order.id), order));
    });
    if (webResult.error) console.error("[partner-review-source-api] customer web history failed", webResult.error);
    if (profileResult.error) console.error("[partner-review-source-api] customer profile lookup failed", profileResult.error);
    webHistory = (webResult.data || []) as Row[];
    profiles = (profileResult.data || []) as Row[];
  }

  const ordersByPhone = new Map<string, Row[]>();
  const addHistory = (order: Row, phoneValue: unknown) => {
    const phoneKey = normalizePhoneKey(phoneValue);
    if (phoneKey.length < 9) return;
    const current = ordersByPhone.get(phoneKey) || [];
    current.push(order);
    ordersByPhone.set(phoneKey, current);
  };
  [...partnerHistoryById.values()].forEach((order) => addHistory(order, partnerOrderPhoneKey(order)));
  webHistory.forEach((order) => addHistory(order, order.customer_phone));

  const profilesByPhone = new Map<string, Row>();
  profiles.forEach((profile) => {
    const phoneKey = normalizePhoneKey(profile.phone);
    if (phoneKey) profilesByPhone.set(phoneKey, profile);
  });

  const reviewsByPhone = new Map<string, Row[]>();
  reviewRows.forEach((review) => {
    const order = orderByReviewKey.get(reviewOrderKey(review.platform, review.external_order_id));
    const phoneKey = order ? partnerOrderPhoneKey(order) : "";
    if (!phoneKey) return;
    const current = reviewsByPhone.get(phoneKey) || [];
    current.push(review);
    reviewsByPhone.set(phoneKey, current);
  });

  return reviewRows.map((review) => {
    const order = orderByReviewKey.get(reviewOrderKey(review.platform, review.external_order_id));
    if (!order) return review;
    const phoneKey = partnerOrderPhoneKey(order);
    const customerOrders = ordersByPhone.get(phoneKey) || [];
    const customerReviews = reviewsByPhone.get(phoneKey) || [];
    const profile = profilesByPhone.get(phoneKey);
    const orderCount = new Set(customerOrders.map((item) => text(item.id))).size;
    const totalSpent = customerOrders.reduce((sum, item) => sum + numeric(item.total_amount), 0);
    const reviewCount = customerReviews.length;
    const averageRating = reviewCount
      ? customerReviews.reduce((sum, item) => sum + numeric(item.rating), 0) / reviewCount
      : 0;
    const lastOrder = [...customerOrders].sort(
      (left, right) => timestamp(right.order_time || right.created_at) - timestamp(left.order_time || left.created_at)
    )[0];
    return {
      ...review,
      linked_order: {
        id: text(order.id),
        order_code: text(order.display_order_code || order.order_code),
        nexpos_order_id: text(order.nexpos_order_id),
        partner_source: text(order.partner_source),
        branch_code: text(order.branch_code),
        branch_name: text(order.branch_name),
        customer_name: text(order.customer_name),
        customer_phone: phoneKey,
        customer_phone_masked: maskPhone(phoneKey),
        total_amount: numeric(order.total_amount),
        order_status: text(order.order_status),
        kitchen_status: text(order.kitchen_status),
        order_time: order.order_time || order.created_at || null,
        items: (itemsByOrderId.get(text(order.id)) || []).map((item) => ({
          id: text(item.id),
          name: text(item.web_product_name || item.partner_item_name) || "Món chưa có tên",
          quantity: numeric(item.quantity) || 1,
          unit_price: numeric(item.unit_price),
          line_total: numeric(item.line_total),
          options: item.options || [],
          note: text(item.note),
          status: text(item.item_status)
        }))
      },
      customer_insights: {
        profile_id: text(profile?.id),
        name: text(profile?.name || order.customer_name || review.customer_display_name),
        phone: phoneKey,
        phone_masked: maskPhone(phoneKey),
        member_rank: text(profile?.member_rank),
        order_count: Math.max(orderCount, numeric(profile?.total_orders)),
        total_spent: Math.max(totalSpent, numeric(profile?.total_spent)),
        review_count: reviewCount,
        average_rating: Math.round(averageRating * 10) / 10,
        low_rating_count: customerReviews.filter((item) => numeric(item.rating) <= 3).length,
        last_order_at: lastOrder?.order_time || lastOrder?.created_at || null
      }
    };
  });
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

async function attachLatestReplyCommands(client: ReturnType<typeof createClient>, reviews: Row[]) {
  const reviewIds = reviews.map((review) => text(review.id)).filter(Boolean);
  if (!reviewIds.length) return reviews;
  const { data, error } = await client
    .from("partner_review_reply_commands")
    .select("id,review_id,reply_text,status,attempt_count,error_message,created_at,claimed_at,finished_at")
    .in("review_id", reviewIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[partner-review-source-api] reply command list failed", error);
    return reviews;
  }
  const commandByReviewId = new Map<string, Row>();
  (data || []).forEach((command: Row) => {
    const reviewId = text(command.review_id);
    if (reviewId && !commandByReviewId.has(reviewId)) commandByReviewId.set(reviewId, command);
  });
  return reviews.map((review) => ({
    ...review,
    reply_command: commandByReviewId.get(text(review.id)) || null
  }));
}

async function requestReviewReply(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const reviewId = text(body.review_id);
  const replyText = text(body.reply_text);
  if (!reviewId || !replyText || replyText.length > 500) {
    return reply({ ok: false, message: "Nội dung trả lời phải từ 1 đến 500 ký tự." }, 400);
  }
  let reviewQuery = client
    .from("partner_reviews")
    .select(`
      id,platform,external_review_id,source_id,branch_uuid,review_status,replies,
      source:partner_review_sources(id,platform,merchant_id,sync_enabled)
    `)
    .eq("id", reviewId);
  if (text(admin.branch_uuid)) reviewQuery = reviewQuery.eq("branch_uuid", text(admin.branch_uuid));
  const { data: review, error: reviewError } = await reviewQuery.maybeSingle();
  if (reviewError || !review) {
    return reply({ ok: false, message: "Không tìm thấy đánh giá hoặc admin không có quyền với chi nhánh này." }, 404);
  }
  const source = object(review.source);
  if (text(review.platform) !== "grabfood" || text(source.platform) !== "grabfood") {
    return reply({ ok: false, message: "Hiện chỉ hỗ trợ trả lời đánh giá GrabFood." }, 400);
  }
  if (source.sync_enabled !== true || !text(source.merchant_id)) {
    return reply({ ok: false, message: "Gian hàng Grab chưa sẵn sàng để gửi trả lời." }, 409);
  }
  if (text(review.review_status).toUpperCase() === "REMOVED") {
    return reply({ ok: false, message: "Không thể trả lời đánh giá đã bị gỡ." }, 409);
  }
  if (reviewReplyValues(review.replies).length) {
    return reply({ ok: false, message: "Đánh giá này đã có phản hồi trên Grab." }, 409);
  }
  const { data: command, error } = await client
    .from("partner_review_reply_commands")
    .insert({
      review_id: reviewId,
      source_id: text(review.source_id),
      external_review_id: text(review.external_review_id),
      merchant_id: text(source.merchant_id),
      reply_text: replyText,
      requested_by: text(admin.id),
      status: "pending"
    })
    .select("id,review_id,reply_text,status,created_at")
    .single();
  if (error) {
    const duplicate = text(error.code) === "23505";
    return reply({
      ok: false,
      message: duplicate ? "Đánh giá này đã có lệnh trả lời đang xử lý." : "Không tạo được lệnh trả lời đánh giá."
    }, duplicate ? 409 : 500);
  }
  return reply({
    ok: true,
    message: "Đã xếp hàng gửi phản hồi tới Grab. Worker sẽ xử lý trong tối đa 1 phút.",
    command
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
  try {
    const reviews = await enrichReviews(client, admin, (data || []) as Row[]);
    return reply({ ok: true, reviews: await attachLatestReplyCommands(client, reviews) });
  } catch (enrichmentError) {
    console.error("[partner-review-source-api] review enrichment failed", enrichmentError);
    return reply({
      ok: true,
      reviews: await attachLatestReplyCommands(client, (data || []) as Row[]),
      enrichment_warning: true
    });
  }
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

async function claimAutomationReplyCommands(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const workerId = text(body.worker_id);
  const limit = Math.min(5, Math.max(1, Number(body.limit) || 5));
  if (!workerId) return reply({ ok: false, message: "Thiếu mã worker." }, 400);
  const { data, error } = await client
    .from("partner_review_reply_commands")
    .select("*,source:partner_review_sources(*)")
    .eq("status", "pending")
    .lt("attempt_count", 3)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return reply({ ok: false, message: "Không đọc được hàng đợi trả lời đánh giá." }, 500);
  const commands: Row[] = [];
  for (const candidate of data || []) {
    const now = new Date().toISOString();
    const { data: claimed } = await client
      .from("partner_review_reply_commands")
      .update({
        status: "processing",
        worker_id: workerId,
        attempt_count: Number(candidate.attempt_count || 0) + 1,
        claimed_at: now,
        error_message: null,
        updated_at: now
      })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (claimed) {
      commands.push({
        ...claimed,
        source: publicSource(object(candidate.source))
      });
    }
  }
  return reply({ ok: true, commands });
}

async function finishAutomationReplyCommand(
  request: Request,
  client: ReturnType<typeof createClient>,
  body: Row
) {
  if (!hasAutomationAccess(request)) {
    return reply({ ok: false, message: "Automation secret không hợp lệ." }, 403);
  }
  const commandId = text(body.command_id);
  const workerId = text(body.worker_id);
  const succeeded = body.succeeded === true;
  if (!commandId || !workerId) return reply({ ok: false, message: "Thiếu định danh lệnh trả lời." }, 400);
  const { data: command } = await client
    .from("partner_review_reply_commands")
    .select("id,review_id,external_review_id,reply_text,status,worker_id")
    .eq("id", commandId)
    .maybeSingle();
  if (!command || text(command.worker_id) !== workerId || text(command.status) !== "processing") {
    return reply({ ok: false, message: "Lệnh trả lời không còn thuộc worker này." }, 409);
  }
  const now = new Date().toISOString();
  const responseData = object(body.response_data);
  const errorMessage = text(body.error_message).slice(0, 1000);
  const { error } = await client
    .from("partner_review_reply_commands")
    .update({
      status: succeeded ? "succeeded" : "failed",
      finished_at: now,
      error_message: succeeded ? null : errorMessage || "Grab không nhận phản hồi.",
      response_data: responseData,
      updated_at: now
    })
    .eq("id", commandId)
    .eq("status", "processing")
    .eq("worker_id", workerId);
  if (error) return reply({ ok: false, message: "Không ghi được kết quả trả lời đánh giá." }, 500);
  if (succeeded) {
    await client
      .from("partner_reviews")
      .update({
        replies: [{
          reviewID: text(command.external_review_id),
          description: text(command.reply_text),
          submittedAt: now,
          source: "admin-worker"
        }],
        updated_at: now
      })
      .eq("id", command.review_id);
  }
  return reply({ ok: true, command_id: commandId, status: succeeded ? "succeeded" : "failed" });
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
    .select("id,platform,metadata")
    .eq("id", sourceId)
    .eq("sync_enabled", true)
    .maybeSingle();
  if (!source) return reply({ ok: false, message: "Khong tim thay nguon dong bo." }, 404);
  let authorized = automationLeaseMatches(source as Row, body);
  if (!authorized && text(body.reply_command_id) && text(body.worker_id)) {
    const { data: replyCommand } = await client
      .from("partner_review_reply_commands")
      .select("id")
      .eq("id", text(body.reply_command_id))
      .eq("source_id", sourceId)
      .eq("worker_id", text(body.worker_id))
      .eq("status", "processing")
      .maybeSingle();
    authorized = Boolean(replyCommand);
  }
  if (!authorized) {
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

function reviewReplyValues(value: unknown) {
  return arrayValue(value)
    .map((replyItem) => object(replyItem))
    .filter((replyItem) => text(replyItem.description));
}

async function planAutomationFinanceDetails(
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
  const candidates = arrayValue(body.transactions)
    .map((item) => object(item))
    .filter((item) => text(item.transaction_id))
    .slice(0, 1000);
  if (!sourceId) return reply({ ok: false, message: "Thieu nguon dong bo." }, 400);

  const existing = new Map<string, string>();
  const ids = candidates.map((item) => text(item.transaction_id));
  for (let index = 0; index < ids.length; index += 500) {
    const { data, error } = await client
      .from("partner_grab_finance_transactions")
      .select("transaction_id,transaction_updated_at")
      .eq("source_id", sourceId)
      .in("transaction_id", ids.slice(index, index + 500));
    if (error) throw error;
    (data || []).forEach((item: Row) => existing.set(text(item.transaction_id), text(item.transaction_updated_at)));
  }
  const requiredTransactionIds = candidates
    .filter((item) => {
      const stored = existing.get(text(item.transaction_id));
      if (!stored) return true;
      const incoming = text(item.updated_at);
      return incoming && Date.parse(incoming) !== Date.parse(stored);
    })
    .map((item) => text(item.transaction_id));
  return reply({
    ok: true,
    required_count: requiredTransactionIds.length,
    required_transaction_ids: requiredTransactionIds
  });
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
  const financeSnapshots = arrayValue(body.finance_snapshots).map((snapshot) => object(snapshot));
  const financeTransactions = arrayValue(body.finance_transactions).map((transaction) => object(transaction));
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
        replies: reviewReplyValues(review.reviewReplies),
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

    const financeRows = financeSnapshots
      .filter((snapshot) => /^\d{4}-\d{2}-\d{2}$/.test(text(snapshot.snapshot_date)))
      .map((snapshot) => ({
        source_id: sourceId,
        branch_uuid: source.branch_uuid || null,
        branch_code: text(source.branch_code) || null,
        snapshot_date: text(snapshot.snapshot_date),
        currency: text(snapshot.currency || "VND").toUpperCase().slice(0, 10),
        net_revenue_amount: Number.isFinite(Number(snapshot.net_revenue_amount)) ? Math.round(Number(snapshot.net_revenue_amount)) : null,
        net_income_amount: Math.round(Number(snapshot.net_income_amount)),
        raw_data: object(snapshot.raw_data),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
      .filter((snapshot) => Number.isSafeInteger(snapshot.net_income_amount));
    if (financeRows.length) {
      const { error: financeError } = await client
        .from("partner_grab_finance_snapshots")
        .upsert(financeRows, { onConflict: "source_id,snapshot_date" });
      if (financeError) throw financeError;
    }

    const financeTransactionRows = financeTransactions
      .filter((transaction) => text(transaction.transaction_id) && /^\d{4}-\d{2}-\d{2}$/.test(text(transaction.transaction_date)))
      .map((transaction) => ({
        source_id: sourceId,
        branch_uuid: source.branch_uuid || null,
        branch_code: text(source.branch_code) || null,
        transaction_id: text(transaction.transaction_id),
        store_id: text(transaction.store_id) || null,
        transaction_date: text(transaction.transaction_date),
        transaction_updated_at: text(transaction.transaction_updated_at) || null,
        transaction_category: text(transaction.transaction_category) || null,
        transaction_sub_category: text(transaction.transaction_sub_category) || null,
        transaction_status: text(transaction.transaction_status) || null,
        currency: text(transaction.currency || "VND").toUpperCase().slice(0, 10),
        net_total: Math.round(Number(transaction.net_total) || 0),
        net_sales: Math.round(Number(transaction.net_sales) || 0),
        order_value: Math.round(Number(transaction.order_value) || 0),
        merchant_discount: Math.round(Number(transaction.merchant_discount) || 0),
        delivery_discount: Math.round(Number(transaction.delivery_discount) || 0),
        voucher_amount: Math.round(Number(transaction.voucher_amount) || 0),
        offer_amount: Math.round(Number(transaction.offer_amount) || 0),
        advertising_amount: Math.round(Number(transaction.advertising_amount) || 0),
        advertising_tax: Math.round(Number(transaction.advertising_tax) || 0),
        service_fee: Math.round(Number(transaction.service_fee) || 0),
        channel_commission: Math.round(Number(transaction.channel_commission) || 0),
        delivery_commission: Math.round(Number(transaction.delivery_commission) || 0),
        commission_tax: Math.round(Number(transaction.commission_tax) || 0),
        vat_amount: Math.round(Number(transaction.vat_amount) || 0),
        withholding_tax: Math.round(Number(transaction.withholding_tax) || 0),
        merchant_charges: Math.round(Number(transaction.merchant_charges) || 0),
        raw_data: object(transaction.raw_data),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    for (let index = 0; index < financeTransactionRows.length; index += 500) {
      const { error: financeTransactionError } = await client
        .from("partner_grab_finance_transactions")
        .upsert(financeTransactionRows.slice(index, index + 500), { onConflict: "source_id,transaction_id" });
      if (financeTransactionError) throw financeTransactionError;
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
          last_finance_snapshot_count: financeRows.length,
          last_finance_transaction_count: financeTransactionRows.length,
          last_finance_detail_stats: object(body.finance_detail_stats),
          last_finance_error: text(body.finance_error) || null,
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
      merchant_id: merchantId,
      finance_snapshot_count: financeRows.length,
      finance_transaction_count: financeTransactionRows.length
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

async function getFinanceReport(client: ReturnType<typeof createClient>, admin: Row, body: Row) {
  const fromDate = text(body.from_date || body.fromDate);
  const toDate = text(body.to_date || body.toDate);
  const requestedBranchUuid = text(body.branch_uuid || body.branchUuid);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    return reply({ ok: false, message: "Khoảng ngày báo cáo Grab không hợp lệ." }, 400);
  }
  const adminBranchUuid = text(admin.branch_uuid);
  const branchUuid = adminBranchUuid || requestedBranchUuid;
  if (adminBranchUuid && requestedBranchUuid && adminBranchUuid !== requestedBranchUuid) {
    return reply({ ok: false, message: "Admin không có quyền xem chi nhánh đã chọn." }, 403);
  }

  let query = client
    .from("partner_grab_finance_snapshots")
    .select("source_id,branch_uuid,branch_code,snapshot_date,currency,net_revenue_amount,net_income_amount,last_synced_at,raw_data")
    .gte("snapshot_date", fromDate)
    .lte("snapshot_date", toDate)
    .order("snapshot_date", { ascending: true });
  if (branchUuid) query = query.eq("branch_uuid", branchUuid);
  const { data: snapshots, error } = await query;
  if (error) throw error;

  let transactionQuery = client
    .from("partner_grab_finance_transactions")
    .select("source_id,transaction_date,order_value,merchant_discount,delivery_discount,voucher_amount,offer_amount,advertising_amount,advertising_tax,service_fee,channel_commission,delivery_commission,commission_tax,vat_amount,withholding_tax,merchant_charges,last_synced_at")
    .gte("transaction_date", fromDate)
    .lte("transaction_date", toDate);
  if (branchUuid) transactionQuery = transactionQuery.eq("branch_uuid", branchUuid);
  const { data: transactions, error: transactionError } = await transactionQuery;
  if (transactionError) throw transactionError;

  const detailFields = [
    "orderValueAmount", "merchantDiscountAmount", "deliveryDiscountAmount", "voucherAmount", "offerAmount",
    "advertisingAmount", "advertisingTaxAmount", "serviceFeeAmount", "channelCommissionAmount",
    "deliveryCommissionAmount", "commissionTaxAmount", "vatAmount", "withholdingTaxAmount",
    "merchantChargesAmount", "detailedTransactionCount"
  ];
  const emptyDetails = () => Object.fromEntries(detailFields.map((field) => [field, 0]));
  const addTransactionDetails = (target: Row, transaction: Row) => {
    target.orderValueAmount = Number(target.orderValueAmount || 0) + Number(transaction.order_value || 0);
    target.merchantDiscountAmount = Number(target.merchantDiscountAmount || 0) + Number(transaction.merchant_discount || 0);
    target.deliveryDiscountAmount = Number(target.deliveryDiscountAmount || 0) + Number(transaction.delivery_discount || 0);
    target.voucherAmount = Number(target.voucherAmount || 0) + Number(transaction.voucher_amount || 0);
    target.offerAmount = Number(target.offerAmount || 0) + Number(transaction.offer_amount || 0);
    target.advertisingAmount = Number(target.advertisingAmount || 0) + Number(transaction.advertising_amount || 0);
    target.advertisingTaxAmount = Number(target.advertisingTaxAmount || 0) + Number(transaction.advertising_tax || 0);
    target.serviceFeeAmount = Number(target.serviceFeeAmount || 0) + Number(transaction.service_fee || 0);
    target.channelCommissionAmount = Number(target.channelCommissionAmount || 0) + Number(transaction.channel_commission || 0);
    target.deliveryCommissionAmount = Number(target.deliveryCommissionAmount || 0) + Number(transaction.delivery_commission || 0);
    target.commissionTaxAmount = Number(target.commissionTaxAmount || 0) + Number(transaction.commission_tax || 0);
    target.vatAmount = Number(target.vatAmount || 0) + Number(transaction.vat_amount || 0);
    target.withholdingTaxAmount = Number(target.withholdingTaxAmount || 0) + Number(transaction.withholding_tax || 0);
    target.merchantChargesAmount = Number(target.merchantChargesAmount || 0) + Number(transaction.merchant_charges || 0);
    target.detailedTransactionCount = Number(target.detailedTransactionCount || 0) + 1;
  };

  const sourceIds = [...new Set((snapshots || []).map((item: Row) => text(item.source_id)).filter(Boolean))];
  const sourcesResult = sourceIds.length
    ? await client.from("partner_review_sources").select("id,display_name,branch_uuid,branch_code").in("id", sourceIds)
    : { data: [] };
  const sourceById = new Map((sourcesResult.data || []).map((source: Row) => [text(source.id), source]));
  const accountMap = new Map<string, Row>();
  (snapshots || []).forEach((snapshot: Row) => {
    const sourceId = text(snapshot.source_id);
    const source = sourceById.get(sourceId) || {};
    const current = accountMap.get(sourceId) || {
      sourceId,
      displayName: text(source.display_name),
      branchUuid: text(snapshot.branch_uuid),
      branchCode: text(snapshot.branch_code),
      netRevenueAmount: 0,
      netIncomeAmount: 0,
      grossSalesAmount: 0,
      totalOrders: 0,
      totalPayments: 0,
      snapshotCount: 0,
      ...emptyDetails(),
      lastSyncedAt: null,
      dailyTotals: []
    };
    const summary = object(object(snapshot.raw_data).summary);
    const grossSalesAmount = Number(summary.gross_sales ?? summary.grossSales ?? 0);
    const totalOrders = Number(summary.total_orders ?? summary.totalOrders ?? 0);
    const totalPayments = Number(summary.total_payments ?? summary.totalPayments ?? 0);
    current.netRevenueAmount = Number(current.netRevenueAmount || 0) + Number(snapshot.net_revenue_amount || 0);
    current.netIncomeAmount = Number(current.netIncomeAmount || 0) + Number(snapshot.net_income_amount || 0);
    current.grossSalesAmount = Number(current.grossSalesAmount || 0) + grossSalesAmount;
    current.totalOrders = Number(current.totalOrders || 0) + totalOrders;
    current.totalPayments = Number(current.totalPayments || 0) + totalPayments;
    current.snapshotCount = Number(current.snapshotCount || 0) + 1;
    (current.dailyTotals as Row[]).push({
      date: text(snapshot.snapshot_date),
      grossSalesAmount,
      netRevenueAmount: Number(snapshot.net_revenue_amount || 0),
      netIncomeAmount: Number(snapshot.net_income_amount || 0),
      totalOrders,
      totalPayments
    });
    if (text(snapshot.last_synced_at) > text(current.lastSyncedAt)) current.lastSyncedAt = snapshot.last_synced_at;
    accountMap.set(sourceId, current);
  });
  (transactions || []).forEach((transaction: Row) => {
    const account = accountMap.get(text(transaction.source_id));
    if (!account) return;
    addTransactionDetails(account, transaction);
    const day = (account.dailyTotals as Row[]).find((item) => text(item.date) === text(transaction.transaction_date));
    if (day) addTransactionDetails(day, transaction);
    if (text(transaction.last_synced_at) > text(account.lastSyncedAt)) account.lastSyncedAt = transaction.last_synced_at;
  });
  const accounts = [...accountMap.values()].map((account) => ({
    ...account,
    dailyTotals: (account.dailyTotals as Row[]).sort((left, right) => text(right.date).localeCompare(text(left.date)))
  }));
  const dailyMap = new Map<string, Row>();
  (snapshots || []).forEach((snapshot: Row) => {
    const date = text(snapshot.snapshot_date);
    const summary = object(object(snapshot.raw_data).summary);
    const current = dailyMap.get(date) || { date, grossSalesAmount: 0, netIncomeAmount: 0, netRevenueAmount: 0, totalOrders: 0, totalPayments: 0, ...emptyDetails(), sourceIds: new Set<string>() };
    current.grossSalesAmount = Number(current.grossSalesAmount || 0) + Number(summary.gross_sales ?? summary.grossSales ?? 0);
    current.netIncomeAmount = Number(current.netIncomeAmount || 0) + Number(snapshot.net_income_amount || 0);
    current.netRevenueAmount = Number(current.netRevenueAmount || 0) + Number(snapshot.net_revenue_amount || 0);
    current.totalOrders = Number(current.totalOrders || 0) + Number(summary.total_orders ?? summary.totalOrders ?? 0);
    current.totalPayments = Number(current.totalPayments || 0) + Number(summary.total_payments ?? summary.totalPayments ?? 0);
    (current.sourceIds as Set<string>).add(text(snapshot.source_id));
    dailyMap.set(date, current);
  });
  (transactions || []).forEach((transaction: Row) => {
    const current = dailyMap.get(text(transaction.transaction_date));
    if (current) addTransactionDetails(current, transaction);
  });
  const dailyTotals = [...dailyMap.values()].map((item) => ({
    date: item.date,
    grossSalesAmount: item.grossSalesAmount,
    netIncomeAmount: item.netIncomeAmount,
    netRevenueAmount: item.netRevenueAmount,
    totalOrders: item.totalOrders,
      totalPayments: item.totalPayments,
      ...Object.fromEntries(detailFields.map((field) => [field, item[field] || 0])),
      accountCount: (item.sourceIds as Set<string>).size
  })).sort((left, right) => text(right.date).localeCompare(text(left.date)));
  return reply({
    ok: true,
    data: {
      fromDate,
      toDate,
      currency: "VND",
      netRevenueAmount: accounts.reduce((sum, account) => sum + Number(account.netRevenueAmount || 0), 0),
      netIncomeAmount: accounts.reduce((sum, account) => sum + Number(account.netIncomeAmount || 0), 0),
      grossSalesAmount: accounts.reduce((sum, account) => sum + Number(account.grossSalesAmount || 0), 0),
      totalOrders: accounts.reduce((sum, account) => sum + Number(account.totalOrders || 0), 0),
      totalPayments: accounts.reduce((sum, account) => sum + Number(account.totalPayments || 0), 0),
      ...Object.fromEntries(detailFields.map((field) => [field, accounts.reduce((sum, account) => sum + Number(account[field] || 0), 0)])),
      accountCount: accounts.length,
      snapshotCount: (snapshots || []).length,
      lastSyncedAt: (snapshots || []).reduce((latest: string, item: Row) => text(item.last_synced_at) > latest ? text(item.last_synced_at) : latest, "") || null,
      dailyTotals,
      accounts
    }
  });
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
  if (action === "automation_reply_commands") {
    return claimAutomationReplyCommands(request, client, body);
  }
  if (action === "automation_reply_command_result") {
    return finishAutomationReplyCommand(request, client, body);
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
  if (action === "automation_finance_detail_plan") {
    return planAutomationFinanceDetails(request, client, body);
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
  if (action === "finance_report") return getFinanceReport(client, admin, body);
  if (action === "list_reviews") return listReviews(client, admin, body);
  if (action === "reply_review") return requestReviewReply(client, admin, body);
  if (action === "save") return saveSource(client, admin, body);
  if (action === "save_worker_settings") return saveWorkerSettings(client, body);
  if (action === "request_worker_start") return requestWorkerStart(client);
  if (action === "store_control") return requestStoreControl(client, admin, body);
  return reply({ ok: false, message: "Action không được hỗ trợ." }, 400);
});
