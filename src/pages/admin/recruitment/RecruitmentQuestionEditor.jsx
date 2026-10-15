import { AdminSelect } from "../ui/index.js";
import { AdminButton, AdminInput } from "../ui/AdminCommon.jsx";

export const QUESTION_TYPES = { text: "Trả lời ngắn", textarea: "Trả lời dài", radio: "Chọn một đáp án", checkbox: "Chọn nhiều đáp án", date: "Ngày", tel: "Số điện thoại" };
export default function RecruitmentQuestionEditor({ question: q, index, count, update, move, onShowQuestion, previewAccepting }) {
  const locked = ["fullName", "phone", "branch"].includes(q.id);
  const options = q.options || [];
  const choice = ["radio", "checkbox"].includes(q.type);
  const invalidOptions = choice && (options.some((value) => !value.trim()) || new Set(options.map((value) => value.trim())).size !== options.length);
  return (
    <section className="recruitment-question-editor" aria-label="Chỉnh câu hỏi đang chọn">
      <header><span className="recruitment-editor-eyebrow">ĐANG CHỈNH CÂU {index + 1}</span><div className="recruitment-editor-order"><AdminButton type="button" variant="secondary" disabled={!index} onClick={() => move(-1)}>↑ Đưa lên</AdminButton><AdminButton type="button" variant="secondary" disabled={index === count - 1} onClick={() => move(1)}>↓ Đưa xuống</AdminButton></div></header>
      <label htmlFor="recruitment-editor-question">Nội dung câu hỏi<AdminInput id="recruitment-editor-question" required maxLength={200} aria-invalid={!q.label.trim()} value={q.label} onChange={(event) => update({ label: event.target.value })} /></label>
      {!q.label.trim() && <p className="recruitment-editor-error">Anh nhập nội dung câu hỏi trước khi lưu nha.</p>}
      {q.id.startsWith("extra_") ? <label htmlFor="recruitment-editor-type">Kiểu trả lời<AdminSelect id="recruitment-editor-type" value={q.type} onChange={(event) => update({ type: event.target.value, ...(["radio", "checkbox"].includes(event.target.value) ? { options: options.length ? options : ["Lựa chọn 1"] } : {}) })}>{Object.entries(QUESTION_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AdminSelect></label>
        : <p className="recruitment-editor-kind">Kiểu trả lời: <strong>{QUESTION_TYPES[q.type]}</strong></p>}
      <div className="recruitment-editor-switches">
        <label><input type="checkbox" checked={q.active} disabled={locked} onChange={(event) => update({ active: event.target.checked })} /><span>Hiện trên form<small>{q.active ? "Ứng viên sẽ nhìn thấy câu này." : "Câu này đang được ẩn khỏi form."}</small></span></label>
        <label><input type="checkbox" checked={q.required} disabled={locked} onChange={(event) => update({ required: event.target.checked })} /><span>Bắt buộc trả lời<small>{q.required ? "Cần điền trước khi gửi hồ sơ." : "Ứng viên có thể bỏ qua."}</small></span></label>
      </div>
      {locked && <p className="recruitment-editor-note">Câu này luôn hiển thị và bắt buộc để Gánh liên hệ, phân loại hồ sơ.</p>}
      {choice && <div className="recruitment-editor-options"><h3>Các đáp án</h3><p>{q.id === "branch" ? "Danh sách chi nhánh được giữ cố định để hồ sơ và thống kê không bị lẫn." : "Mỗi ô là một đáp án. Thay đổi ở đây hiện ngay trong bản xem trước."}</p>
        {options.map((value, optionIndex) => <div className="recruitment-editor-option" key={optionIndex}><span aria-hidden="true">{q.type === "radio" ? "○" : "□"}</span><AdminInput aria-label={`Đáp án ${optionIndex + 1}`} maxLength={200} value={value} readOnly={q.id === "branch"} onChange={(event) => update({ options: options.map((item, i) => i === optionIndex ? event.target.value : item) })} />
          {q.id !== "branch" && <button type="button" aria-label={`Xóa đáp án ${optionIndex + 1}`} disabled={options.length <= 1} onClick={() => update({ options: options.filter((_, i) => i !== optionIndex) })}>×</button>}
        </div>)}
        {invalidOptions && <p className="recruitment-editor-error">Đáp án không được để trống hoặc trùng nhau.</p>}
        {q.id !== "branch" && <AdminButton type="button" variant="secondary" disabled={options.length >= 20} onClick={() => update({ options: [...options, `Lựa chọn ${options.length + 1}`] })}>+ Thêm đáp án</AdminButton>}
      </div>}
      <button className="recruitment-editor-jump" type="button" disabled={!q.active || !previewAccepting} onClick={onShowQuestion}>Xem câu này trên form →</button>
    </section>
  );
}
