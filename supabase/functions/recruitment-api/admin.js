import { validateFormConfig } from "../_shared/recruitmentForm.js";

export async function readRecruitmentSettings(client) {
  const { data, error } = await client.from("recruitment_form_settings").select("config,revision").eq("id", "default").single();
  if (error || !data) throw new Error("Chưa tải được cấu hình tuyển dụng.");
  return { config: validateFormConfig(data.config), revision: data.revision };
}

export async function requireRecruitmentAdmin(request, client) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return false;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) return false;
  const profile = await client.from("profiles").select("role,status,branch_uuid").eq("auth_user_id", data.user.id).maybeSingle();
  return !profile.error && profile.data?.role === "admin" && !profile.data.branch_uuid
    && ["active", ""].includes(String(profile.data.status || "active").toLowerCase());
}

function dateBoundary(value, nextDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ngày lọc không hợp lệ.");
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime()) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Ngày lọc không hợp lệ.");
  return new Date(date.getTime() + (nextDay ? 86400000 : 0)).toISOString();
}

export async function handleRecruitmentAdmin(payload, client) {
  if (payload.action === "admin_form") return { ok: true, ...await readRecruitmentSettings(client) };
  if (payload.action === "admin_save_form") {
    const config = validateFormConfig(payload.config);
    const revision = Number(payload.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Phiên bản cấu hình không hợp lệ.");
    const { data, error } = await client.from("recruitment_form_settings")
      .update({ config, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq("id", "default").eq("revision", revision).select("config,revision").maybeSingle();
    if (error) throw new Error("Chưa lưu được cấu hình. Nội dung chỉnh sửa vẫn được giữ.");
    if (!data) throw new Error("Cấu hình đã được sửa ở phiên khác. Tải lại trước khi lưu.");
    return { ok: true, ...data };
  }
  if (payload.action === "admin_detail") {
    if (!/^[0-9a-f-]{36}$/i.test(payload.id || "")) throw new Error("Mã hồ sơ không hợp lệ.");
    const { data, error } = await client.from("recruitment_applications")
      .select("id,application,form_snapshot,form_version,submitted_at,notification_status,notification_attempts,notification_last_error")
      .eq("id", payload.id).maybeSingle();
    if (error || !data) throw new Error("Không tìm thấy hồ sơ.");
    return { ok: true, application: data };
  }
  if (payload.action !== "admin_dashboard") throw new Error("Thao tác không hợp lệ.");
  const branch = typeof payload.branch === "string" ? payload.branch : "";
  if (branch.length > 200) throw new Error("Chi nhánh không hợp lệ.");
  const from = dateBoundary(payload.from);
  const to = dateBoundary(payload.to, true);
  if (from && to && from >= to) throw new Error("Khoảng ngày không hợp lệ.");
  const page = Math.max(0, Math.min(100000, Math.floor(Number(payload.page) || 0)));
  let query = client.from("recruitment_applications")
    .select("id,application,submitted_at,notification_status", { count: "exact" })
    .order("submitted_at", { ascending: false }).order("id", { ascending: false });
  if (branch) query = query.eq("application->>branch", branch);
  if (from) query = query.gte("submitted_at", from);
  if (to) query = query.lt("submitted_at", to);
  const [list, summary] = await Promise.all([
    query.range(page * 25, page * 25 + 24),
    client.rpc("recruitment_summary", { p_branch: branch, p_from: from, p_to: to })
  ]);
  if (list.error || summary.error) throw new Error("Chưa tải được hồ sơ tuyển dụng.");
  // List exposes only a summary; long answers stay in the authorized detail endpoint.
  const rows = (list.data || []).map((row) => ({
    id: row.id, fullName: row.application.fullName, phone: row.application.phone,
    branch: row.application.branch, submitted_at: row.submitted_at, notification_status: row.notification_status
  }));
  return { ok: true, rows, count: list.count || 0, summary: summary.data, page };
}
