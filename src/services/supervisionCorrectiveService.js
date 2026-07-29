import { getSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

function requireClient() {
  const client = getSupabaseAdminAuthClient();
  if (!client) throw new Error("Chưa kết nối được Supabase.");
  return client;
}

export async function loadCorrectiveWorkspace() {
  const client = requireClient();
  const actionsResult = await client.from("checklist_corrective_actions").select("*").order("due_on", { ascending: true }).limit(150);
  if (actionsResult.error) throw actionsResult.error;
  const actions = actionsResult.data || [];
  const inspectionIds = [...new Set(actions.map((item) => item.inspection_id).filter(Boolean))];
  const answerIds = [...new Set(actions.map((item) => item.answer_id).filter(Boolean))];
  const [inspections, answers, employees, assignments] = await Promise.all([
    inspectionIds.length ? client.from("checklist_inspections").select("id, inspection_code, branch_uuid, branch_name_snapshot, submitted_at").in("id", inspectionIds) : { data: [], error: null },
    answerIds.length ? client.from("checklist_answers").select("id, item_code_snapshot, result, note").in("id", answerIds) : { data: [], error: null },
    client.from("checklist_employees").select("id, employee_code, full_name, employment_status").eq("employment_status", "active").order("full_name"),
    client.from("checklist_employee_branches").select("employee_id, branch_uuid, is_active").eq("is_active", true)
  ]);
  const failed = [inspections, answers, employees, assignments].find((result) => result.error);
  if (failed) throw failed.error;
  const inspectionMap = new Map((inspections.data || []).map((item) => [item.id, item]));
  const answerMap = new Map((answers.data || []).map((item) => [item.id, item]));
  const employeeMap = new Map((employees.data || []).map((item) => [item.id, item]));
  return {
    actions: actions.map((item) => ({ ...item, inspection: inspectionMap.get(item.inspection_id), answer: answerMap.get(item.answer_id), employee: employeeMap.get(item.assigned_employee_id) })),
    employees: employees.data || [],
    assignments: assignments.data || []
  };
}

export async function updateCorrectiveAction({ id, status, assignedEmployeeId, dueOn, resolutionNote }) {
  const client = requireClient();
  const payload = {
    status,
    assigned_employee_id: assignedEmployeeId || null,
    due_on: dueOn || null,
    resolution_note: resolutionNote?.trim() || "",
    resolved_at: ["resolved", "verified"].includes(status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client.from("checklist_corrective_actions").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
