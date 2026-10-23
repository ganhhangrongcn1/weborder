import { useEffect, useState } from "react";
import { keepAwake, openPdf, saveVideo } from "../services/deviceService.js";
import videoUrl from "../assets/huong-dan-cham-cong.mp4";
import pdfUrl from "../assets/huong-dan-cham-cong.pdf";

export default function Training({ app }) {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    const release = () => { keepAwake(false).catch(() => {}); setAwake(false); };
    const visibility = () => { if (document.visibilityState !== "visible") release(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", release);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", release); keepAwake(false).catch(() => {}); };
  }, []);
  const screen = async (enabled) => { try { await keepAwake(enabled); setAwake(enabled); } catch (error) { setAwake(false); if (enabled) throw error; } };
  return <div className="check-grid"><section className="card"><p className="eyebrow">Đào tạo nhân viên</p><h2>Hướng dẫn chấm công</h2>
    <video className="training-video" src={videoUrl} controls playsInline preload="metadata"
      onPlay={() => app.run(() => screen(true), "Đang giữ màn hình sáng khi xem video.")}
      onPause={() => screen(false)} onEnded={() => screen(false)}/>
    <p className="small">{awake ? "Giữ màn hình sáng đang bật. Dừng video để tắt." : "Giữ màn hình sáng chỉ được bật khi phát video và thiết bị hỗ trợ."}</p>
    <button disabled={app.busy} onClick={() => app.run(() => saveVideo(videoUrl), "Đã gửi video đến chức năng lưu của thiết bị.")}>Lưu video hướng dẫn</button>
  </section><section className="card"><p className="eyebrow">Tài liệu nội bộ</p><h2>Hướng dẫn & quyền riêng tư</h2>
    <ol className="guide"><li><strong>Vào và ra ca</strong><p>Kiểm tra GPS. Nếu chọn GPS + QR, quét thêm QR cửa hàng rồi bấm vào hoặc ra ca.</p></li><li><strong>Đối chiếu cuối ca</strong><p>Xem lịch sử. Khi giờ công chưa đúng, gửi yêu cầu điều chỉnh kèm lý do và minh chứng.</p></li><li><strong>Quản lý xử lý</strong><p>Quản lý kiểm tra yêu cầu, đối chiếu minh chứng và phản hồi kết quả.</p></li></ol>
    <button disabled={app.busy} onClick={() => app.run(() => openPdf(pdfUrl), "Đã mở tài liệu hướng dẫn.")}>Xem hướng dẫn PDF</button>
    <div className="privacy"><strong>Quyền riêng tư</strong><p>Vị trí, camera và số điện thoại chỉ được yêu cầu khi bạn chủ động thao tác. Không thu thập vị trí nền.</p></div>
  </section></div>;
}
