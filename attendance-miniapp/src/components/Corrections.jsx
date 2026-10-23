import { useState } from "react";
import { isZalo, pickBrowserFile, pickNative, downloadBlob, openPdf } from "../services/deviceService.js";
import { displayTime } from "./History.jsx";
import { employeeName } from "../services/attendancePresentation.js";

const toInput = (iso) => iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
const statuses = { pending: "Chờ quản lý", approved: "Đã duyệt", rejected: "Từ chối" };

function ReviewRow({ request, app }) {
  const [note, setNote] = useState("");
  const attachment = request.attachment;
  const view = () => app.run(async () => {
    if (attachment.native) throw new Error("Tệp này chưa được đồng bộ lên máy chủ. Vui lòng xem trên thiết bị đã chọn tệp.");
    if (attachment.type === "application/pdf") { await openPdf(attachment.data); return; }
    const response = await fetch(attachment.data); downloadBlob(await response.blob(), attachment.name);
  });
  return <article className="request-row"><div className="section-heading"><strong>{employeeName(request.name)}</strong><span className="badge">{statuses[request.status]}</span></div>
    <p>{request.reason}</p><p className="small">Đề nghị: {displayTime(request.checkIn)} → {request.checkOut ? displayTime(request.checkOut) : "Để ca mở"}</p>
    {attachment && <button disabled={app.busy} onClick={view}>Xem minh chứng: {attachment.name}</button>}
    {request.note && <p className="review-note">{employeeName(request.reviewer)}: {request.note}</p>}
    {app.actor.role === "manager" && request.status === "pending" && <div><label>Ý kiến quản lý<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Ghi rõ lý do duyệt hoặc từ chối"/></label><div className="button-row"><button className="primary" disabled={app.busy} onClick={() => app.review(request.id, "approved", note)}>Duyệt điều chỉnh</button><button disabled={app.busy} onClick={() => app.review(request.id, "rejected", note)}>Từ chối</button></div></div>}
  </article>;
}

export default function Corrections({ app }) {
  const mine = app.state.records.filter((r) => r.employeeId === app.actor.id);
  const [recordId, setRecordId] = useState(""); const [checkIn, setCheckIn] = useState(""); const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState(""); const [attachment, setAttachment] = useState(null);
  const requests = app.state.requests.filter((r) => app.actor.role === "manager" || r.employeeId === app.actor.id);
  const select = (id) => { const row = mine.find((r) => r.id === id); setRecordId(id); setCheckIn(toInput(row?.checkIn)); setCheckOut(toInput(row?.checkOut)); };
  const attach = (type) => app.run(async () => { const result = isZalo() ? await pickNative(type) : await pickBrowserFile(); if (result) setAttachment(result); });
  async function submit(event) {
    event.preventDefault();
    const result = await app.correction({ recordId, checkIn, checkOut, reason, attachment });
    if (result) { setReason(""); setAttachment(null); }
  }
  return <div className="check-grid">{app.actor.role === "employee" && <section className="card"><p className="eyebrow">Yêu cầu điều chỉnh</p><h2>Trao đổi lại giờ công</h2><form onSubmit={submit}>
    <label>Bản ghi cần điều chỉnh<select required value={recordId} onChange={(e) => select(e.target.value)}><option value="">Chọn ca làm</option>{mine.map((r) => <option key={r.id} value={r.id}>{displayTime(r.checkIn)}</option>)}</select></label>
    <label>Giờ vào đề nghị<input required type="datetime-local" value={checkIn} onInput={(e) => setCheckIn(e.target.value)} onChange={(e) => setCheckIn(e.target.value)}/></label><label>Giờ ra đề nghị<input type="datetime-local" value={checkOut} onInput={(e) => setCheckOut(e.target.value)} onChange={(e) => setCheckOut(e.target.value)}/></label>
    <label>Lý do<textarea required minLength={10} maxLength={1000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mô tả ca làm và lý do cần điều chỉnh"/></label>
    <p className="small">Đính kèm ảnh, PDF hoặc video làm minh chứng. Kích thước tối đa 5 MB.</p>
    <div className="button-row">{[["photo", "Chọn ảnh"], ["file", "Chọn PDF"], ["video", "Chọn video"]].map(([type, label]) => <button type="button" key={type} disabled={app.busy} onClick={() => attach(type)}>{label}</button>)}</div>
    {attachment && <p>{attachment.name} <button type="button" onClick={() => setAttachment(null)}>Bỏ tệp</button></p>}
    <button className="primary" disabled={app.busy || !recordId}>Gửi yêu cầu</button>
  </form></section>}<section className={`card ${app.actor.role === "manager" ? "full-width" : ""}`}><p className="eyebrow">THEO DÕI XỬ LÝ</p><h2>{app.actor.role === "manager" ? "Duyệt điều chỉnh công" : "Yêu cầu của tôi"}</h2>{!requests.length && <p className="empty">Chưa có yêu cầu điều chỉnh công.</p>}{requests.map((request) => <ReviewRow key={request.id} request={request} app={app}/>)}</section></div>;
}
