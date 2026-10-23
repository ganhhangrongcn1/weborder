import { useEffect, useState } from "react";
import { DEMO_BRANCH } from "../data/demo.js";
import { distanceMeters } from "../services/attendanceService.js";
import { isZalo } from "../services/deviceService.js";
import CameraCapture from "./CameraCapture.jsx";
import NavigationIcon from "./NavigationIcon.jsx";

export default function Checkin({ app }) {
  const [clock, setClock] = useState(new Date());
  const [camera, setCamera] = useState(false);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer); }, []);
  const open = app.state.records.find((r) => r.employeeId === app.actor.id && !r.checkOut);
  const date = clock.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <div className="check-grid">
    <section className="card clock-card">
      <div className="clock-heading"><div className="clock-icon"><NavigationIcon name="checkin"/></div><div><strong>Ca làm hôm nay</strong><p>{date}</p></div></div>
      <div className="clock">{clock.toLocaleTimeString("vi-VN", { hour12: false })}</div>
      <div className="shift-state"><span className={`dot ${open ? "active" : ""}`}/>{open ? `Đang làm việc · vào lúc ${new Date(open.checkIn).toLocaleTimeString("vi-VN")}` : "Chưa vào ca"}</div>
      <div className="button-row"><button className="primary" disabled={app.busy || !!open} onClick={() => app.check("in")}>Vào ca</button><button disabled={app.busy || !open} onClick={() => app.check("out")}>Ra ca</button></div>
      <p className="small">Kiểm tra vị trí trước khi xác nhận vào hoặc ra ca.</p>
    </section>
    <section className="card check-evidence"><div className="section-heading"><div><p className="eyebrow">Điểm làm việc</p><h2>Xác nhận chấm công</h2></div><span className="badge neutral">{app.method === "gps" ? "GPS" : "GPS + QR"}</span></div>
      <label>Phương thức<select value={app.method} onChange={(e) => app.setMethod(e.target.value)}><option value="gps">Vị trí GPS</option><option value="qr">Vị trí GPS + QR cửa hàng</option></select></label>
      <div className="evidence-row"><div><strong>Vị trí hiện tại</strong><p>{app.location ? `Cách điểm chấm công ${Math.round(distanceMeters(app.location, DEMO_BRANCH))} m · ${app.location.accuracyEstimated ? "biên dự phòng" : "sai số"} ${app.location.accuracy} m` : "Chưa xác nhận vị trí"}</p></div><button disabled={app.busy} onClick={app.locate}>Kiểm tra GPS</button></div>
      {app.method === "qr" && <div className="evidence-row"><div><strong>QR cửa hàng</strong><p>{app.qr ? "Đã đọc mã, chờ đối chiếu" : "Quét mã tại điểm làm việc"}</p></div><button disabled={app.busy} onClick={app.scan}>Quét QR</button></div>}
      <div className="evidence-row"><div><strong>Kết nối mạng</strong><p>{app.network.label}</p></div><button disabled={app.busy} onClick={app.checkNetwork}>Kiểm tra</button></div>
      <div className="evidence-row"><div><strong>Ảnh xác nhận</strong><p>{app.photo ? "Đã có ảnh xác nhận" : "Thêm ảnh nếu cần đối chiếu"}</p></div><button disabled={app.busy} onClick={() => isZalo() ? app.capture() : setCamera(true)}>Chụp ảnh</button></div>
      {app.photo && <img className="photo-preview" src={app.photo.data} alt="Ảnh xác nhận chấm công"/>}
      {camera && <CameraCapture onCapture={(image) => { app.setPhoto(image); setCamera(false); }} onClose={() => setCamera(false)}/>}
      <p className="privacy-line">Vị trí chỉ được lấy khi bạn chủ động kiểm tra, không theo dõi liên tục.</p>
    </section>
    <section className="card attendance-help full-width"><NavigationIcon name="history"/><div><strong>Giờ công cần điều chỉnh?</strong><p>Chọn ca trong mục Điều chỉnh, ghi lý do và đính kèm minh chứng để quản lý xem xét.</p></div></section>
  </div>;
}
