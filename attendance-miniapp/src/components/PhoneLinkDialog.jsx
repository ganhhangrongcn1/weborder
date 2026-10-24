import { useEffect, useRef, useState } from "react";
import logo from "../assets/ghr-logo.png";

export default function PhoneLinkDialog({ app, scenario = "match", onClose }) {
  const [allowed, setAllowed] = useState(false);
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);
  const [details, setDetails] = useState(false);
  const firstRef = useRef(null);
  const lock = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstRef.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const submit = async (consent) => {
    if (lock.current || (consent && !allowed)) return;
    lock.current = true; setPending(true);
    try {
      const outcome = await app.phone(scenario, consent);
      setResult(outcome || { status: "error", message: "Chưa lưu được liên kết. Vui lòng kiểm tra kết nối và thử lại." });
    } finally { lock.current = false; setPending(false); }
  };
  return <div className="modal-backdrop phone-share-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="phone-consent-title" className="phone-share-sheet" onKeyDown={(event) => {
    if (event.key === "Escape" && !pending) onClose();
    if (event.key === "Tab") {
      const items = [...event.currentTarget.querySelectorAll("button:not(:disabled),input:not(:disabled)")];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="sheet-handle" aria-hidden="true"/><img className="share-logo" src={logo} alt="Gánh Hàng Rong"/>
    <p className="share-demo">Mô phỏng chia sẻ · Không phải hộp cấp quyền Zalo thật</p>
    <h2 id="phone-consent-title">Cho phép Gánh Hàng Rong nhận thông tin của bạn</h2>
    {!result ? <><p className="share-description">Chia sẻ số điện thoại liên kết với Zalo để đối chiếu hồ sơ nhân viên. <button ref={firstRef} className="share-learn" onClick={() => setDetails(!details)} aria-expanded={details}>Tìm hiểu thêm</button></p>
      {details && <p className="small">Chỉ nhận số khi bạn bật lựa chọn và bấm Cho phép. Không bắt buộc để chấm công. Bản này chỉ dùng số mẫu, không lấy số thật và không xin tên hoặc ảnh đại diện.</p>}
      <label className="phone-share-row"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 3 4 1 1 5-3 2a15 15 0 0 0 6 6l2-3 5 1 1 4c-1 4-7 3-12-2S1 4 5 3Z"/></svg><span>Số điện thoại liên kết với Zalo</span><input type="checkbox" role="switch" aria-label="Chia sẻ số điện thoại liên kết với Zalo" disabled={pending} checked={allowed} onChange={(event) => setAllowed(event.target.checked)}/></label>
      {pending && <p role="status">Đang đối chiếu và lưu liên kết…</p>}
      <div className="share-actions"><button disabled={pending || app.busy} onClick={() => submit(false)}>Từ chối</button><button className="share-allow" disabled={!allowed || pending || app.busy} onClick={() => submit(true)}>Cho phép</button></div>
    </> : <><div role="status" className={`notice ${result.status === "matched" ? "success" : ""}`}><strong>{result.status === "matched" ? "Đối chiếu thành công" : result.status === "mismatch" ? "Thông tin chưa khớp" : result.status === "declined" ? "Đã từ chối chia sẻ" : "Chưa hoàn tất"}</strong>{result.status === "matched" && <p className="linked-phone">*** 0001</p>}<p>{result.message}</p></div><button ref={firstRef} className="share-close" onClick={onClose}>Đóng</button>{result.status === "error" && <button onClick={() => setResult(null)}>Thử lại</button>}</>}
  </section></div>;
}
