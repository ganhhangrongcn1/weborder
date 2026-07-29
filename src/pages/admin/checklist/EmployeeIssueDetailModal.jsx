import { useEffect, useState } from "react";
import { loadChecklistEmployeeIssueOccurrences } from "../../../services/checklistManagementService.js";
import { AdminBadge } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";

function formatDateTime(value) {
  return value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
}

export default function EmployeeIssueDetailModal({ employee, issue, month, branchUuid, onBack, onClose }) {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });

  useEffect(() => {
    let active = true;
    loadChecklistEmployeeIssueOccurrences({ employeeId: employee.id, itemCode: issue.item_code, month, branchUuid })
      .then((rows) => active && setState({ loading: false, error: "", rows }))
      .catch((error) => active && setState({ loading: false, error: error.message || "Không tải được lịch sử lỗi.", rows: [] }));
    return () => { active = false; };
  }, [branchUuid, employee.id, issue.item_code, month]);

  return (
    <div className="checklist-admin-modal-backdrop" onMouseDown={onClose}>
      <section className="checklist-admin-modal employee-issue-detail" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><button className="issue-back-button" type="button" onClick={onBack}>←</button><span><h2>{issue.content}</h2><p>{employee.full_name} · {issue.item_code}</p></span></div><button type="button" onClick={onClose}>×</button></header>
        {state.error ? <p className="checklist-admin-message error">{state.error}</p> : null}
        {state.loading ? <AdminEmptyState message="Đang tải ngày và ảnh vi phạm…" /> : null}
        {!state.loading && !state.rows.length ? <AdminEmptyState message="Chưa có chi tiết vi phạm phù hợp." /> : null}
        <div className="issue-occurrence-list">{state.rows.map((row) => <article key={row.answer_id}><div className="issue-occurrence-meta"><div><strong>{formatDateTime(row.occurred_at)}</strong><small>{row.branch_name} · {row.inspection_code}</small></div><AdminBadge tone={row.result === "fail" ? "danger" : "warning"}>{row.result === "fail" ? "Không đạt" : "Cần cải thiện"}</AdminBadge></div>{row.note ? <p>{row.note}</p> : null}<small className="issue-penalty">Điểm phạt: {Number(row.penalty_points).toFixed(1)}</small>{row.evidence_urls?.length ? <div className="issue-evidence-gallery">{row.evidence_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Ảnh lỗi ${index + 1} ngày ${formatDateTime(row.occurred_at)}`} /></a>)}</div> : <p className="issue-no-image">Không có ảnh bằng chứng cho lần này.</p>}</article>)}</div>
      </section>
    </div>
  );
}
