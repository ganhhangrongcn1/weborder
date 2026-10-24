import { useMemo, useState } from "react";
import { exportCsv, hours, localDay } from "../services/attendanceService.js";
import { downloadCsv, downloadBlob } from "../services/deviceService.js";
import { employeeName } from "../services/attendancePresentation.js";

export const displayTime = (date) => date ? new Date(date).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Đang trong ca";

export default function History({ app }) {
  const [month, setMonth] = useState(localDay(new Date()).slice(0, 7));
  const records = useMemo(() => app.state.records.filter((r) => r.employeeId === app.actor.id && localDay(r.checkIn).startsWith(month)), [app.state.records, app.actor.id, month]);
  const viewPhoto = (row) => app.run(async () => {
    if (row.photo.native) throw new Error("Ảnh này chỉ xem trên thiết bị Zalo đã chụp.");
    const response = await fetch(row.photo.data);
    downloadBlob(await response.blob(), "anh-xac-nhan.jpg");
  });
  return <section className="card"><div className="section-heading"><div><h2>Lịch sử chấm công</h2></div><label>Tháng<input type="month" value={month} onChange={(e) => setMonth(e.target.value)}/></label></div>
    <div className="stats"><div><strong>{records.length}</strong><span>Ca đã ghi nhận</span></div><div><strong>{records.reduce((sum, row) => sum + hours(row), 0).toFixed(2)}</strong><span>Giờ hoàn thành</span></div><div><strong>{records.filter((r) => !r.checkOut).length}</strong><span>Ca đang làm</span></div></div>
    <div className="shift-list">{records.map((row) => <article key={row.id} className="shift-item">
      <div className="section-heading"><strong>{employeeName(row.name)}</strong><span className="badge">{row.adjusted ? "Đã điều chỉnh" : row.checkOut ? "Hoàn thành" : "Đang làm"}</span></div>
      <dl><dt>Vào ca</dt><dd>{displayTime(row.checkIn)}</dd><dt>Ra ca</dt><dd>{displayTime(row.checkOut)}</dd><dt>Tổng giờ</dt><dd>{hours(row).toFixed(2)} giờ</dd></dl>
      {row.photo && <button disabled={app.busy} onClick={() => viewPhoto(row)}>Xem ảnh xác nhận</button>}
    </article>)}</div>
    {!records.length && <p className="empty">Chưa có bản ghi trong tháng này.</p>}
    <div className="button-row"><button disabled={app.busy || !records.length} onClick={() => app.run(() => downloadCsv(exportCsv(records)), "Đã gửi bảng công đến chức năng tải của thiết bị.")}>Tải bảng công CSV</button></div>
  </section>;
}
