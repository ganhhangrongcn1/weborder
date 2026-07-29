import { getSupabaseClient } from "../services/supabase/supabaseClient.js";

export async function listActiveBranches() {
  const client = getSupabaseClient();
  if (!client) throw new Error("missing_supabase_config");

  const { data, error } = await client
    .from("branches")
    .select("branch_uuid, branch_code, name, address")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).filter((branch) => branch.branch_uuid);
}
