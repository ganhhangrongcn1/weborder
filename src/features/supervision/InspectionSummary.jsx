const RESULT_LABELS = { improve: "Cần cải thiện", fail: "Không đạt" };
const RESPONSIBILITY_LABELS = { store: "Lỗi chung cửa hàng", shift: "Lỗi chung trong ca", employees: "Nhân viên cụ thể" };

function formatInspectionDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function InspectionSummary({ inspection, items, supervisorName = inspection?.supervisorName, showConfirmationIntro = true }) {
  const issues = inspection.answers.filter((answer) => ["improve", "fail"].includes(answer.result)).map((answer) => {
    const linkedParticipantIds = new Set(inspection.answerEmployees.filter((link) => link.answer_id === answer.id).map((link) => link.participant_id));
    return {
      ...answer,
      item: items.find((item) => item.id === answer.item_id),
      responsibleNames: inspection.participants.filter((participant) => linkedParticipantIds.has(participant.id)).map((participant) => participant.employee_name_snapshot),
      evidence: inspection.evidence.filter((evidence) => evidence.answer_id === answer.id)
    };
  });

  return <div className="inspection-summary"><div><h2>Tổng hợp biên bản</h2><p>Có thể mở lại bất kỳ lúc nào để rà soát lỗi và ảnh bằng chứng.</p></div><dl className="inspection-summary-meta"><div><dt>Người giám sát</dt><dd>{supervisorName || "Chưa xác định"}</dd></div><div><dt>Ngày kiểm tra</dt><dd>{formatInspectionDate(inspection.inspection.started_at)}</dd></div><div><dt>Chi nhánh</dt><dd>{inspection.inspection.branch_name_snapshot}</dd></div><div><dt>Mã biên bản</dt><dd>{inspection.inspection.inspection_code}</dd></div></dl><div className="inspection-summary-stats"><span><strong>{inspection.answers.length}/{items.length}</strong><small>Tiêu chí đã kiểm tra</small></span><span><strong>{issues.length}</strong><small>Nội dung cần lưu ý</small></span></div>{issues.length ? <div className="inspection-issue-summary">{issues.map((issue, index) => <article key={issue.id}><header><span>{index + 1}</span><div><small>{issue.item?.item_code || "Tiêu chí"}</small><strong>{issue.item?.content || "Nội dung kiểm tra"}</strong></div><b className={issue.result}>{RESULT_LABELS[issue.result]}</b></header><dl><div><dt>Phạm vi</dt><dd>{RESPONSIBILITY_LABELS[issue.responsibility_scope] || RESPONSIBILITY_LABELS.store}</dd></div>{issue.responsibility_scope === "employees" ? <div><dt>Nhân viên liên quan</dt><dd>{issue.responsibleNames.join(", ") || "Chưa chọn nhân viên"}</dd></div> : null}{issue.note ? <div><dt>Ghi chú giám sát</dt><dd>{issue.note}</dd></div> : null}</dl>{issue.evidence.length ? <div className="summary-evidence">{issue.evidence.map((evidence, evidenceIndex) => evidence.signed_url ? <a key={evidence.id} href={evidence.signed_url} target="_blank" rel="noreferrer"><img src={evidence.signed_url} alt={`Ảnh lỗi ${index + 1}.${evidenceIndex + 1}`} /></a> : null)}</div> : <small className="summary-no-evidence">Không có ảnh bằng chứng</small>}</article>)}</div> : <p className="inspection-no-issues">✓ Chưa có nội dung cần cải thiện hoặc không đạt.</p>}{showConfirmationIntro ? <div className="confirmation-heading"><h2>Xác nhận cuối biên bản</h2><p>Sau khi đã đọc bảng tổng hợp, từng nhân viên có thể ghi ý kiến và xác nhận trực tiếp trên điện thoại.</p></div> : null}</div>;
}
