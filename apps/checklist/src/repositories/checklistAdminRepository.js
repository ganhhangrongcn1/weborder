import { getSupabaseClient } from "../services/supabase/supabaseClient.js";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("missing_supabase_config");
  return client;
}

export async function loadChecklistWorkspace() {
  const client = requireClient();
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

export async function createDraft(templateId) {
  const client = requireClient();
  const { data, error } = await client.rpc("create_checklist_template_draft", { p_template_id: templateId });
  if (error) throw error;
  return data;
}

export async function publishVersion(versionId) {
  const client = requireClient();
  const { data, error } = await client.rpc("publish_checklist_template_version", { p_version_id: versionId });
  if (error) throw error;
  return data;
}

export async function saveChecklistItem(item) {
  const client = requireClient();
  const payload = {
    content: item.content.trim(),
    guidance: item.guidance.trim(),
    weight: Number(item.weight),
    is_critical: item.isCritical,
    evidence_rule: item.evidenceRule,
    default_penalty_level: item.defaultPenaltyLevel,
    is_active: item.isActive
  };
  const { error } = await client.from("checklist_items").update(payload).eq("id", item.id);
  if (error) throw error;
}

export async function addChecklistItem(item) {
  const client = requireClient();
  const { error } = await client.from("checklist_items").insert({
    version_id: item.versionId,
    section_id: item.sectionId,
    item_code: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
    content: item.content.trim(),
    guidance: item.guidance.trim(),
    weight: Number(item.weight),
    is_critical: item.isCritical,
    evidence_rule: item.evidenceRule,
    default_penalty_level: item.defaultPenaltyLevel,
    display_order: item.displayOrder,
    is_active: true
  });
  if (error) throw error;
}
