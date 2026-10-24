import useScreenAwake from "../hooks/useScreenAwake.js";

export default function DemoQrScanner({ onClose, onConfirm, busy }) {
  const awake = useScreenAwake(true);
  return <div className="modal-backdrop"><section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
    <h2 id="qr-scanner-title">Quét mã cửa hàng</h2>
    <div className="qr-demo-frame"><span/><strong>QR cửa hàng</strong></div>
    <p>Đưa mã QR của cửa hàng vào khung để xác nhận điểm làm việc.</p>
    <p className="small">{awake === "on" ? "Màn hình được giữ sáng khi đang quét." : "Trình diễn giữ màn hình sáng trong lúc quét mã."}</p>
    <p className="small">Màn hình mô phỏng, không mở camera thật.</p>
    <div className="button-row"><button disabled={busy} onClick={onClose}>Đóng</button><button disabled={busy} className="primary" onClick={onConfirm}>Nhận mã cửa hàng mẫu</button></div>
  </section></div>;
}
