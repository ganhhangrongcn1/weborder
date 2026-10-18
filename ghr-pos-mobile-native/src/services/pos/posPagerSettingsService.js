import { supabase } from "../supabase/client";

export function getPosPagerConfigKey(branchUuid) {
  return `ghr_pos_pager_${String(branchUuid || "").trim()}`;
}

export async function readPosPagerEnabled(branchUuid) {
  if (!branchUuid || !supabase) return true;
  const { data, error } = await supabase.from("app_configs")
    .select("value").eq("id", getPosPagerConfigKey(branchUuid)).maybeSingle();
  if (error) throw error;
  return data?.value?.enabled !== false;
}

export async function savePosPagerEnabled(branchUuid, enabled) {
  if (!branchUuid || !supabase) throw new Error("Chưa xác định chi nhánh POS.");
  const { error } = await supabase.rpc("set_pos_branch_pager_enabled", {
    p_branch_uuid: branchUuid, p_enabled: Boolean(enabled)
  });
  if (error) throw error;
}
