import { useEffect, useRef, useState } from "react";
import { adminRecruitmentRequest } from "../../../services/adminRecruitmentService.js";
import { DEFAULT_RECRUITMENT_CONFIG } from "../../../../supabase/functions/_shared/recruitmentForm.js";

export default function useAdminRecruitment() {
  const [filters, setFilters] = useState({ branch: "", from: "", to: "", page: 0 });
  const [dashboard, setDashboard] = useState(null);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(DEFAULT_RECRUITMENT_CONFIG);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsRefresh, setSettingsRefresh] = useState(0);
  const [settingsError, setSettingsError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const detailSequence = useRef(0);
  const saveLock = useRef(false);
  useEffect(() => {
    let active = true;
    setSettingsLoading(true); setSettingsError("");
    adminRecruitmentRequest("admin_form").then((result) => {
      if (active) {
        setSettings(result);
        setDraft((previous) => JSON.stringify(previous) === JSON.stringify(settings?.config || DEFAULT_RECRUITMENT_CONFIG) ? result.config : previous);
      }
    }).catch((failure) => { if (active) setSettingsError(failure.message); })
      .finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, [settingsRefresh]);
  useEffect(() => {
    let active = true;
    detailSequence.current++;
    setLoading(true); setError(""); setDetail(null);
    adminRecruitmentRequest("admin_dashboard", filters).then((result) => {
      if (active) setDashboard(result);
    }).catch((failure) => { if (active) { setError(failure.message); setDashboard(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; detailSequence.current++; };
  }, [filters, refresh]);
  function editDraft(next) { setDraft(next); setSettingsError(""); setNotice(""); }
  function filter(key, value) { setFilters((previous) => ({ ...previous, [key]: value, ...(key === "page" ? {} : { page: 0 }) })); }
  async function openDetail(id) {
    const sequence = ++detailSequence.current;
    setError(""); setDetail(null);
    try {
      const result = await adminRecruitmentRequest("admin_detail", { id });
      if (sequence === detailSequence.current) setDetail(result.application);
    } catch (failure) { if (sequence === detailSequence.current) setError(failure.message); }
  }
  function closeDetail() { detailSequence.current++; setDetail(null); }
  async function save() {
    if (saveLock.current || !settings || !draft) return;
    saveLock.current = true; setSaving(true); setSettingsError(""); setNotice("");
    try {
      const result = await adminRecruitmentRequest("admin_save_form", { config: draft, revision: settings.revision });
      setSettings(result); setDraft(result.config); setNotice("Đã lưu câu hỏi và cài đặt tuyển dụng.");
    } catch (failure) { setSettingsError(failure.message); }
    finally { saveLock.current = false; setSaving(false); }
  }
  return { filters, filter, dashboard, loading, error, settingsError, notice, settings, draft, setDraft: editDraft,
    saving, save, detail, openDetail, closeDetail, settingsLoading, reloadSettings: () => setSettingsRefresh((value) => value + 1), reload: () => setRefresh((value) => value + 1) };
}
