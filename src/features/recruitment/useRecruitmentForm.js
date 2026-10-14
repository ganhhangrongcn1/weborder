import { useEffect, useRef, useState } from "react";
import { submitRecruitmentApplication } from "../../services/recruitmentService.js";
import { EMPTY_RECRUITMENT_FORM, validateRecruitment } from "../../../supabase/functions/_shared/recruitmentSchema.js";

export default function useRecruitmentForm() {
  const [form, setForm] = useState(() => ({ ...EMPTY_RECRUITMENT_FORM, shifts: [], workTypes: [] }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  function toggle(key, value) {
    setForm((previous) => ({ ...previous, [key]: previous[key].includes(value)
      ? previous[key].filter((item) => item !== value) : [...previous[key], value] }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || receipt) return;
    const result = validateRecruitment(form);
    setErrors(result.errors);
    setMessage("");
    if (!result.valid) {
      setMessage("Bạn kiểm tra các mục được đánh dấu giúp Gánh nha.");
      globalThis.requestAnimationFrame(() => document.getElementById(`recruitment-${Object.keys(result.errors)[0]}`)?.focus());
      return;
    }
    const signature = JSON.stringify(result.data);
    // Reuse the key after uncertain network responses. Editing creates a new attempt.
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    inFlight.current = true;
    setSubmitting(true);
    try {
      const saved = await submitRecruitmentApplication(form, attempt.current.id);
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
  return { form, errors, message, submitting, receipt, update, toggle, submit };
}
