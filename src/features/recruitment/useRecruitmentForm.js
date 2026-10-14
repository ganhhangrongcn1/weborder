import { useEffect, useRef, useState } from "react";
import { submitRecruitmentApplication, loadRecruitmentForm } from "../../services/recruitmentService.js";
import { EMPTY_RECRUITMENT_FORM } from "../../../supabase/functions/_shared/recruitmentSchema.js";

import { validateConfiguredApplication, DEFAULT_RECRUITMENT_CONFIG } from "../../../supabase/functions/_shared/recruitmentForm.js";

export default function useRecruitmentForm() {
  const [form, setForm] = useState(() => ({ ...EMPTY_RECRUITMENT_FORM, shifts: [], workTypes: [] }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    loadRecruitmentForm().then((result) => { if (active) setSettings(result); })
      .catch((error) => { if (active) { setMessage(error.message); setSettings({ config: DEFAULT_RECRUITMENT_CONFIG, revision: 1, readOnly: true }); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, []);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  function toggle(key, value) {
    setForm((previous) => ({ ...previous, [key]: (previous[key] || []).includes(value)
      ? previous[key].filter((item) => item !== value) : [...(previous[key] || []), value] }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || receipt || !settings || settings.readOnly || !settings.config.accepting) return;
    const result = validateConfiguredApplication(form, settings.config, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }));
    setErrors(result.errors);
    setMessage("");
    if (!result.valid) {
      setMessage("Bạn kiểm tra các mục được đánh dấu giúp Gánh nha.");
      globalThis.requestAnimationFrame(() => document.getElementById(`recruitment-${Object.keys(result.errors)[0]}`)?.focus());
      return;
    }
    const signature = JSON.stringify([settings.revision, result.data]);
    // Reuse the key after uncertain network responses. Editing creates a new attempt.
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    inFlight.current = true;
    setSubmitting(true);
    try {
      const saved = await submitRecruitmentApplication(form, attempt.current.id, settings);
      if (mounted.current) setReceipt(saved);
    } catch (error) {
      if (mounted.current) {
        setMessage(error.message);
        if (error.fields) setErrors(error.fields);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  return { form, errors, message, submitting, receipt, settings, loading, update, toggle, submit };
}
