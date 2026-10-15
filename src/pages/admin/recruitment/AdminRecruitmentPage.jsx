import { AdminSelect } from "../ui/index.js";
import { useState } from "react";
import { AdminButton, AdminCard, AdminInput } from "../ui/AdminCommon.jsx";
import useAdminRecruitment from "./useAdminRecruitment.js";
import RecruitmentSummary from "./RecruitmentSummary.jsx";
import RecruitmentFormEditor from "./RecruitmentFormEditor.jsx";
import { DEFAULT_RECRUITMENT_CONFIG } from "../../../../supabase/functions/_shared/recruitmentForm.js";
import "./adminRecruitment.css";

const statusLabels = { pending: "Chờ gửi", sending: "Đang gửi / chờ đối soát", sent: "Đã gửi Zalo", failed: "Gửi lỗi", uncertain: "Chưa xác nhận — cần đối soát" };
const formatTime = (value) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export default function AdminRecruitmentPage() {
  const state = useAdminRecruitment();
  const [tab, setTab] = useState("applications");
  const branches = DEFAULT_RECRUITMENT_CONFIG.questions.find((q) => q.id === "branch").options;
  const detailQuestions = state.detail?.form_snapshot?.questions || DEFAULT_RECRUITMENT_CONFIG.questions;
  return (
    <div className="admin-recruitment">
      <nav className="admin-recruitment-inline" aria-label="Quản lý tuyển dụng">
        {[ ["applications", "Hồ sơ"], ["summary", "Tổng hợp"], ["settings", "Câu hỏi & cài đặt"] ].map(([id, label]) => (
          <AdminButton key={id} type="button" variant={tab === id ? "primary" : "secondary"} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</AdminButton>
        ))}
        <a href="/tuyendung" target="_blank" rel="noopener noreferrer">Mở form ứng tuyển ↗</a>
      </nav>
      {tab === "settings" ? <AdminCard><RecruitmentFormEditor draft={state.draft} setDraft={state.setDraft} saving={state.saving} save={state.save} error={state.settingsError} notice={state.notice} ready={Boolean(state.settings)} baseline={state.settings?.config} loading={state.settingsLoading} reload={state.reloadSettings} /></AdminCard> : <>
        <AdminCard>
          <div className="admin-recruitment-filters">
            <label>Chi nhánh<AdminSelect value={state.filters.branch} onChange={(event) => state.filter("branch", event.target.value)}><option value="">Tất cả chi nhánh</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</AdminSelect></label>
            <label>Từ ngày<AdminInput type="date" value={state.filters.from} onChange={(event) => state.filter("from", event.target.value)} /></label>
            <label>Đến ngày<AdminInput type="date" value={state.filters.to} onChange={(event) => state.filter("to", event.target.value)} /></label>
            <AdminButton type="button" variant="secondary" onClick={state.reload}>Tải lại</AdminButton>
          </div>
        </AdminCard>
        {state.error && <p role="alert">{state.error}</p>}
        {state.loading ? <p role="status">Đang tải hồ sơ tuyển dụng…</p> : state.dashboard && <>
          <AdminCard><h2>{state.dashboard.count} hồ sơ</h2><div className="admin-recruitment-branch-counts">{branches.map((branch) => <button type="button" key={branch} aria-pressed={state.filters.branch === branch} onClick={() => state.filter("branch", branch)}><span>{branch.split(",")[0]}</span><strong>{state.dashboard.summary.branches.find((row) => row.branch === branch)?.count || 0}</strong></button>)}</div></AdminCard>
          {tab === "summary" ? <AdminCard><RecruitmentSummary summary={state.dashboard.summary} /></AdminCard> : <>
            {state.detail && <AdminCard><div className="admin-recruitment-inline"><h2>{state.detail.application.fullName}</h2><AdminButton variant="secondary" type="button" onClick={state.closeDetail}>Đóng hồ sơ</AdminButton></div>
              <p>Nộp lúc {formatTime(state.detail.submitted_at)} · {statusLabels[state.detail.notification_status]}</p>
              {state.detail.notification_last_error && <p>Thông báo: {state.detail.notification_last_error}</p>}
              <dl className="admin-recruitment-answers">{detailQuestions.filter((q) => q.active !== false).map((q) => <div key={q.id}><dt>{q.label}</dt><dd>{Array.isArray(state.detail.application[q.id]) ? state.detail.application[q.id].join(", ") : state.detail.application[q.id] || "—"}{q.id === "education" && state.detail.application.educationOther ? ` · ${state.detail.application.educationOther}` : ""}</dd></div>)}</dl>
            </AdminCard>}
            <AdminCard><div className="admin-recruitment-table"><table><thead><tr><th>Ứng viên</th><th>Chi nhánh</th><th>Ngày nộp</th><th>Thông báo</th><th>Hồ sơ</th></tr></thead><tbody>{state.dashboard.rows.map((row) => <tr key={row.id}><td><strong>{row.fullName}</strong><br />{row.phone}</td><td>{row.branch?.split(",")[0]}</td><td>{formatTime(row.submitted_at)}</td><td>{statusLabels[row.notification_status]}</td><td><AdminButton type="button" variant="secondary" onClick={() => state.openDetail(row.id)}>Xem</AdminButton></td></tr>)}</tbody></table></div>
              {!state.dashboard.rows.length && <p>Chưa có hồ sơ trong bộ lọc này.</p>}
              <div className="admin-recruitment-inline"><AdminButton type="button" variant="secondary" disabled={!state.filters.page} onClick={() => state.filter("page", state.filters.page - 1)}>Trước</AdminButton><span>Trang {state.filters.page + 1}</span><AdminButton type="button" variant="secondary" disabled={(state.filters.page + 1) * 25 >= state.dashboard.count} onClick={() => state.filter("page", state.filters.page + 1)}>Sau</AdminButton></div>
            </AdminCard>
          </>}
        </>}
      </>}
    </div>
  );
}
