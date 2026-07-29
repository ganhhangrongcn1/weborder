import { useCallback, useEffect, useMemo, useState } from "react";
import { loadChecklistBranchTrendReport } from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminSelect } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(days) { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—"; }
function signed(value) { const number = Number(value || 0); return `${number > 0 ? "+" : ""}${number.toFixed(1)}`; }
function scoreTone(score) { return Number(score) >= 80 ? "success" : Number(score) >= 70 ? "warning" : "danger"; }

export default function AdminBranchTrendReport({ branches = [] }) {
  const [filters, setFilters] = useState({ dateFrom: daysAgo(89), dateTo: today(), branchUuid: "" });
  const [state, setState] = useState({ data: null, loading: true, error: "", selectedIssue: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await loadChecklistBranchTrendReport(filters);
      setState((current) => ({ ...current, data, loading: false, error: "" }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được báo cáo xu hướng." }));
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const data = state.data || { summary: {}, trend: [], branches: [], repeated_issues: [] };
  const summary = data.summary || {};

  return <div className="branch-trend-page">
    <div className="report-scope-banner"><div><strong>Xu hướng chất lượng cửa hàng</strong><span>Giúp quản lý nhận ra chi nhánh đang đi xuống và lỗi nào thường xuyên quay lại.</span></div><AdminBadge tone="neutral">Cập nhật theo biên bản đã hoàn tất</AdminBadge></div>
    <div className="checklist-report-filters"><label><span>Từ ngày</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label><label><span>Đến ngày</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label><label><span>Chi nhánh</span><AdminSelect value={filters.branchUuid} onChange={(event) => setFilters({ ...filters, branchUuid: event.target.value })} options={[{ value: "", label: "Tất cả chi nhánh" }, ...branches.map((branch) => ({ value: branch.branch_uuid || branch.id, label: branch.name }))]} /></label><AdminButton variant="secondary" onClick={load}>Làm mới</AdminButton></div>
    {state.error ? <p className="checklist-admin-message error">{state.error}</p> : null}
    <div className="trend-kpis">
      <TrendKpi label="Điểm trung bình" value={Number(summary.average_score || 0).toFixed(1)} change={summary.score_change} goodWhenPositive hasPrevious={summary.has_previous_data} />
      <TrendKpi label="Lượt kiểm tra" value={summary.inspection_count || 0} change={summary.inspection_change} hasPrevious={summary.has_previous_data} />
      <TrendKpi label="Tổng lượt lỗi" value={summary.issue_count || 0} change={summary.issue_change} goodWhenPositive={false} hasPrevious={summary.has_previous_data} />
      <TrendKpi label="Lỗi lặp lại" value={summary.repeated_issue_count || 0} subtitle="Cùng lỗi từ 2 lần trở lên" />
    </div>
    <div className="trend-dashboard-grid">
      <AdminCard className="trend-chart-card"><header><div><h3>Xu hướng điểm theo tuần</h3><p>Đường đi lên cho thấy chất lượng vận hành đang cải thiện.</p></div></header>{state.loading ? <AdminEmptyState message="Đang tổng hợp xu hướng…" /> : <ScoreTrendChart rows={data.trend || []} />}</AdminCard>
      <AdminCard className="branch-ranking-card"><header><div><h3>So sánh chi nhánh</h3><p>Ưu tiên xem chi nhánh điểm thấp hoặc đang giảm.</p></div></header>{data.branches?.length ? <div>{data.branches.map((branch) => <article key={branch.branch_uuid}><div><strong>{branch.branch_name}</strong><small>{branch.inspection_count} lượt kiểm tra · {branch.issue_count} lỗi</small></div><span><AdminBadge tone={scoreTone(branch.average_score)}>{Number(branch.average_score).toFixed(1)}</AdminBadge><small className={Number(branch.score_change) < 0 ? "negative" : "positive"}>{signed(branch.score_change)} điểm</small></span></article>)}</div> : <AdminEmptyState message="Chưa có dữ liệu chi nhánh." />}</AdminCard>
    </div>
    <AdminCard className="repeated-issues-card"><header><div><h3>Lỗi lặp lại theo chi nhánh</h3><p>Chỉ hiển thị lỗi xuất hiện từ 2 lần trong khoảng ngày đã chọn.</p></div></header>{state.loading ? <AdminEmptyState message="Đang tìm lỗi lặp lại…" /> : data.repeated_issues?.length ? <div className="repeated-issues-table">{data.repeated_issues.map((issue) => <button type="button" key={`${issue.branch_uuid}-${issue.item_code}`} onClick={() => setState((current) => ({ ...current, selectedIssue: issue }))}><code>{issue.item_code}</code><span><strong>{issue.content}</strong><small>{issue.branch_name} · lần gần nhất {formatDate(issue.latest_at)}</small></span><b>{issue.occurrence_count} lần</b><em>{issue.failed_count} không đạt</em></button>)}</div> : <AdminEmptyState message="Chưa phát hiện lỗi lặp lại trong khoảng này." />}</AdminCard>
    {state.selectedIssue ? <IssueHistoryModal issue={state.selectedIssue} onClose={() => setState((current) => ({ ...current, selectedIssue: null }))} /> : null}
  </div>;
}

function TrendKpi({ label, value, change, goodWhenPositive, subtitle, hasPrevious = true }) {
  const numericChange = Number(change || 0);
  const favorable = goodWhenPositive === undefined || numericChange === 0 ? "neutral" : (numericChange > 0) === goodWhenPositive ? "positive" : "negative";
  return <AdminCard><small>{label}</small><strong>{value}</strong>{subtitle ? <span>{subtitle}</span> : hasPrevious ? <span className={favorable}>{signed(numericChange)} so với kỳ trước</span> : <span>Chưa có dữ liệu kỳ trước</span>}</AdminCard>;
}

function ScoreTrendChart({ rows }) {
  const points = useMemo(() => {
    if (!rows.length) return [];
    const width = 600; const height = 180; const padding = 24;
    return rows.map((row, index) => ({
      ...row,
      x: rows.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (rows.length - 1)),
      y: height - padding - (Math.max(0, Math.min(100, Number(row.average_score))) / 100) * (height - padding * 2)
    }));
  }, [rows]);
  if (!points.length) return <AdminEmptyState message="Chưa đủ dữ liệu để vẽ xu hướng." />;
  return <div className="score-trend-chart"><svg viewBox="0 0 600 180" role="img" aria-label="Biểu đồ xu hướng điểm trung bình theo tuần"><line x1="24" y1="44" x2="576" y2="44" /><line x1="24" y1="102" x2="576" y2="102" /><line x1="24" y1="156" x2="576" y2="156" /><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point) => <g key={point.period_start}><circle cx={point.x} cy={point.y} r="5" /><text x={point.x} y={Math.max(14, point.y - 10)}>{Number(point.average_score).toFixed(1)}</text></g>)}</svg><div>{points.map((point) => <span key={point.period_start}>{formatDate(point.period_start)}<small>{point.inspection_count} lượt</small></span>)}</div></div>;
}

function IssueHistoryModal({ issue, onClose }) {
  return <div className="checklist-admin-modal-backdrop" onMouseDown={onClose}><section className="checklist-admin-modal trend-issue-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>{issue.content}</h2><p>{issue.branch_name} · {issue.occurrence_count} lần xuất hiện</p></div><button type="button" onClick={onClose}>×</button></header><div className="issue-occurrence-list">{(issue.occurrences || []).map((row) => <article key={row.answer_id}><div className="issue-occurrence-meta"><div><strong>{formatDate(row.occurred_at)}</strong><small>{row.inspection_code}</small></div><AdminBadge tone={row.result === "fail" ? "danger" : "warning"}>{row.result === "fail" ? "Không đạt" : "Cần cải thiện"}</AdminBadge></div>{row.note ? <p>{row.note}</p> : <p className="issue-no-image">Không có ghi chú.</p>}{row.evidence_urls?.length ? <div className="issue-evidence-gallery">{row.evidence_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Ảnh lỗi ${index + 1}`} /></a>)}</div> : <p className="issue-no-image">Không có ảnh bằng chứng.</p>}</article>)}</div></section></div>;
}
