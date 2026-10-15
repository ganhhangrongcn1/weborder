import { useState } from "react";
import { AdminButton } from "../ui/AdminCommon.jsx";
import { DEFAULT_RECRUITMENT_CONFIG, validateFormConfig } from "../../../../supabase/functions/_shared/recruitmentForm.js";
import RecruitmentQuestionEditor, { QUESTION_TYPES } from "./RecruitmentQuestionEditor.jsx";
import RecruitmentFormPreview from "./RecruitmentFormPreview.jsx";
import "./recruitmentEditor.css";

export default function RecruitmentFormEditor({ draft, setDraft, saving, save, error, notice, ready, baseline, loading = false, reload }) {
  const [selectedId, setSelectedId] = useState("fullName");
  const [mode, setMode] = useState("questions");
  const [localError, setLocalError] = useState("");
  const [previewScreen, setPreviewScreen] = useState("form");
  const [resetPrompt, setResetPrompt] = useState(false);
  if (!draft) return <p role="status">Đang tải cài đặt tuyển dụng…</p>;
  const original = baseline || DEFAULT_RECRUITMENT_CONFIG;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const index = Math.max(0, draft.questions.findIndex((q) => q.id === selectedId));
  const selected = draft.questions[index];
  const change = (next) => { setLocalError(""); setResetPrompt(false); setDraft(next); };
  const update = (patch) => change((previous) => ({ ...previous, questions: previous.questions.map((q) => q.id === selected.id ? { ...q, ...patch } : q) }));
  const move = (step) => change((previous) => {
    const questions = [...previous.questions];
    [questions[index], questions[index + step]] = [questions[index + step], questions[index]];
    return { ...previous, questions };
  });
  const add = () => {
    const id = `extra_${crypto.randomUUID().replaceAll("-", "")}`;
    change((previous) => ({ ...previous, questions: [...previous.questions, { id, label: "Câu hỏi mới", type: "text", active: true, required: false }] }));
    setSelectedId(id); setMode("questions");
  };
  function submit(event) {
    event.preventDefault();
    if (!ready || saving || !dirty) return;
    try { validateFormConfig(draft); setLocalError(""); save(); }
    catch (failure) {
      setLocalError(failure.message);
      const invalid = draft.questions.find((q) => !q.label.trim() || (["radio", "checkbox"].includes(q.type)
        && (!q.options?.length || q.options.some((option) => !option.trim()) || new Set(q.options.map((option) => option.trim())).size !== q.options.length)));
      if (invalid) { setSelectedId(invalid.id); setMode("questions"); }
      else if (!draft.introduction.trim() || !draft.successMessage.trim()) setMode("content");
    }
  }
  return (
    <div className="recruitment-builder">
      <header className="recruitment-builder-title"><div><h2>Thiết kế form tuyển dụng</h2><p>Chọn câu hỏi để chỉnh. Bản xem trước bên cạnh đổi theo từng thao tác.</p></div><span className={`recruitment-builder-status ${dirty ? "is-dirty" : ""}`}>{loading ? "Đang kết nối…" : !ready ? "Đang xem thử" : dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ"}</span></header>
      {!ready && !loading && <div className="recruitment-builder-banner"><strong>Bản xem thử — chưa bật lưu cài đặt</strong><p>Anh có thể chỉnh và thử form bên cạnh. Những thay đổi này chưa xuất hiện trên website và sẽ mất nếu tải lại trang.</p>{reload && <button type="button" onClick={reload}>Kết nối lại</button>}</div>}
      <div className="recruitment-builder-layout">
        <form className="recruitment-builder-controls" onSubmit={submit} noValidate>
          <fieldset disabled={saving || loading}>
            <div className="recruitment-builder-tabs" role="group" aria-label="Phần cài đặt form"><button type="button" aria-pressed={mode === "questions"} onClick={() => setMode("questions")}>Câu hỏi ({draft.questions.filter((q) => q.active).length})</button><button type="button" aria-pressed={mode === "content"} onClick={() => setMode("content")}>Nội dung & tiếp nhận</button></div>
            {mode === "questions" ? <div className="recruitment-builder-question-layout">
              <nav className="recruitment-question-list" aria-label="Danh sách câu hỏi">
                {draft.questions.map((q, i) => <button type="button" key={q.id} aria-pressed={q.id === selected.id} className={!q.active ? "is-hidden" : ""} onClick={() => { setSelectedId(q.id); setLocalError(""); }}><span className="recruitment-question-number">{i + 1}</span><span><strong>{q.label || "Chưa đặt câu hỏi"}</strong><small>{!q.active ? "Đang ẩn" : QUESTION_TYPES[q.type]}{q.required && q.active ? " · Bắt buộc" : ""}</small></span></button>)}
                <button type="button" className="recruitment-question-add" disabled={draft.questions.length >= 30} onClick={add}>+ Thêm câu hỏi</button>
              </nav>
              <RecruitmentQuestionEditor question={selected} index={index} count={draft.questions.length} update={update} move={move} previewAccepting={draft.accepting} onShowQuestion={() => {
                setPreviewScreen("form");
                globalThis.requestAnimationFrame(() => document.getElementById(`preview-${selected.id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }));
              }} />
            </div> : <section className="recruitment-content-editor">
              <h3>Nội dung ứng viên sẽ đọc</h3>
              <label className="recruitment-accepting-toggle"><input type="checkbox" checked={draft.accepting} onChange={(event) => change({ ...draft, accepting: event.target.checked })} /><span>Nhận hồ sơ ứng tuyển<small>{draft.accepting ? "Form hiển thị các câu hỏi để ứng viên điền." : "Form hiển thị thông báo tạm ngưng nhận hồ sơ."}</small></span></label>
              <label htmlFor="recruitment-editor-intro">Lời giới thiệu<textarea id="recruitment-editor-intro" required maxLength={1000} value={draft.introduction} onChange={(event) => change({ ...draft, introduction: event.target.value })} /><small>Hiện trong phần “Mình làm quen từ đây”.</small></label>
              <label htmlFor="recruitment-editor-success">Thông báo sau khi gửi<textarea id="recruitment-editor-success" required maxLength={1000} value={draft.successMessage} onChange={(event) => change({ ...draft, successMessage: event.target.value })} /><small>Chọn “Sau khi gửi” trong bản xem trước để kiểm tra.</small></label>
              <p className="recruitment-editor-note">Khi lưu, cài đặt áp dụng cho hồ sơ mới. Câu hỏi và câu trả lời của hồ sơ cũ vẫn được giữ nguyên.</p>
            </section>}
          </fieldset>
          <footer className="recruitment-builder-save">
            {(localError || error) && <p role="alert">{localError || error}</p>}
            {notice && !dirty && <p role="status">{notice}</p>}
            {resetPrompt ? <div className="recruitment-reset-confirm"><p>Bỏ những thay đổi chưa lưu của anh?</p><AdminButton type="button" variant="secondary" onClick={() => { setDraft(globalThis.structuredClone(original)); setResetPrompt(false); setLocalError(""); }}>Bỏ thay đổi</AdminButton><AdminButton type="button" variant="secondary" onClick={() => setResetPrompt(false)}>Giữ bản đang sửa</AdminButton></div>
              : <div className="recruitment-builder-actions"><span>{!ready ? "Chưa lưu lên website" : dirty ? "Lưu để cập nhật form trên website" : "Chưa có thay đổi mới"}</span><AdminButton type="button" variant="secondary" disabled={!dirty || saving} onClick={() => setResetPrompt(true)}>Khôi phục</AdminButton><AdminButton type="submit" disabled={saving || !ready || !dirty}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton></div>}
          </footer>
        </form>
        <RecruitmentFormPreview config={draft} screen={previewScreen} setScreen={setPreviewScreen} selectedId={mode === "questions" ? selected.id : null} />
      </div>
    </div>
  );
}
