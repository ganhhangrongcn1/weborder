import { useMemo, useState } from "react";
import { exportCsv, hours, localDay } from "../services/attendanceService.js";
import { downloadCsv, downloadBlob } from "../services/deviceService.js";
import { employeeName } from "../services/attendancePresentation.js";

export const displayTime = (date) => date ? new Date(date).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Đang trong ca";

export default function History({ app }) {
  const [month, setMonth] = useState(localDay(new Date()).slice(0, 7));
  const records = useMemo(() => app.state.records.filter((r) => (app.actor.role === "manager" || r.employeeId === app.actor.id) && localDay(r.checkIn).startsWith(month)), [app.state.records, app.actor, month]);
  return <section className="card"><div className="section-heading"><div><p className="eyebrow">Đối chiếu giờ công</p><h2>Lịch sử chấm công</h2></div><label>Tháng<input type="month" value={month} onChange={(e) => setMonth(e.target.value)}/></label></div>
    <div className="stats"><div><strong>{records.length}</strong><span>Ca đã ghi nhận</span></div><div><strong>{records.reduce((sum, row) => sum + hours(row), 0).toFixed(1)}</strong><span>Giờ hoàn thành</span></div><div><strong>{records.filter((r) => !r.checkOut).length}</strong><span>Ca đang làm</span></div></div>
    <div className="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Vào ca</th><th>Ra ca</th><th>Số giờ</th><th>Trạng thái</th><th>Ảnh</th></tr></thead><tbody>{records.map((r) => <tr key={r.id}><td>{employeeName(r.name)}<small>{r.method === "sample" ? "Chấm công" : r.method === "qr" ? "GPS + QR" : "GPS"}</small></td><td>{displayTime(r.checkIn)}</td><td>{displayTime(r.checkOut)}</td><td>{hours(r).toFixed(2)}</td><td><span className="badge">{r.adjusted ? "Đã điều chỉnh" : r.checkOut ? "Hoàn thành" : "Đang làm"}</span></td><td>{r.photo ? <button onClick={() => app.run(async () => { if (r.photo.native) throw new Error("Ảnh native chỉ xem trên cùng thiết bị Zalo."); const response = await fetch(r.photo.data); downloadBlob(await response.blob(), "anh-xac-nhan.jpg"); })}>Xem ảnh</button> : "—"}</td></tr>)}</tbody></table></div>
    {!records.length && <p className="empty">Chưa có bản ghi trong tháng này.</p>}
    <div className="button-row"><button disabled={app.busy || !records.length} onClick={() => app.run(() => downloadCsv(exportCsv(records)), "Đã gửi bảng công đến chức năng tải của thiết bị.")}>Tải bảng công CSV</button></div>
    <p className="small">Tệp UTF-8 có dấu tiếng Việt. Chỉ bao gồm dữ liệu theo bộ lọc đang xem.</p>
  </section>;
}
