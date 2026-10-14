import { AdminSelect } from "../ui/index.js";
import { AdminButton, AdminInput } from "../ui/AdminCommon.jsx";

export default function RecruitmentFormEditor({ draft, setDraft, saving, save, error, notice, ready }) {
  if (!draft) return <p role="status">{error || "Đang tải cài đặt tuyển dụng…"}</p>;
  const update = (index, patch) => setDraft((previous) => ({ ...previous,
    questions: previous.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  const move = (index, step) => setDraft((previous) => {
    const questions = [...previous.questions];
    [questions[index], questions[index + step]] = [questions[index + step], questions[index]];
    return { ...previous, questions };
  });
  return (
    <form className="admin-recruitment-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <fieldset disabled={saving}>
        <label><input type="checkbox" checked={draft.accepting} onChange={(event) => setDraft({ ...draft, accepting: event.target.checked })} /> Nhận hồ sơ ứng tuyển</label>
        <label>Lời giới thiệu<textarea required maxLength={1000} value={draft.introduction} onChange={(event) => setDraft({ ...draft, introduction: event.target.value })} /></label>
        <label>Thông báo sau khi gửi<textarea required maxLength={1000} value={draft.successMessage} onChange={(event) => setDraft({ ...draft, successMessage: event.target.value })} /></label>
        <p>Thay đổi áp dụng cho hồ sơ mới. Hồ sơ cũ giữ nguyên câu hỏi tại thời điểm nộp. Chi nhánh giữ danh sách cố định để thống kê thống nhất.</p>
        {draft.questions.map((q, index) => (
          <article key={q.id} className="admin-recruitment-question">
            <label>Câu {index + 1}<AdminInput required maxLength={200} value={q.label} onChange={(event) => update(index, { label: event.target.value })} /></label>
            <div className="admin-recruitment-inline">
              <label><input type="checkbox" checked={q.active} disabled={["fullName", "phone", "branch"].includes(q.id)} onChange={(event) => update(index, { active: event.target.checked })} /> Hiển thị</label>
              <label><input type="checkbox" checked={q.required} disabled={["fullName", "phone", "branch"].includes(q.id)} onChange={(event) => update(index, { required: event.target.checked })} /> Bắt buộc</label>
              <AdminButton type="button" variant="secondary" disabled={!index} onClick={() => move(index, -1)} aria-label={`Đưa câu ${index + 1} lên`}>↑</AdminButton>
              <AdminButton type="button" variant="secondary" disabled={index === draft.questions.length - 1} onClick={() => move(index, 1)} aria-label={`Đưa câu ${index + 1} xuống`}>↓</AdminButton>
            </div>
            {q.id.startsWith("extra_") && <label>Loại câu hỏi<AdminSelect value={q.type} onChange={(event) => update(index, { type: event.target.value, ...(["radio", "checkbox"].includes(event.target.value) ? { options: q.options || ["Lựa chọn 1"] } : {}) })}>
              <option value="text">Trả lời ngắn</option><option value="textarea">Trả lời dài</option><option value="radio">Chọn một</option><option value="checkbox">Chọn nhiều</option><option value="date">Ngày</option>
            </AdminSelect></label>}
            {["radio", "checkbox"].includes(q.type) && <label>Lựa chọn (mỗi dòng một mục)<textarea value={q.options.join("\n")} disabled={q.id === "branch"} onChange={(event) => update(index, { options: event.target.value.split("\n") })} /></label>}
          </article>
        ))}
        <AdminButton type="button" variant="secondary" disabled={draft.questions.length >= 30} onClick={() => setDraft({ ...draft,
          questions: [...draft.questions, { id: `extra_${crypto.randomUUID().replaceAll("-", "")}`, label: "Câu hỏi mới", type: "text", active: true, required: false }] })}>Thêm câu hỏi</AdminButton>
      </fieldset>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <AdminButton type="submit" disabled={saving || !ready}>{!ready ? "Chưa kết nối được cài đặt" : saving ? "Đang lưu…" : "Lưu cài đặt tuyển dụng"}</AdminButton>
    </form>
  );
}
