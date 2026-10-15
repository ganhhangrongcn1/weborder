import { AdminCard } from "../ui/AdminCommon.jsx";

function Breakdown({ title, description, items, total, onSelect }) {
  return <AdminCard className="recruitment-dashboard-panel"><header><h3>{title}</h3><p>{description}</p></header>
    {!items.length ? <p className="admin-recruitment-muted">Chưa có dữ liệu trong bộ lọc này.</p> : <ul className="recruitment-bar-list">{items.map((item) => {
      const count = Number(item.count) || 0;
      const percentage = total ? Math.round(count / total * 100) : 0;
      const content = <><span className="recruitment-bar-label">{item.answer}</span><span className="recruitment-bar-value"><strong>{count}</strong><small>{percentage}%</small></span><span className="recruitment-bar-track" aria-hidden="true"><span style={{ width: `${Math.min(100, percentage)}%` }} /></span></>;
      return <li key={item.answer}>{onSelect ? <button type="button" onClick={() => onSelect(item.branch)} aria-label={`Lọc chi nhánh ${item.answer}: ${count} hồ sơ`}>{content}</button> : <div>{content}</div>}</li>;
    })}</ul>}
  </AdminCard>;
}
export default function RecruitmentSummary({ summary, branches = [], selectBranch }) {
  if (!summary) return null;
  const total = Number(summary.total) || 0;
  const failed = Number(summary.notificationFailed) || 0;
  const groups = new Map();
  for (const item of summary.choices || []) {
    // Branches have their own comparison; gender is never used to evaluate applicants.
    if (["branch", "gender"].includes(item.question_id)) continue;
    const key = `${item.question_id}:${item.label}`;
    if (!groups.has(key)) groups.set(key, { id: item.question_id, label: item.label, items: [] });
    groups.get(key).items.push(item);
  }
  const branchItems = branches.map((branch) => ({ branch, answer: branch.split(",")[0], count: Number(summary.branches?.find((row) => row.branch === branch)?.count) || 0 }));
  for (const row of summary.branches || []) {
    if (!branches.includes(row.branch)) branchItems.push({ branch: row.branch, answer: row.branch || "Chưa phân loại", count: Number(row.count) || 0 });
  }
  const activeBranches = branchItems.filter((item) => item.count > 0).length;
  const stats = [
    ["Tổng hồ sơ", total, "Theo chi nhánh và khoảng ngày đang chọn"],
    ["Chi nhánh có hồ sơ", activeBranches, `Trên ${branchItems.length} chi nhánh`],
    ["Thông báo cần kiểm tra", failed, "Lỗi hoặc chưa xác nhận kết quả gửi Zalo"]
  ];
  const orderedGroups = [...groups.values()].sort((a, b) => {
    const rank = (id) => ({ shifts: 0, workTypes: 1, education: 2 }[id] ?? 3);
    return rank(a.id) - rank(b.id);
  });
  return <div className="recruitment-dashboard">
    <header className="recruitment-dashboard-heading"><div><span className="recruitment-detail-eyebrow">TỔNG QUAN TUYỂN DỤNG</span><h2>Hồ sơ ứng tuyển tại Gánh</h2><p>Số liệu tính trên toàn bộ hồ sơ trong bộ lọc, không chỉ trang đang xem.</p></div></header>
    <div className="recruitment-kpi-grid">{stats.map(([label, value, note]) => <AdminCard key={label} className="recruitment-kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></AdminCard>)}</div>
    {!total && <div className="recruitment-dashboard-empty"><h3>Chưa có hồ sơ trong bộ lọc này</h3><p>Thử mở rộng khoảng ngày hoặc chọn tất cả chi nhánh.</p></div>}
    <div className="recruitment-dashboard-grid">
      <Breakdown title="Hồ sơ theo chi nhánh" description="Bấm vào chi nhánh để lọc dashboard và danh sách hồ sơ." items={branchItems} total={total} onSelect={selectBranch} />
      {orderedGroups.map((group) => <Breakdown key={`${group.id}:${group.label}`} title={group.label} description="Số lượt chọn / tổng hồ sơ. Câu nhiều lựa chọn có thể có tổng tỷ lệ trên 100%." items={[...group.items].sort((a, b) => Number(b.count) - Number(a.count))} total={total} />)}
    </div>
  </div>;
}
