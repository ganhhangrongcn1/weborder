import { useEffect, useRef } from "react";
import { AdminButton } from "../ui/AdminCommon.jsx";
import { DEFAULT_RECRUITMENT_CONFIG } from "../../../../supabase/functions/_shared/recruitmentForm.js";

const groups = [
  { title: "Thông tin cá nhân", ids: ["fullName", "birthDate", "phone", "address", "gender", "education", "school"] },
  { title: "Nguyện vọng & lịch làm", ids: ["branch", "shifts", "workTypes"] },
  { title: "Chia sẻ từ ứng viên", ids: ["impression", "previousJob", "selfDescription"] }
];
const known = new Set(groups.flatMap((group) => group.ids));
function answer(application, question) {
  const value = application[question.id];
  if (question.id === "birthDate" && /^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value.split("-").reverse().join("/");
  if (question.id === "education" && application.educationOther) return `${value || "Mục khác"} · ${application.educationOther}`;
  return value || "Chưa cung cấp";
}
export default function RecruitmentApplicationDetail({ detail, close, statusLabel }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element?.showModal) return;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, [detail.id]);
  const questions = (detail.form_snapshot?.questions || DEFAULT_RECRUITMENT_CONFIG.questions).filter((q) => q.active !== false);
  const sections = [...groups, { title: "Thông tin bổ sung", ids: questions.filter((q) => !known.has(q.id)).map((q) => q.id) }];
  const a = detail.application;
  return <dialog ref={dialog} className="recruitment-detail-dialog" aria-labelledby="recruitment-applicant-name" onCancel={close}>
    <div className="recruitment-detail-shell">
      <header className="recruitment-detail-header">
        <div><span className="recruitment-detail-eyebrow">HỒ SƠ ỨNG TUYỂN</span><h2 id="recruitment-applicant-name">{a.fullName}</h2><p>Nộp lúc {new Date(detail.submitted_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p></div>
        <AdminButton type="button" variant="secondary" onClick={close} autoFocus>Đóng hồ sơ</AdminButton>
      </header>
      <div className="recruitment-detail-body">
        <aside className="recruitment-detail-overview">
          <div className="recruitment-applicant-avatar" aria-hidden="true">{(a.fullName || "?").trim().split(/\s+/).slice(-2).map((word) => word[0]).join("")}</div>
          <h3>{a.fullName}</h3><p>{a.branch || "Chưa chọn chi nhánh"}</p>
          {/^[0-9]{10}$/.test(a.phone || "") ? <a className="recruitment-contact" href={`tel:${a.phone}`}>Gọi {a.phone}</a> : <p>{a.phone}</p>}
          <div className="recruitment-notification"><span>Thông báo Zalo</span><strong>{statusLabel}</strong>{detail.notification_last_error && <small>{detail.notification_last_error}</small>}</div>
          <small>Trạng thái thông báo không phải kết quả tuyển dụng.</small>
        </aside>
        <div className="recruitment-detail-sections">{sections.map((section) => {
          const items = questions.filter((q) => section.ids.includes(q.id));
          if (!items.length) return null;
          return <section key={section.title} className="recruitment-answer-section"><h3>{section.title}</h3><dl>{items.map((q) => {
            const value = answer(a, q);
            return <div key={q.id} className={q.type === "textarea" || q.id === "address" || q.id === "branch" ? "recruitment-answer-wide" : ""}><dt>{q.label}</dt><dd>{Array.isArray(value) ? <ul className="recruitment-answer-tags">{value.map((item) => <li key={item}>{item}</li>)}</ul> : value}</dd></div>;
          })}</dl></section>;
        })}</div>
      </div>
    </div>
  </dialog>;
}
