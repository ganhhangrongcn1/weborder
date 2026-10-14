export default function RecruitmentSummary({ summary }) {
  if (!summary) return null;
  const groups = new Map();
  for (const item of summary.choices || []) {
    const key = `${item.question_id}:${item.label}`;
    if (!groups.has(key)) groups.set(key, { label: item.label, items: [] });
    groups.get(key).items.push(item);
  }
  return (
    <div className="admin-recruitment-summary">
      <p><strong>{summary.total}</strong> hồ sơ trong bộ lọc · <strong>{summary.notificationFailed}</strong> thông báo cần kiểm tra</p>
      {!summary.total ? <p>Chưa có hồ sơ trong khoảng lọc này.</p> : [...groups.entries()].map(([key, group]) => (
        <section key={key}><h3>{group.label}</h3><p className="admin-recruitment-muted">Số lượt chọn; câu nhiều lựa chọn có thể có nhiều lượt trên một hồ sơ.</p>
          {group.items.sort((a, b) => b.count - a.count).map((item) => (
            <div key={item.answer} className="admin-recruitment-chart-row"><span>{item.answer}</span><strong>{item.count}</strong>
              <meter value={Number(item.count)} min={0} max={Math.max(1, Number(summary.total))} aria-label={`${item.answer}: ${item.count} lượt chọn`} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
