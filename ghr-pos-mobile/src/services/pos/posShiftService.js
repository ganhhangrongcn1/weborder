import { supabase } from "../supabase/client";

function toText(value = "") {
  return String(value || "").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShift(row = null) {
  if (!row || typeof row !== "object") return null;
  return {
    id: toText(row.id),
    branchUuid: toText(row.branch_uuid),
    branchName: toText(row.branch_name),
    registerKey: toText(row.register_key || "main"),
    status: toText(row.status).toLowerCase(),
    cashierName: toText(row.cashier_name),
    openingCash: Math.max(0, toNumber(row.opening_cash)),
    openingNote: toText(row.opening_note),
    openedAt: toText(row.opened_at)
  };
}

export async function fetchActivePosShift({ branchUuid, registerKey = "main" }) {
  if (!supabase) return { ok: false, shift: null, message: "Thiếu cấu hình Supabase." };
  if (!toText(branchUuid)) return { ok: false, shift: null, message: "Thiếu chi nhánh." };

  const { data, error } = await supabase
    .from("pos_shifts")
    .select("id,branch_uuid,branch_name,register_key,status,cashier_name,opening_cash,opening_note,opened_at")
    .eq("branch_uuid", toText(branchUuid))
    .eq("register_key", toText(registerKey) || "main")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, shift: null, message: error.message || "Không tải được ca POS." };
  }
  return { ok: true, shift: normalizeShift(data), message: "" };
}

export async function openPosShift({
  branchUuid,
  branchName,
  registerKey = "main",
  cashierName,
  profileId,
  authUserId,
  openingCash = 0,
  openingNote = ""
}) {
  if (!supabase) return { ok: false, shift: null, message: "Thiếu cấu hình Supabase." };
  const existing = await fetchActivePosShift({ branchUuid, registerKey });
  if (existing.ok && existing.shift?.id) {
    return { ok: true, shift: existing.shift, reused: true, message: "Đã khôi phục ca POS đang mở." };
  }

  const payload = {
    branch_uuid: toText(branchUuid),
    branch_name: toText(branchName),
    register_key: toText(registerKey) || "main",
    status: "open",
    cashier_name: toText(cashierName) || "Thu ngân",
    opened_by_profile_id: toText(profileId) || null,
    opened_by_auth_user_id: toText(authUserId) || null,
    opening_cash: Math.max(0, Math.round(toNumber(openingCash))),
    opening_note: toText(openingNote)
  };

  const { data, error } = await supabase
    .from("pos_shifts")
    .insert(payload)
    .select("id,branch_uuid,branch_name,register_key,status,cashier_name,opening_cash,opening_note,opened_at")
    .single();

  if (error) {
    return { ok: false, shift: null, message: error.message || "Không mở được ca POS." };
  }
  return { ok: true, shift: normalizeShift(data), reused: false, message: "Đã mở ca POS." };
}
