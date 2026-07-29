import { useCallback, useEffect, useState } from "react";
import { loadChecklistEmployeeMonthlyReport } from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminSelect } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";
import EmployeeIssueDetailModal from "./EmployeeIssueDetailModal.jsx";

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function scoreTone(score) { return score === null || score === undefined ? "neutral" : Number(score) >= 85 ? "success" : Number(score) >= 70 ? "warning" : "danger"; }

export default function AdminEmployeeMonthlyReport({ branches = [] }) {
  const [filters, setFilters] = useState({ month: currentMonth(), branchUuid: "" });
  const [state, setState] = useState({ data: null, loading: true, error: "", selected: null });
  const [selectedIssue, setSelectedIssue] = useState(null);
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "", selected: null }));
    try {
      const data = await loadChecklistEmployeeMonthlyReport(filters);
      setState((current) => ({ ...current, data, loading: false }));
    }
    catch (error) { setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được đánh giá nhân viên." })); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const data = state.data || { summary: {}, employees: [] };

  return <div className="checklist-report-page">
    <div className="report-scope-banner"><div><strong>Báo cáo vi phạm theo nhân viên</strong><span>Mỗi lỗi chỉ tính cho nhân viên được giám sát chọn là người liên quan trong biên bản.</span></div><AdminBadge tone="neutral">Không phải báo cáo chi nhánh</AdminBadge></div>
    <div className="checklist-report-filters employee"><label><span>Tháng đánh giá</span><input type="month" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })} /></label><label><span>Chi nhánh nhân viên có mặt</span><AdminSelect value={filters.branchUuid} onChange={(event) => setFilters({ ...filters, branchUuid: event.target.value })} options={[{ value: "", label: "Tất cả chi nhánh" }, ...branches.map((branch) => ({ value: branch.branch_uuid || branch.id, label: branch.name }))]} /></label><AdminButton variant="secondary" onClick={load}>Làm mới</AdminButton></div>
    {state.error ? <p className="checklist-admin-message error">{state.error}</p> : null}
    <div className="checklist-report-kpis"><AdminCard><small>Đủ dữ liệu xếp điểm</small><strong>{data.summary.evaluated_count || 0}</strong><span>Tối thiểu 2 lần kiểm tra · {data.summary.observed_count || 0} người đã có dữ liệu</span></AdminCard><AdminCard><small>Điểm tuân thủ trung bình</small><strong>{Number(data.summary.average_score || 0).toFixed(1)}</strong><span>Chỉ tính nhân viên đã đủ dữ liệu</span></AdminCard><AdminCard><small>Lượt lỗi gắn nhân viên</small><strong>{data.summary.violation_count || 0}</strong><span>Không gồm lỗi cửa hàng hoặc lỗi chung ca</span></AdminCard><AdminCard><small>Lượt lỗi tái phạm</small><strong>{data.summary.repeated_count || 0}</strong><span>Cùng tiêu chí từ lần thứ hai</span></AdminCard></div>
    <details className="employee-score-explainer"><summary>Điểm tuân thủ tháng được tính như thế nào?</summary><div><p><strong>Công thức:</strong> 100 − (Tổng điểm phạt cá nhân ÷ Số lần có mặt) × 5.</p><p><strong>Mức phạt:</strong> Nhắc nhở 0 · Lỗi nhẹ 1 · Lỗi nặng 3 · Nghiêm trọng 7 · Đặc biệt nghiêm trọng 10. “Cần cải thiện” tính 50%, “Không đạt” tính 100%.</p><p>Cùng lỗi lặp lại trong 30 ngày tăng 25% mỗi lần, tối đa gấp 2. Lỗi cửa hàng và lỗi chung trong ca không trừ điểm cá nhân.</p><p>Chỉ xếp điểm khi có tối thiểu 2 lần kiểm tra. Ví dụ: có mặt 2 lần, tổng 8 điểm phạt → 100 − (8 ÷ 2) × 5 = <strong>80 điểm</strong>.</p></div></details>
    <AdminCard className="checklist-report-table-card"><header><div><h3>Bảng điểm tuân thủ nhân viên</h3><p>Điểm thấp và vi phạm nhiều được ưu tiên coaching; không dùng làm điểm hiệu suất tổng thể.</p></div></header>{state.loading ? <AdminEmptyState message="Đang tính điểm nhân viên…" /> : data.employees.length ? <div className="checklist-admin-table-wrap"><table className="checklist-admin-table"><thead><tr><th>Nhân viên</th><th>Số lần có mặt</th><th>Vi phạm</th><th>Lặp lại</th><th>Điểm tháng</th><th /></tr></thead><tbody>{data.employees.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong><small>{row.employee_code} · {row.position_name}</small></td><td>{row.appearance_count}</td><td>{row.violation_count}</td><td>{row.repeated_count}</td><td><AdminBadge tone={scoreTone(row.compliance_score)}>{row.compliance_score === null ? "Chưa đủ dữ liệu" : Number(row.compliance_score).toFixed(1)}</AdminBadge><small>{row.standing_label}</small></td><td><AdminButton variant="secondary" disabled={!row.top_issues?.length} onClick={() => setState((current) => ({ ...current, selected: row }))}>Xem lỗi</AdminButton></td></tr>)}</tbody></table></div> : <AdminEmptyState message="Chưa có nhân viên phù hợp." />}</AdminCard>
    {state.selected && !selectedIssue ? <div className="checklist-admin-modal-backdrop" onMouseDown={() => setState((current) => ({ ...current, selected: null }))}><section className="checklist-admin-modal employee-issues" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Lỗi thường gặp của {state.selected.full_name}</h2><p>{filters.month} · {state.selected.violation_count} lượt vi phạm</p></div><button type="button" onClick={() => setState((current) => ({ ...current, selected: null }))}>×</button></header><div className="employee-issue-list">{state.selected.top_issues.map((issue) => <article key={issue.item_code}><span>{issue.item_code}</span><div><strong>{issue.content}</strong><small>Xuất hiện {issue.occurrence_count} lần · {Number(issue.penalty_points).toFixed(1)} điểm phạt</small></div><div><AdminBadge tone={issue.occurrence_count > 1 ? "danger" : "warning"}>{issue.occurrence_count > 1 ? "Lặp lại" : "Mới"}</AdminBadge><button type="button" onClick={() => setSelectedIssue(issue)}>Xem ngày & ảnh</button></div></article>)}</div></section></div> : null}
    {state.selected && selectedIssue ? <EmployeeIssueDetailModal employee={state.selected} issue={selectedIssue} month={filters.month} branchUuid={filters.branchUuid} onBack={() => setSelectedIssue(null)} onClose={() => { setSelectedIssue(null); setState((current) => ({ ...current, selected: null })); }} /> : null}
  </div>;
}
