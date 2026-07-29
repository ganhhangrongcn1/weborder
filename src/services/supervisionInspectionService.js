import { getSupabaseAdminAuthClient } from "./supabase/supabaseRuntimeClient.js";

const EVIDENCE_BUCKET = "checklist-evidence";

function requireClient() {
  const client = getSupabaseAdminAuthClient();
  if (!client) throw new Error("Chưa kết nối được Supabase.");
  return client;
}

export async function loadInspectionSetup() {
  const client = requireClient();
  const [branches, employees, assignments, templates, versions, sections, items] = await Promise.all([
    client.from("branches").select("branch_uuid, branch_code, name, address").order("name"),
    client.from("checklist_employees").select("id, employee_code, full_name, position_name, employment_status").eq("employment_status", "active").order("full_name"),
    client.from("checklist_employee_branches").select("employee_id, branch_uuid, is_active").eq("is_active", true),
    client.from("checklist_templates").select("id, name, inspection_interval_days").eq("is_active", true).limit(1),
    client.from("checklist_template_versions").select("id, template_id, version_number, status").eq("status", "published").order("version_number", { ascending: false }),
    client.from("checklist_sections").select("*").eq("is_active", true).order("display_order"),
    client.from("checklist_items").select("*").eq("is_active", true).order("display_order")
  ]);
  const failed = [branches, employees, assignments, templates, versions, sections, items].find((result) => result.error);
  if (failed) throw failed.error;
  const { data: sessionData } = await client.auth.getSession();
  const authUserId = sessionData?.session?.user?.id;
  const draftResult = authUserId
    ? await client.from("checklist_inspections").select("id, inspection_code, branch_uuid, branch_name_snapshot, started_at").eq("status", "draft").eq("created_by", authUserId).order("started_at", { ascending: false }).limit(5)
    : { data: [], error: null };
  if (draftResult.error) throw draftResult.error;
  const template = templates.data?.[0] || null;
  const version = (versions.data || []).find((item) => item.template_id === template?.id) || null;
  return {
    branches: (branches.data || []).filter((branch) => branch.branch_uuid),
    employees: employees.data || [],
    assignments: assignments.data || [],
    template,
    version,
    sections: (sections.data || []).filter((section) => section.version_id === version?.id),
    items: (items.data || []).filter((item) => item.version_id === version?.id),
    drafts: draftResult.data || []
  };
}

export async function startInspection(branchUuid, employeeIds) {
  const client = requireClient();
  const { data, error } = await client.rpc("start_checklist_inspection", { p_branch_uuid: branchUuid, p_employee_ids: employeeIds });
  if (error) throw error;
  return data;
}

export async function loadInspection(inspectionId) {
  const client = requireClient();
  const [inspection, participants, answers, evidence, confirmations] = await Promise.all([
    client.from("checklist_inspections").select("*").eq("id", inspectionId).single(),
    client.from("checklist_inspection_participants").select("*").eq("inspection_id", inspectionId),
    client.from("checklist_answers").select("*").eq("inspection_id", inspectionId),
    client.from("checklist_evidence").select("*").eq("inspection_id", inspectionId),
    client.from("checklist_inspection_confirmations").select("*").eq("inspection_id", inspectionId)
  ]);
  const failed = [inspection, participants, answers, evidence, confirmations].find((result) => result.error);
  if (failed) throw failed.error;
  const answerIds = (answers.data || []).map((answer) => answer.id);
  const answerEmployees = answerIds.length
    ? await client.from("checklist_answer_employees").select("answer_id, participant_id, penalty_level, final_penalty").in("answer_id", answerIds)
    : { data: [], error: null };
  if (answerEmployees.error) throw answerEmployees.error;
  const [sections, items] = await Promise.all([
    client.from("checklist_sections").select("*").eq("version_id", inspection.data.template_version_id).eq("is_active", true).order("display_order"),
    client.from("checklist_items").select("*").eq("version_id", inspection.data.template_version_id).eq("is_active", true).order("display_order")
  ]);
  if (sections.error) throw sections.error;
  if (items.error) throw items.error;
  const evidenceRows = evidence.data || [];
  const confirmationRows = confirmations.data || [];
  const signedPaths = [...evidenceRows.map((item) => item.object_path), ...confirmationRows.map((item) => item.signature_object_path).filter(Boolean)];
  const signedResult = signedPaths.length
    ? await client.storage.from(EVIDENCE_BUCKET).createSignedUrls(signedPaths, 3600)
    : { data: [], error: null };
  const signedByPath = new Map((signedResult.data || []).map((item) => [item.path, item.signedUrl]));
  return { inspection: inspection.data, participants: participants.data || [], answers: answers.data || [], evidence: evidenceRows.map((item) => ({ ...item, signed_url: signedByPath.get(item.object_path) || "" })), confirmations: confirmationRows.map((item) => ({ ...item, signature_signed_url: signedByPath.get(item.signature_object_path) || "" })), answerEmployees: answerEmployees.data || [], sections: sections.data || [], items: items.data || [] };
}

