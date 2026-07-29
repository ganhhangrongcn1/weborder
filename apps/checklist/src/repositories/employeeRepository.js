import { getSupabaseClient } from "../services/supabase/supabaseClient.js";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("missing_supabase_config");
  return client;
}

export async function listEmployees() {
  const client = requireClient();
  const [employeesResult, assignmentsResult] = await Promise.all([
    client.from("checklist_employees").select("*").order("full_name", { ascending: true }),
    client.from("checklist_employee_branches").select("employee_id, branch_uuid, is_primary, is_active")
  ]);

  if (employeesResult.error) throw employeesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const assignmentsByEmployee = new Map();
  for (const assignment of assignmentsResult.data || []) {
    if (!assignment.is_active) continue;
    const current = assignmentsByEmployee.get(assignment.employee_id) || [];
    current.push(assignment);
    assignmentsByEmployee.set(assignment.employee_id, current);
  }

  return (employeesResult.data || []).map((employee) => ({
    ...employee,
    branchAssignments: assignmentsByEmployee.get(employee.id) || []
  }));
}

export async function saveEmployee(employee) {
  const client = requireClient();
  const { data, error } = await client.rpc("save_checklist_employee", {
    p_employee_id: employee.id || null,
    p_employee_code: employee.employeeCode,
    p_full_name: employee.fullName,
    p_phone: employee.phone || null,
    p_position_name: employee.positionName || "Nhân viên",
    p_employment_status: employee.employmentStatus || "active",
    p_started_on: employee.startedOn || null,
    p_branch_uuids: employee.branchUuids || []
  });
  if (error) throw error;
  return data;
}
