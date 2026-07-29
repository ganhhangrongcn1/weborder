import { useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import useSupervisionInspection from "../../hooks/useSupervisionInspection.js";
import { processUploadImage } from "../../utils/imageUpload.js";
import SignaturePad from "./SignaturePad.jsx";
import "../../styles/supervision.css";

const RESULT_OPTIONS = [
  { value: "pass", label: "Đạt", short: "✓" },
  { value: "improve", label: "Cần cải thiện", short: "!" },
  { value: "fail", label: "Không đạt", short: "×" },
  { value: "not_applicable", label: "Không áp dụng", short: "—" }
];

const RESULT_LABELS = { improve: "Cần cải thiện", fail: "Không đạt" };
const RESPONSIBILITY_LABELS = { store: "Lỗi chung cửa hàng", shift: "Lỗi chung trong ca", employees: "Nhân viên cụ thể" };

function formatInspectionDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function InspectionSummary({ inspection, items, supervisorName = inspection?.supervisorName, showConfirmationIntro = true }) {
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

function evidenceRequired(item, result) {
  return item.evidence_rule === "always" || (item.evidence_rule === "fail" && result === "fail") || (item.evidence_rule === "improve_or_fail" && ["improve", "fail"].includes(result));
}

function evidenceHint(item) {
  if (item.evidence_rule === "always") return { tone: "required", label: "Bắt buộc chụp ảnh" };
  if (item.evidence_rule === "fail") return { tone: "conditional", label: "Chụp ảnh nếu không đạt" };
  if (item.evidence_rule === "improve_or_fail") return { tone: "conditional", label: "Chụp khi cần cải thiện hoặc không đạt" };
  return null;
}

export default function SupervisionInspectionPage({ adminAuth }) {
  const flow = useSupervisionInspection();
  const [branchUuid, setBranchUuid] = useState("");
  const [employeeIds, setEmployeeIds] = useState([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [answerDraft, setAnswerDraft] = useState({});
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [signatureParticipantId, setSignatureParticipantId] = useState("");
  const [showNavigator, setShowNavigator] = useState(false);
  const [confirmationComments, setConfirmationComments] = useState({});
  const [finishMessage, setFinishMessage] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [resigningParticipantId, setResigningParticipantId] = useState("");
  const setup = flow.setup;
  const items = setup?.items || [];
  const currentItem = items[itemIndex];
  const currentAnswer = currentItem ? flow.inspection?.answers.find((answer) => answer.item_id === currentItem.id) : null;
  const persistedEmployeeIds = currentAnswer ? (flow.inspection?.answerEmployees || []).filter((link) => link.answer_id === currentAnswer.id).map((link) => flow.inspection.participants.find((participant) => participant.id === link.participant_id)?.employee_id).filter(Boolean) : [];
  const draft = currentItem ? (answerDraft[currentItem.id] || { result: currentAnswer?.result || "", note: currentAnswer?.note || "", employeeIds: persistedEmployeeIds, responsibilityScope: ["store", "shift", "employees"].includes(currentAnswer?.responsibility_scope) ? currentAnswer.responsibility_scope : "store" }) : null;
  const branchEmployees = useMemo(() => {
    const assignedIds = new Set((setup?.assignments || []).filter((assignment) => assignment.branch_uuid === branchUuid).map((assignment) => assignment.employee_id));
    return (setup?.employees || []).filter((employee) => assignedIds.has(employee.id));
  }, [branchUuid, setup]);
  const completedCount = flow.inspection?.answers.length || 0;
  const currentEvidence = currentAnswer ? flow.inspection.evidence.filter((item) => item.answer_id === currentAnswer.id) : [];
  const currentEvidenceHint = currentItem ? evidenceHint(currentItem) : null;
  const isEvidenceRequired = currentItem ? evidenceRequired(currentItem, draft.result) : false;
  const isEvidenceMissing = isEvidenceRequired && currentEvidence.length === 0;
  const confirmations = flow.inspection?.confirmations || [];
  const allParticipantsConfirmed = !flow.inspection || flow.inspection.participants.every((participant) => confirmations.some((item) => item.participant_id === participant.id));
  const selectedSignatureParticipant = flow.inspection?.participants.find((participant) => participant.id === signatureParticipantId) || flow.inspection?.participants[0] || null;
  const selectedSignatureConfirmation = selectedSignatureParticipant ? confirmations.find((item) => item.participant_id === selectedSignatureParticipant.id && item.confirmation_method === "signature") : null;
  const isResponsibilityMissing = ["improve", "fail"].includes(draft?.result) && draft.responsibilityScope === "employees" && draft.employeeIds.length === 0;
  const sectionGroups = (setup?.sections || []).map((section) => ({ ...section, items: items.map((item, index) => ({ ...item, index })).filter((item) => item.section_id === section.id) })).filter((section) => section.items.length);

  function toggleEmployee(employeeId) {
    setEmployeeIds((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]);
  }

  function updateDraft(patch) {
    setAnswerDraft((current) => ({ ...current, [currentItem.id]: { ...draft, ...patch } }));
  }

  async function chooseResult(result) {
    const next = { ...draft, result };
    const answerId = await flow.saveAnswer({ inspectionId: flow.inspection.inspection.id, itemId: currentItem.id, result, note: next.note, responsibilityScope: ["improve", "fail"].includes(result) ? next.responsibilityScope : "store", employeeIds: ["improve", "fail"].includes(result) && next.responsibilityScope === "employees" ? next.employeeIds : [] });
    if (answerId) updateDraft({ result });
  }

  async function saveCurrentNote() {
    if (!draft.result) return;
    await flow.saveAnswer({ inspectionId: flow.inspection.inspection.id, itemId: currentItem.id, result: draft.result, note: draft.note, responsibilityScope: draft.responsibilityScope, employeeIds: draft.responsibilityScope === "employees" ? draft.employeeIds : [] });
  }

  async function selectResponsibilityScope(scope) {
    const nextEmployeeIds = scope === "employees" ? draft.employeeIds : [];
    updateDraft({ responsibilityScope: scope, employeeIds: nextEmployeeIds });
    if (draft.result) await flow.saveAnswer({ inspectionId: flow.inspection.inspection.id, itemId: currentItem.id, result: draft.result, note: draft.note, responsibilityScope: scope, employeeIds: scope === "employees" ? nextEmployeeIds : [] });
  }

  async function toggleResponsibleEmployee(employeeId) {
    const nextEmployeeIds = draft.employeeIds.includes(employeeId) ? draft.employeeIds.filter((id) => id !== employeeId) : [...draft.employeeIds, employeeId];
    updateDraft({ employeeIds: nextEmployeeIds, responsibilityScope: "employees" });
    if (draft.result) await flow.saveAnswer({ inspectionId: flow.inspection.inspection.id, itemId: currentItem.id, result: draft.result, note: draft.note, responsibilityScope: "employees", employeeIds: nextEmployeeIds });
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file || !currentAnswer) return;
    if (file.size > 15 * 1024 * 1024) return updateDraft({ fileError: "Ảnh gốc vượt quá 15 MB. Anh/chị vui lòng chọn ảnh nhỏ hơn." });
    try {
      updateDraft({ fileError: "", uploadInfo: "Đang tối ưu ảnh trước khi tải lên…" });
      const processed = await processUploadImage(file, { maxWidth: 1600, quality: 0.72 });
      if (processed.size > 3 * 1024 * 1024) throw new Error("Ảnh sau khi nén vẫn vượt quá 3 MB. Anh/chị vui lòng chụp lại ở độ phân giải thấp hơn.");
      const uploaded = await flow.uploadEvidence({ inspectionId: flow.inspection.inspection.id, answerId: currentAnswer.id, file: processed.file });
      if (uploaded) updateDraft({ fileError: "", uploadInfo: `Đã tối ưu và tải ảnh · ${(processed.size / 1024).toFixed(0)} KB` });
    } catch (error) {
      updateDraft({ fileError: error.message || "Không thể xử lý ảnh.", uploadInfo: "" });
    } finally {
      event.target.value = "";
    }
  }

  async function toggleConfirmation(participant) {
    const current = confirmations.find((item) => item.participant_id === participant.id);
    await flow.confirmParticipant({ inspectionId: flow.inspection.inspection.id, participantId: participant.id, confirmed: !current, method: "confirmed", employeeComment: confirmationComments[participant.id] ?? current?.employee_comment ?? "" });
  }

  async function saveConfirmationComment(participant) {
    const current = confirmations.find((item) => item.participant_id === participant.id);
    if (!current) return;
    await flow.confirmParticipant({ inspectionId: flow.inspection.inspection.id, participantId: participant.id, confirmed: true, method: current.confirmation_method, signatureObjectPath: current.signature_object_path, employeeComment: confirmationComments[participant.id] ?? current.employee_comment ?? "" });
  }

  async function saveSignature(file) {
    if (!selectedSignatureParticipant) return;
    const current = confirmations.find((item) => item.participant_id === selectedSignatureParticipant.id);
    const saved = await flow.signParticipant({ inspectionId: flow.inspection.inspection.id, participantId: selectedSignatureParticipant.id, file, employeeComment: confirmationComments[selectedSignatureParticipant.id] ?? current?.employee_comment ?? "" });
    if (saved) {
      setFinishMessage(`${selectedSignatureParticipant.employee_name_snapshot} đã ký tên và được tự động xác nhận.`);
      setResigningParticipantId("");
    }
    return saved;
  }

  async function handleFinish() {
    setFinishMessage("");
    const unansweredIndex = items.findIndex((item) => !flow.inspection.answers.some((answer) => answer.item_id === item.id));
    if (unansweredIndex >= 0) {
      setItemIndex(unansweredIndex);
      setFinishMessage(`Còn tiêu chí ${unansweredIndex + 1}/${items.length} chưa được đánh giá.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (isEvidenceMissing) {
      setFinishMessage("Tiêu chí hiện tại bắt buộc phải có ảnh bằng chứng.");
      return;
    }
    if (isResponsibilityMissing) {
      setFinishMessage("Vui lòng chọn nhân viên liên quan hoặc chuyển lỗi sang phạm vi chung.");
      return;
    }
    if (!allParticipantsConfirmed) {
      setFinishMessage("Cần xác nhận đầy đủ nhân viên trong ca trước khi hoàn tất.");
      document.querySelector(".inspection-closing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    await flow.finish(inspectionNotes);
  }

  if (flow.loading) return <main className="supervision-state"><div className="supervision-spinner" /><h1>Đang chuẩn bị checklist</h1></main>;

  if (flow.result) return <main className="supervision-result"><div className="result-mark">✓</div><p>Đã hoàn tất kiểm tra</p><h1>{flow.result.score} điểm</h1><strong>{flow.result.rating}</strong><span>Lần kiểm tra tiếp theo đã được hẹn sau {setup?.template?.inspection_interval_days || 2} ngày.</span><div><button type="button" className="secondary" onClick={() => setShowReport(true)}>Xem lại biên bản</button><button type="button" onClick={() => window.location.reload()}>Tạo kiểm tra mới</button></div>{showReport ? <div className="inspection-report-backdrop" onMouseDown={() => setShowReport(false)}><aside className="inspection-report-sheet" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Biên bản {flow.inspection.inspection.inspection_code}</strong><small>{flow.inspection.inspection.branch_name_snapshot}</small></div><button type="button" onClick={() => setShowReport(false)}>×</button></header><div><InspectionSummary inspection={flow.inspection} items={items} showConfirmationIntro={false} /></div></aside></div> : null}</main>;

  if (!flow.inspection) return <main className="supervision-setup">
    <header><div className="supervision-brand"><span><img src="/pwa-icon-192.png" alt="Logo Gánh Hàng Rong" /></span><div><strong>Kiểm tra cửa hàng</strong><small>{adminAuth?.adminProfile?.name || adminAuth?.adminProfile?.email || "Giám sát"}</small></div></div><button type="button" onClick={adminAuth?.onAdminLogout}><Icon name="logout" size={18} /></button></header>
    <section className="setup-content"><p className="supervision-kicker">Bắt đầu biên bản</p><h1>Hôm nay kiểm tra cửa hàng nào?</h1><p>Chọn chi nhánh và những nhân viên đang có mặt tại thời điểm kiểm tra.</p>
      <label className="supervision-field"><span>Chi nhánh *</span><select value={branchUuid} onChange={(event) => { setBranchUuid(event.target.value); setEmployeeIds([]); }}><option value="">Chọn chi nhánh</option>{setup?.branches.map((branch) => <option key={branch.branch_uuid} value={branch.branch_uuid}>{branch.name}</option>)}</select></label>
      {setup?.drafts?.length ? <section className="draft-inspections"><strong>Biên bản đang làm dở</strong>{setup.drafts.map((item) => <button type="button" key={item.id} disabled={flow.working} onClick={() => flow.resume(item.id)}><span>{item.branch_name_snapshot}<small>{item.inspection_code}</small></span><b>Tiếp tục →</b></button>)}</section> : null}
      {branchUuid ? <fieldset className="supervision-employees"><legend>Nhân viên có mặt</legend>{branchEmployees.length ? branchEmployees.map((employee) => <label key={employee.id}><input type="checkbox" checked={employeeIds.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} /><span><strong>{employee.full_name}</strong><small>{employee.employee_code} · {employee.position_name}</small></span></label>) : <p>Chi nhánh này chưa có nhân viên đang hoạt động.</p>}</fieldset> : null}
      {flow.error ? <p className="supervision-error">{flow.error}</p> : null}
      <button className="supervision-primary" type="button" disabled={!branchUuid || flow.working} onClick={() => flow.begin(branchUuid, employeeIds)}>{flow.working ? "Đang tạo biên bản…" : `Bắt đầu kiểm tra · ${items.length} tiêu chí`}</button>
    </section>
  </main>;

  return <main className="supervision-check">
    <header className="check-header"><button type="button" onClick={() => window.location.reload()}><Icon name="arrow-left" size={18} /></button><div><strong>{flow.inspection.inspection.branch_name_snapshot}</strong><small>Đã lưu {completedCount}/{items.length} tiêu chí</small></div><button type="button" className="check-report-trigger" onClick={() => setShowReport(true)}><span>Biên bản</span><b>{flow.inspection.answers.filter((answer) => ["improve", "fail"].includes(answer.result)).length} lỗi</b></button><button type="button" className="check-navigator-trigger" onClick={() => setShowNavigator(true)}><span>Danh mục</span><b>{itemIndex + 1}/{items.length}</b></button></header>
    <div className="check-progress"><span style={{ width: `${(completedCount / Math.max(items.length, 1)) * 100}%` }} /></div>
    <section className="criterion-card">
      <div className="criterion-topline"><span>{currentItem.item_code}</span><span>Tiêu chí {itemIndex + 1}/{items.length}</span><strong>{Number(currentItem.weight)} điểm</strong></div>
      {currentEvidenceHint ? <div className={`evidence-rule-badge ${currentEvidenceHint.tone}`}><Icon name="camera" size={16} /><strong>{currentEvidenceHint.label}</strong></div> : null}
      <h1>{currentItem.content}</h1>{currentItem.guidance ? <p>{currentItem.guidance}</p> : null}
      {currentItem.is_critical ? <div className="critical-notice">⚠ Tiêu chí nghiêm trọng</div> : null}
      <div className="result-grid">{RESULT_OPTIONS.map((option) => <button type="button" key={option.value} className={`${option.value}${draft.result === option.value ? " selected" : ""}`} disabled={flow.working} onClick={() => chooseResult(option.value)}><b>{option.short}</b><span>{option.label}</span></button>)}</div>
      {["improve", "fail"].includes(draft.result) ? <section className="responsibility-scope"><div><strong>Lỗi này thuộc về ai?</strong><small>Không chọn nhân viên không đồng nghĩa với phạt cả ca.</small></div><div className="responsibility-scope-options"><button type="button" className={draft.responsibilityScope === "store" ? "selected" : ""} onClick={() => selectResponsibilityScope("store")}><b>🏪</b><span><strong>Lỗi chung cửa hàng</strong><small>Lỗi hệ thống, thiết bị hoặc điều kiện chung</small></span></button><button type="button" className={draft.responsibilityScope === "shift" ? "selected" : ""} onClick={() => selectResponsibilityScope("shift")}><b>👥</b><span><strong>Lỗi chung trong ca</strong><small>Nhắc nhở cả ca, không trừ điểm cá nhân</small></span></button><button type="button" className={draft.responsibilityScope === "employees" ? "selected" : ""} onClick={() => selectResponsibilityScope("employees")}><b>👤</b><span><strong>Nhân viên cụ thể</strong><small>Chọn người chịu trách nhiệm</small></span></button></div>{draft.responsibilityScope === "employees" ? flow.inspection.participants.length ? <fieldset className="responsibility-picker"><legend>Nhân viên liên quan *</legend>{flow.inspection.participants.map((participant) => <label key={participant.employee_id}><input type="checkbox" checked={draft.employeeIds.includes(participant.employee_id)} onChange={() => toggleResponsibleEmployee(participant.employee_id)} /><span>{participant.employee_name_snapshot}</span></label>)}</fieldset> : <p className="supervision-error">Biên bản chưa có nhân viên trong ca để gắn lỗi.</p> : null}{isResponsibilityMissing ? <p className="responsibility-warning">Vui lòng chọn ít nhất một nhân viên hoặc chuyển sang lỗi chung.</p> : null}</section> : null}
      <label className="note-field"><span>Ghi chú</span><textarea rows="3" value={draft.note} placeholder="Mô tả tình trạng thực tế…" onChange={(event) => updateDraft({ note: event.target.value })} onBlur={saveCurrentNote} /></label>
      <div className={`photo-row${isEvidenceRequired ? " required" : ""}`}><div><strong>Ảnh bằng chứng {isEvidenceRequired ? <b className="evidence-required-mark">*</b> : null}</strong><small>{currentEvidence.length ? `Đã tải ${currentEvidence.length} ảnh` : isEvidenceRequired ? "Bắt buộc chụp ảnh trước khi tiếp tục" : "Chụp trực tiếp hoặc chọn từ thư viện"}</small>{draft.uploadInfo ? <em>{draft.uploadInfo}</em> : null}</div><label className={currentAnswer ? "" : "disabled"}><Icon name="camera" size={19} /> {currentEvidence.length ? "Chụp thêm" : "Chụp ảnh"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!currentAnswer || flow.working} onChange={handlePhoto} /></label></div>
      {currentEvidence.length ? <div className="evidence-preview-list">{currentEvidence.map((evidence, index) => <article key={evidence.id}>{evidence.signed_url ? <img src={evidence.signed_url} alt={`Ảnh bằng chứng ${index + 1}`} /> : <span><Icon name="camera" size={18} /></span>}<div><strong>Ảnh {index + 1}</strong><small>{Math.round(evidence.file_size_bytes / 1024)} KB</small></div><button type="button" disabled={flow.working} onClick={() => flow.deleteEvidence(evidence)}>Xóa để chụp lại</button></article>)}</div> : null}
      {draft.fileError ? <p className="supervision-error">{draft.fileError}</p> : null}{flow.error ? <p className="supervision-error">{flow.error}</p> : null}
    </section>
    {itemIndex === items.length - 1 && finishMessage ? <p className="finish-guidance">{finishMessage}</p> : null}
    {itemIndex === items.length - 1 ? <InspectionSummary inspection={flow.inspection} items={items} /> : null}
    <footer className="check-footer"><button type="button" disabled={itemIndex === 0} onClick={() => setItemIndex((value) => value - 1)}>← Trước</button>{itemIndex < items.length - 1 ? <button type="button" className="next" disabled={!draft.result || isEvidenceMissing || isResponsibilityMissing} onClick={() => setItemIndex((value) => value + 1)}>Tiếp theo →</button> : <button type="button" className="finish" disabled={flow.working} onClick={handleFinish}>{flow.working ? "Đang hoàn tất…" : "Hoàn tất kiểm tra"}</button>}</footer>
    {itemIndex === items.length - 1 ? <section className="inspection-closing">
      <div><h2>Xác nhận cuối biên bản</h2><p>Nhân viên đọc lại nội dung, có thể ghi ý kiến và xác nhận trực tiếp trên điện thoại.</p></div>
      {flow.inspection.participants.length ? <div className="participant-confirmations">{flow.inspection.participants.map((participant) => {
        const confirmation = confirmations.find((item) => item.participant_id === participant.id);
        const comment = confirmationComments[participant.id] ?? confirmation?.employee_comment ?? "";
        return <article key={participant.id} className={confirmation ? "confirmed" : ""}><label><input type="checkbox" checked={Boolean(confirmation)} disabled={flow.working || confirmation?.confirmation_method === "signature"} onChange={() => toggleConfirmation(participant)} /><span><strong>{participant.employee_name_snapshot}</strong><small>{confirmation?.confirmation_method === "signature" ? "Đã ký tên · đã khóa" : confirmation ? "Đã xác nhận" : "Chưa xác nhận"}</small></span></label><textarea rows="2" value={comment} placeholder="Ý kiến của nhân viên nếu có…" onChange={(event) => setConfirmationComments((current) => ({ ...current, [participant.id]: event.target.value }))} onBlur={() => saveConfirmationComment(participant)} /></article>;
      })}</div> : <p className="no-participants">Biên bản không có nhân viên trong ca để xác nhận.</p>}
      {flow.inspection.participants.length ? <div className="signature-choice"><label><span>Người ký tên</span><select value={selectedSignatureParticipant?.id || ""} onChange={(event) => { setSignatureParticipantId(event.target.value); setResigningParticipantId(""); }}>{flow.inspection.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.employee_name_snapshot}</option>)}</select></label>{selectedSignatureParticipant ? selectedSignatureConfirmation && resigningParticipantId !== selectedSignatureParticipant.id ? <section className="saved-signature"><div>{selectedSignatureConfirmation.signature_signed_url ? <img src={selectedSignatureConfirmation.signature_signed_url} alt={`Chữ ký của ${selectedSignatureParticipant.employee_name_snapshot}`} /> : <span>✓</span>}</div><strong>{selectedSignatureParticipant.employee_name_snapshot} đã ký tên</strong><small>Chữ ký đã được khóa để tránh chỉnh sửa ngoài ý muốn.</small><button type="button" onClick={() => setResigningParticipantId(selectedSignatureParticipant.id)}>Ký lại</button></section> : <SignaturePad signerName={selectedSignatureParticipant.employee_name_snapshot} disabled={flow.working} onSave={saveSignature} /> : null}</div> : null}
      <label className="final-notes"><span>Ghi chú của người giám sát</span><textarea rows="4" value={inspectionNotes} placeholder="Ghi nhận tình hình chung, nội dung đã trao đổi hoặc hướng xử lý…" onChange={(event) => setInspectionNotes(event.target.value)} /></label>
      {!allParticipantsConfirmed ? <p className="supervision-error">Cần xác nhận đầy đủ nhân viên trong ca trước khi hoàn tất.</p> : null}
    </section> : null}
    {showNavigator ? <div className="checklist-navigator-backdrop" onMouseDown={() => setShowNavigator(false)}><aside className="checklist-navigator" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Danh mục checklist</strong><small>Chọn nhanh tiêu chí cần xem lại</small></div><button type="button" onClick={() => setShowNavigator(false)}>×</button></header><div>{sectionGroups.map((section) => <section key={section.id}><h3>{section.name}</h3><div>{section.items.map((item) => { const answer = flow.inspection.answers.find((entry) => entry.item_id === item.id); return <button type="button" key={item.id} className={`${item.index === itemIndex ? "current" : ""}${answer ? " answered" : ""}`} onClick={() => { setItemIndex(item.index); setShowNavigator(false); }}><span>{item.index + 1}</span><div><strong>{item.item_code}</strong><small>{item.content}</small></div><b>{answer ? "✓" : ""}</b></button>; })}</div></section>)}</div></aside></div> : null}
    {showReport ? <div className="inspection-report-backdrop" onMouseDown={() => setShowReport(false)}><aside className="inspection-report-sheet" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Biên bản {flow.inspection.inspection.inspection_code}</strong><small>{flow.inspection.inspection.branch_name_snapshot}</small></div><button type="button" onClick={() => setShowReport(false)}>×</button></header><div><InspectionSummary inspection={flow.inspection} items={items} showConfirmationIntro={false} /></div></aside></div> : null}
  </main>;
}
