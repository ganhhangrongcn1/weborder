import { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const video = useRef(null); const [error, setError] = useState(""); const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true; let stream;
    if (!navigator.mediaDevices?.getUserMedia) { setError("Trình duyệt không hỗ trợ camera. Hãy thử Chrome/Edge trên HTTPS hoặc localhost."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false }).then((result) => {
      if (!active) { result.getTracks().forEach((track) => track.stop()); return; }
      stream = result; video.current.srcObject = stream; setReady(true);
    }).catch(() => { if (active) setError("Chưa truy cập được camera. Anh/chị có thể cho phép camera trong cài đặt trình duyệt hoặc đóng màn hình này."); });
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);
  function capture() {
    if (!video.current?.videoWidth) { setError("Camera chưa sẵn sàng. Vui lòng đợi hình ảnh xuất hiện."); return; }
    const canvas = document.createElement("canvas"); const scale = Math.min(1, 1280 / video.current.videoWidth);
    canvas.width = video.current.videoWidth * scale; canvas.height = video.current.videoHeight * scale;
    canvas.getContext("2d").drawImage(video.current, 0, 0, canvas.width, canvas.height);
    onCapture({ name: "anh-cham-cong.jpg", type: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.8) });
  }
  return <div className="modal-backdrop"><section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title"><h2 id="camera-title">Ảnh xác nhận chấm công</h2><p>Ảnh chỉ được chụp khi bạn bấm xác nhận và được đính kèm cùng bản ghi chấm công.</p><video ref={video} autoPlay muted playsInline/>{error && <p role="alert">{error}</p>}<div className="button-row"><button className="primary" disabled={!ready} onClick={capture}>Chụp và sử dụng ảnh</button><button autoFocus onClick={onClose}>Hủy</button></div></section></div>;
}
