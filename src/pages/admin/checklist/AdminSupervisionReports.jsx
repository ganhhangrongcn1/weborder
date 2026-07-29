import { useCallback, useEffect, useState } from "react";
import { loadChecklistSupervisionReport } from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminSelect } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "Chưa kiểm tra"; }
function scoreTone(score) { return Number(score) >= 80 ? "success" : Number(score) >= 70 ? "warning" : "danger"; }

export default function AdminSupervisionReports({ branches = [], view = "overview" }) {
  const [filters, setFilters] = useState({ dateFrom: monthStart(), dateTo: today(), branchUuid: "" });
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try { setState({ data: await loadChecklistSupervisionReport(filters), loading: false, error: "" }); }
    catch (error) { setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được báo cáo." })); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const data = state.data || { summary: {}, branches: [], history: [], schedule: [] };

  return <div className="checklist-report-page">
    <div className="report-scope-banner"><div><strong>Báo cáo vận hành theo chi nhánh</strong><span>Điểm và vi phạm của toàn cửa hàng trong các biên bản đã hoàn tất.</span></div><AdminBadge tone="neutral">Không phải điểm nhân viên</AdminBadge></div>
    <div className="checklist-report-filters"><label><span>Từ ngày</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label><label><span>Đến ngày</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label><label><span>Chi nhánh</span><AdminSelect value={filters.branchUuid} onChange={(event) => setFilters({ ...filters, branchUuid: event.target.value })} options={[{ value: "", label: "Tất cả chi nhánh" }, ...branches.map((branch) => ({ value: branch.branch_uuid || branch.id, label: branch.name }))]} /></label><AdminButton variant="secondary" onClick={load}>Làm mới</AdminButton></div>
    {state.error ? <p className="checklist-admin-message error">{state.error}</p> : null}
    {view === "overview" ? <>
      <div className="checklist-report-kpis"><AdminCard><small>Lượt kiểm tra</small><strong>{data.summary.inspection_count || 0}</strong><span>Trong khoảng đã chọn</span></AdminCard><AdminCard><small>Điểm trung bình</small><strong>{Number(data.summary.average_score || 0).toFixed(1)}</strong><span>Trên thang điểm 100</span></AdminCard><AdminCard><small>Không đạt</small><strong>{data.summary.failed_count || 0}</strong><span>Cần theo dõi khắc phục</span></AdminCard><AdminCard><small>Lỗi nghiêm trọng</small><strong>{data.summary.critical_count || 0}</strong><span>Ưu tiên xử lý ngay</span></AdminCard></div>
      <AdminCard className="checklist-report-table-card"><header><div><h3>Kết quả theo chi nhánh</h3><p>Chi nhánh điểm thấp được xếp lên đầu.</p></div></header>{state.loading ? <AdminEmptyState message="Đang tổng hợp dữ liệu…" /> : data.branches.length ? <div className="checklist-admin-table-wrap"><table className="checklist-admin-table"><thead><tr><th>Chi nhánh</th><th>Lượt kiểm tra</th><th>Điểm TB</th><th>Không đạt</th><th>Lần gần nhất</th></tr></thead><tbody>{data.branches.map((row) => <tr key={row.branch_uuid}><td><strong>{row.branch_name}</strong></td><td>{row.inspection_count}</td><td><AdminBadge tone={scoreTone(row.average_score)}>{Number(row.average_score).toFixed(1)}</AdminBadge></td><td>{row.failed_count}</td><td>{formatDate(row.last_inspected_at)}</td></tr>)}</tbody></table></div> : <AdminEmptyState message="Chưa có lượt kiểm tra trong khoảng ngày này." />}</AdminCard>
    </> : null}
    {view === "history" ? <AdminCard className="checklist-report-table-card"><header><div><h3>Lịch sử kiểm tra</h3><p>Tối đa 100 biên bản gần nhất trong khoảng ngày.</p></div></header>{state.loading ? <AdminEmptyState message="Đang tải lịch sử…" /> : data.history.length ? <div className="checklist-admin-table-wrap"><table className="checklist-admin-table"><thead><tr><th>Biên bản</th><th>Chi nhánh</th><th>Nhân viên</th><th>Điểm</th><th>Vấn đề</th><th>Ảnh</th></tr></thead><tbody>{data.history.map((row) => <tr key={row.id}><td><strong>{row.inspection_code}</strong><small>{formatDate(row.submitted_at)}</small></td><td>{row.branch_name}</td><td>{(row.employees || []).join(", ") || "Không ghi nhận"}</td><td><AdminBadge tone={scoreTone(row.score)}>{Number(row.score).toFixed(1)} · {row.rating}</AdminBadge></td><td>{row.issue_count}</td><td>{row.evidence_count}</td></tr>)}</tbody></table></div> : <AdminEmptyState message="Chưa có biên bản phù hợp." />}</AdminCard> : null}
    {view === "schedule" ? <AdminCard className="checklist-report-table-card"><header><div><h3>Lịch kiểm tra cửa hàng</h3><p>Cửa hàng chưa kiểm tra hoặc quá hạn được xếp lên đầu.</p></div></header>{state.loading ? <AdminEmptyState message="Đang kiểm tra lịch…" /> : <div className="checklist-schedule-list">{data.schedule.map((row) => <article key={row.branch_uuid} className={`schedule-row ${row.due_status}`}><div><strong>{row.branch_name}</strong><span>Lần gần nhất: {formatDate(row.last_inspected_at)}{row.last_score !== null && row.last_score !== undefined ? ` · ${Number(row.last_score).toFixed(1)} điểm` : ""}</span></div><div>{row.due_status === "never_checked" ? <AdminBadge tone="danger">Chưa từng kiểm tra</AdminBadge> : row.due_status === "overdue" ? <AdminBadge tone="danger">Quá hạn {row.overdue_days} ngày</AdminBadge> : row.due_status === "due_today" ? <AdminBadge tone="warning">Đến hạn hôm nay</AdminBadge> : <AdminBadge tone="neutral">Hạn {formatDate(row.next_inspection_due_on)}</AdminBadge>}</div></article>)}</div>}</AdminCard> : null}
  </div>;
}
