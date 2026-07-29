import { getSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

function requireAdminClient() {
  const client = getSupabaseAdminAuthClient();
  if (!client) throw new Error("Chưa kết nối được Supabase Admin.");
  return client;
}

export async function loadChecklistEmployees() {
  const client = requireAdminClient();
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

export async function saveChecklistEmployee(employee) {
  const client = requireAdminClient();
  const params = {
    p_employee_id: employee.id || null,
    p_employee_code: employee.employeeCode || "",
    p_full_name: employee.fullName.trim(),
    p_family_name: null,
    p_given_name: null,
    p_email: employee.email || null,
    p_phone: employee.phone || null,
    p_position_id: employee.positionId || null,
    p_department_id: employee.departmentId || null,
    p_employee_type: employee.employeeType || "official",
    p_level_code: employee.levelCode || null,
    p_base_salary: employee.baseSalary === "" ? null : Number(employee.baseSalary),
    p_kpi_salary: employee.kpiSalary === "" ? null : Number(employee.kpiSalary),
    p_birth_date: employee.birthDate || null,
    p_gender: employee.gender || null,
    p_employment_status: employee.employmentStatus || "active",
    p_started_on: employee.startedOn || null,
    p_address_province: employee.addressProvince || null,
    p_address_district: employee.addressDistrict || null,
    p_address_line: employee.addressLine || null,
    p_bank_name: employee.bankName || null,
    p_bank_account_number: employee.bankAccountNumber || null,
    p_bank_account_holder: employee.bankAccountHolder || null,
    p_national_id_number: employee.nationalIdNumber || null,
    p_national_id_issued_on: employee.nationalIdIssuedOn || null,
    p_national_id_front_url: employee.nationalIdFrontUrl || null,
    p_national_id_back_url: employee.nationalIdBackUrl || null,
    p_payroll_method: employee.payrollMethod || "bank_transfer",
    p_branch_uuids: employee.branchUuids || []
  };
  const { data, error } = await client.rpc("save_checklist_employee_hr", params);
  if (error) throw error;
  return data;
}

export async function loadChecklistDepartments() {
  const client = requireAdminClient();
  const { data, error } = await client.from("checklist_departments").select("*").order("display_order").order("name");
  if (error) throw error;
  return data || [];
}

export async function uploadChecklistEmployeeIdentityImage(employeeId, side, file) {
  const client = requireAdminClient();
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Ảnh CCCD phải là tệp JPG, PNG hoặc WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Mỗi ảnh CCCD không được vượt quá 5 MB.");
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const objectPath = `${employeeId}/${side}-${Date.now()}.${extension}`;
  const { error } = await client.storage.from("checklist-hr-documents").upload(objectPath, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return objectPath;
}

export async function loadChecklistPositions() {
  const client = requireAdminClient();
  const { data, error } = await client.from("checklist_positions").select("*").order("display_order").order("name");
  if (error) throw error;
  return data || [];
}

export async function saveChecklistPosition(position) {
  const client = requireAdminClient();
  const payload = {
    name: position.name.trim(),
    description: position.description.trim(),
    display_order: Number(position.displayOrder) || 0,
    is_active: position.isActive
  };
  const query = position.id
    ? client.from("checklist_positions").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", position.id)
    : client.from("checklist_positions").insert({ ...payload, position_code: `CUSTOM_${Date.now().toString(36).toUpperCase()}` });
  const { error } = await query;
  if (error) throw error;
}

export async function loadChecklistTemplates() {
  const client = requireAdminClient();
  const [templates, versions, sections, items] = await Promise.all([
    client.from("checklist_templates").select("*").eq("is_active", true).order("name"),
    client.from("checklist_template_versions").select("*").order("version_number", { ascending: false }),
    client.from("checklist_sections").select("*").order("display_order"),
    client.from("checklist_items").select("*").order("display_order")
  ]);
  const failed = [templates, versions, sections, items].find((result) => result.error);
  if (failed) throw failed.error;
  return { templates: templates.data || [], versions: versions.data || [], sections: sections.data || [], items: items.data || [] };
}

export async function createChecklistDraft(templateId) {
  const client = requireAdminClient();
  const { error } = await client.rpc("create_checklist_template_draft", { p_template_id: templateId });
  if (error) throw error;
}

export async function cloneChecklistVersion(sourceVersionId) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("clone_checklist_template_version", { p_source_version_id: sourceVersionId });
  if (error) throw error;
  return data;
}

export async function cancelChecklistDraft(versionId) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("cancel_checklist_template_draft", { p_version_id: versionId });
  if (error) throw error;
  return data;
}

export async function publishChecklistVersion(versionId) {
  const client = requireAdminClient();
  const { error } = await client.rpc("publish_checklist_template_version", { p_version_id: versionId });
  if (error) throw error;
}

export async function saveChecklistCriterion(item) {
  const client = requireAdminClient();
  const payload = {
    content: item.content.trim(),
    guidance: item.guidance.trim(),
    weight: Number(item.weight),
    is_critical: item.isCritical,
    evidence_rule: item.evidenceRule,
    default_penalty_level: item.defaultPenaltyLevel,
    is_active: item.isActive
  };
  const query = item.id
    ? client.from("checklist_items").update(payload).eq("id", item.id)
    : client.from("checklist_items").insert({
        ...payload,
        version_id: item.versionId,
        section_id: item.sectionId,
        item_code: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
        display_order: item.displayOrder
      });
  const { error } = await query;
  if (error) throw error;
}

export async function loadChecklistSupervisionReport({ dateFrom, dateTo, branchUuid = null }) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("get_checklist_supervision_report", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_branch_uuid: branchUuid || null
  });
  if (error) throw error;
  return data;
}

export async function loadChecklistEmployeeMonthlyReport({ month, branchUuid = null }) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("get_checklist_employee_monthly_report", {
    p_month: `${month}-01`,
    p_branch_uuid: branchUuid || null
  });
  if (error) throw error;
  return data;
}

export async function loadChecklistEmployeeIssueOccurrences({ employeeId, itemCode, month, branchUuid = null }) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("get_checklist_employee_issue_occurrences", {
    p_employee_id: employeeId,
    p_item_code: itemCode,
    p_month: `${month}-01`,
    p_branch_uuid: branchUuid || null
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const paths = rows.flatMap((row) => row.evidence_paths || []);
  const signedResult = paths.length
    ? await client.storage.from("checklist-evidence").createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signedResult.error) throw signedResult.error;
  const signedByPath = new Map((signedResult.data || []).map((item) => [item.path, item.signedUrl]));
  return rows.map((row) => ({ ...row, evidence_urls: (row.evidence_paths || []).map((path) => signedByPath.get(path)).filter(Boolean) }));
}
