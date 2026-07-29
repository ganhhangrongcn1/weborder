import { useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import useSupervisionInspection from "../../hooks/useSupervisionInspection.js";
import { processUploadImage } from "../../utils/imageUpload.js";
import InspectionSummary from "./InspectionSummary.jsx";
import SignaturePad from "./SignaturePad.jsx";
import SupervisionWorkspace from "./SupervisionWorkspace.jsx";
import "../../styles/supervision.css";

const RESULT_OPTIONS = [
  { value: "pass", label: "Đạt", short: "✓" },
  { value: "improve", label: "Cần cải thiện", short: "!" },
  { value: "fail", label: "Không đạt", short: "×" },
  { value: "not_applicable", label: "Không áp dụng", short: "—" }
];

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
    const result = await flow.finish(inspectionNotes);
    if (result) setShowReport(true);
  }

  function renderConfirmationSection() {
    return <section className="inspection-closing inspection-closing--report">
      <div><h2>Xác nhận cuối biên bản</h2><p>Nhân viên đọc lại nội dung, có thể ghi ý kiến và xác nhận trực tiếp trên điện thoại.</p></div>
      {flow.inspection.participants.length ? <div className="participant-confirmations">{flow.inspection.participants.map((participant) => {
        const confirmation = confirmations.find((item) => item.participant_id === participant.id);
        const comment = confirmationComments[participant.id] ?? confirmation?.employee_comment ?? "";
        return <article key={participant.id} className={confirmation ? "confirmed" : ""}><label><input type="checkbox" checked={Boolean(confirmation)} disabled={flow.working || confirmation?.confirmation_method === "signature"} onChange={() => toggleConfirmation(participant)} /><span><strong>{participant.employee_name_snapshot}</strong><small>{confirmation?.confirmation_method === "signature" ? "Đã ký tên · đã khóa" : confirmation ? "Đã xác nhận" : "Chưa xác nhận"}</small></span></label><textarea rows="2" value={comment} placeholder="Ý kiến của nhân viên nếu có…" onChange={(event) => setConfirmationComments((current) => ({ ...current, [participant.id]: event.target.value }))} onBlur={() => saveConfirmationComment(participant)} /></article>;
      })}</div> : <p className="no-participants">Biên bản không có nhân viên trong ca để xác nhận.</p>}
      {flow.inspection.participants.length ? <div className="signature-choice"><label><span>Người ký tên</span><select value={selectedSignatureParticipant?.id || ""} onChange={(event) => { setSignatureParticipantId(event.target.value); setResigningParticipantId(""); }}>{flow.inspection.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.employee_name_snapshot}</option>)}</select></label>{selectedSignatureParticipant ? selectedSignatureConfirmation && resigningParticipantId !== selectedSignatureParticipant.id ? <section className="saved-signature"><div>{selectedSignatureConfirmation.signature_signed_url ? <img src={selectedSignatureConfirmation.signature_signed_url} alt={`Chữ ký của ${selectedSignatureParticipant.employee_name_snapshot}`} /> : <span>✓</span>}</div><strong>{selectedSignatureParticipant.employee_name_snapshot} đã ký tên</strong><small>Chữ ký đã được khóa để tránh chỉnh sửa ngoài ý muốn.</small><button type="button" onClick={() => setResigningParticipantId(selectedSignatureParticipant.id)}>Ký lại</button></section> : <SignaturePad signerName={selectedSignatureParticipant.employee_name_snapshot} disabled={flow.working} onSave={saveSignature} /> : null}</div> : null}
      <label className="final-notes"><span>Ghi chú của người giám sát</span><textarea rows="4" value={inspectionNotes} placeholder="Ghi nhận tình hình chung, nội dung đã trao đổi hoặc hướng xử lý…" onChange={(event) => setInspectionNotes(event.target.value)} /></label>
      {finishMessage ? <p className="finish-guidance finish-guidance--report">{finishMessage}</p> : null}
      {!allParticipantsConfirmed ? <p className="supervision-error">Cần xác nhận đầy đủ nhân viên trong ca trước khi hoàn tất.</p> : null}
      <button className="supervision-primary report-finish-button" type="button" disabled={flow.working} onClick={handleFinish}>{flow.working ? "Đang hoàn tất…" : "Hoàn tất kiểm tra"}</button>
    </section>;
  }

  if (flow.loading) return <main className="supervision-state"><div className="supervision-spinner" /><h1>Đang chuẩn bị checklist</h1></main>;

  if (flow.result) return <main className="supervision-result"><div className="result-mark">✓</div><p>Đã hoàn tất kiểm tra</p><h1>{flow.result.score} điểm</h1><strong>{flow.result.rating}</strong><span>Biên bản đã được lưu vào lịch sử và có thể mở lại bất kỳ lúc nào.</span><div><button type="button" className="secondary" onClick={() => setShowReport(true)}>Xem lại biên bản</button><button type="button" onClick={() => window.location.reload()}>Về tổng quan</button></div>{showReport ? <div className="inspection-report-backdrop" onMouseDown={() => setShowReport(false)}><aside className="inspection-report-sheet" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Biên bản {flow.inspection.inspection.inspection_code}</strong><small>{flow.inspection.inspection.branch_name_snapshot}</small></div><button type="button" onClick={() => setShowReport(false)}>×</button></header><div><InspectionSummary inspection={flow.inspection} items={items} showConfirmationIntro={false} /></div></aside></div> : null}</main>;

  if (!flow.inspection) return <><SupervisionWorkspace adminAuth={adminAuth} setup={setup} working={flow.working} error={flow.error} branchUuid={branchUuid} employeeIds={employeeIds} branchEmployees={branchEmployees} onBranchChange={(value) => { setBranchUuid(value); setEmployeeIds([]); }} onToggleEmployee={toggleEmployee} onBegin={() => flow.begin(branchUuid, employeeIds)} onResume={flow.resume} onViewReport={flow.viewHistory} />{flow.historyInspection ? <div className="inspection-report-backdrop" onMouseDown={flow.closeHistory}><aside className="inspection-report-sheet" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Biên bản {flow.historyInspection.inspection.inspection_code}</strong><small>{flow.historyInspection.inspection.branch_name_snapshot}</small></div><button type="button" onClick={flow.closeHistory}>×</button></header><div><InspectionSummary inspection={flow.historyInspection} items={flow.historyInspection.items} showConfirmationIntro={false} /></div></aside></div> : null}</>;

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
    <footer className="check-footer"><button type="button" disabled={itemIndex === 0} onClick={() => setItemIndex((value) => value - 1)}>← Trước</button>{itemIndex < items.length - 1 ? <button type="button" className="next" disabled={!draft.result || isEvidenceMissing || isResponsibilityMissing} onClick={() => setItemIndex((value) => value + 1)}>Tiếp theo →</button> : <button type="button" className="finish" disabled={flow.working} onClick={handleFinish}>{flow.working ? "Đang hoàn tất…" : "Hoàn tất kiểm tra"}</button>}</footer>
    {showNavigator ? <div className="checklist-navigator-backdrop" onMouseDown={() => setShowNavigator(false)}><aside className="checklist-navigator" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Danh mục checklist</strong><small>Chọn nhanh tiêu chí cần xem lại</small></div><button type="button" onClick={() => setShowNavigator(false)}>×</button></header><div>{sectionGroups.map((section) => <section key={section.id}><h3>{section.name}</h3><div>{section.items.map((item) => { const answer = flow.inspection.answers.find((entry) => entry.item_id === item.id); return <button type="button" key={item.id} className={`${item.index === itemIndex ? "current" : ""}${answer ? " answered" : ""}`} onClick={() => { setItemIndex(item.index); setShowNavigator(false); }}><span>{item.index + 1}</span><div><strong>{item.item_code}</strong><small>{item.content}</small></div><b>{answer ? "✓" : ""}</b></button>; })}</div></section>)}</div></aside></div> : null}
    {showReport ? <div className="inspection-report-backdrop" onMouseDown={() => setShowReport(false)}><aside className="inspection-report-sheet" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Biên bản {flow.inspection.inspection.inspection_code}</strong><small>{flow.inspection.inspection.branch_name_snapshot}</small></div><button type="button" onClick={() => setShowReport(false)}>×</button></header><div><InspectionSummary inspection={flow.inspection} items={items} showConfirmationIntro={false} />{completedCount === items.length ? renderConfirmationSection() : <section className="report-confirmation-locked"><strong>Hoàn thành checklist để xác nhận</strong><span>Còn {items.length - completedCount} tiêu chí chưa được đánh giá. Anh vẫn có thể xem lại toàn bộ lỗi đã ghi nhận ở phía trên.</span><button type="button" onClick={() => { setShowReport(false); setShowNavigator(true); }}>Xem tiêu chí còn thiếu</button></section>}</div></aside></div> : null}
  </main>;
}