export async function saveInspectionAnswer({ inspectionId, itemId, result, note, responsibilityScope = "store", employeeIds }) {
  const client = requireClient();
  const { data, error } = await client.rpc("save_checklist_answer_v2", {
    p_inspection_id: inspectionId,
    p_item_id: itemId,
    p_result: result,
    p_note: note || "",
    p_responsibility_scope: responsibilityScope,
    p_employee_ids: employeeIds || []
  });
  if (error) throw error;
  return data;
}

function safeFileName(name = "evidence.jpg") {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
}

export async function uploadInspectionEvidence({ inspectionId, answerId, file }) {
  const client = requireClient();
  if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Tệp bằng chứng phải là hình ảnh hợp lệ.");
  if (file.size > 3 * 1024 * 1024) throw new Error("Ảnh bằng chứng sau khi tối ưu không được vượt quá 3 MB.");
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Phiên đăng nhập đã hết hạn.");
  const objectPath = `${userId}/${inspectionId}/${answerId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await client.storage.from(EVIDENCE_BUCKET).upload(objectPath, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client.from("checklist_evidence").insert({
    inspection_id: inspectionId,
    answer_id: answerId,
    object_path: objectPath,
    mime_type: file.type || "image/jpeg",
    file_size_bytes: file.size,
    created_by: userId
  }).select("*").single();
  if (error) {
    await client.storage.from(EVIDENCE_BUCKET).remove([objectPath]).catch(() => {});
    throw error;
  }
  const { data: signedData } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(objectPath, 3600);
  return { ...data, signed_url: signedData?.signedUrl || "" };
}

export async function deleteInspectionEvidence(evidence) {
  const client = requireClient();
  const { error } = await client.from("checklist_evidence").delete().eq("id", evidence.id);
  if (error) throw error;
  await client.storage.from(EVIDENCE_BUCKET).remove([evidence.object_path]);
  return evidence.id;
}

export async function saveInspectionConfirmation({ inspectionId, participantId, confirmed, method = "confirmed", signatureObjectPath = null, employeeComment = "" }) {
  const client = requireClient();
  const { data, error } = await client.rpc("save_checklist_inspection_confirmation_v2", {
    p_inspection_id: inspectionId,
    p_participant_id: participantId,
    p_confirmed: confirmed,
    p_method: method,
    p_signature_object_path: signatureObjectPath,
    p_employee_comment: employeeComment
  });
  if (error) throw error;
  return data || (!confirmed ? { participant_id: participantId, removed: true } : null);
}

export async function uploadInspectionSignature({ inspectionId, participantId, file }) {
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Phiên đăng nhập đã hết hạn.");
  const objectPath = `${userId}/${inspectionId}/signatures/${participantId}-${Date.now()}.webp`;
  const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(objectPath, file, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  const { data: signedData } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(objectPath, 3600);
  return { objectPath, signedUrl: signedData?.signedUrl || "" };
}

export async function submitInspection(inspectionId, notes) {
  const client = requireClient();
  const { data, error } = await client.rpc("submit_checklist_inspection_v2", { p_inspection_id: inspectionId, p_notes: notes || "" });
  if (error) throw error;
  return data;
}
