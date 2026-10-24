import { useEffect, useRef, useState } from "react";
import useTrainingFiles from "../hooks/useTrainingFiles.js";
import useScreenAwake from "../hooks/useScreenAwake.js";
import { TRAINING_MATERIALS } from "../services/trainingMaterialService.js";
import pdfPreview from "../assets/huong-dan-cham-cong-trang-1.png";

export default function Training({ app }) {
  const { files, reload } = useTrainingFiles();
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [keepOn, setKeepOn] = useState(true);
  const [viewPdf, setViewPdf] = useState(false);
  const [zoom, setZoom] = useState("100");
  const [videoError, setVideoError] = useState(false);
  const awake = useScreenAwake(playing && keepOn);
  const saved = TRAINING_MATERIALS.filter((item) => app.state.savedMaterials?.[item.id]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState !== "visible") { video.current?.pause(); setPlaying(false); } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", hide); };
  }, []);
  function view(id) {
    if (id === "guide") setViewPdf(true);
    else { video.current?.scrollIntoView({ block: "center" }); if (video.current) app.run(() => video.current.play()); }
  }
  return <div className="check-grid">
    <section className="card"><p className="eyebrow">Đào tạo nhân viên</p><h2>Video hướng dẫn</h2>
      {files.video?.url && <video ref={video} className="training-video" src={files.video.url} controls playsInline preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setVideoError(true); }}/>
      }
      {files.video?.loading && <p role="status">Đang tải video…</p>}
      {(files.video?.error || videoError) && <div role="alert"><p>Chưa mở được video.</p><button onClick={() => { setVideoError(false); reload("video"); }}>Tải lại video</button></div>}
      <p>Hướng dẫn thao tác chấm công và đối chiếu giờ công của nhân viên.</p>
      <label className="switch"><input type="checkbox" checked={keepOn} onChange={(event) => setKeepOn(event.target.checked)}/>Giữ màn hình sáng khi xem</label>
      <p className="small">{awake === "on" ? "Đang giữ màn hình sáng." : awake === "demo" ? "Giữ sáng đang được mô phỏng trên thiết bị này." : "Giữ sáng sẽ tắt khi dừng video hoặc rời màn hình."}</p>
      <div className="button-row"><button disabled={app.busy || !files.video?.url} onClick={() => app.saveMaterial("video")}>{app.state.savedMaterials?.video ? "Đã lưu xem lại" : "Lưu để xem lại"}</button>
        {files.video?.url && <a className="action-link" href={files.video.url} download={files.video.name}>Tải video</a>}
      </div>
    </section>
    <section className="card"><p className="eyebrow">Tài liệu nội bộ</p><h2>Hướng dẫn chấm công</h2>
      <p>Đọc hướng dẫn trước khi vào ca. Tải bản PDF hoặc lưu vào tài liệu của tôi để xem lại.</p>
      <img className="pdf-thumbnail" src={pdfPreview} alt="Trang hướng dẫn chấm công"/>
      {files.guide?.loading && <p role="status">Đang tải PDF…</p>}
      {files.guide?.error && <div role="alert"><p>{files.guide.error}</p><button onClick={() => reload("guide")}>Tải lại PDF</button></div>}
      <div className="button-row"><button className="primary" disabled={!files.guide?.url} onClick={() => setViewPdf(true)}>Xem PDF</button>
        {files.guide?.url && <a className="action-link" href={files.guide.url} download={files.guide.name}>Tải PDF</a>}
        <button disabled={app.busy || !files.guide?.url} onClick={() => app.saveMaterial("guide")}>{app.state.savedMaterials?.guide ? "Đã lưu tài liệu" : "Lưu tài liệu"}</button>
      </div>
    </section>
    <section className="card full-width"><h2>Tài liệu của tôi</h2><p className="small">Các mục đã lưu để mở lại trong app. Để có bản riêng trên thiết bị, chọn Tải PDF hoặc Tải video.</p>
      {!saved.length && <p>Chưa có tài liệu được lưu.</p>}
      {saved.map((item) => <div className="saved-material" key={item.id}><strong>{item.title}</strong><button disabled={!files[item.id]?.url} onClick={() => view(item.id)}>Xem lại</button></div>)}
    </section>
    {viewPdf && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title" className="camera-dialog pdf-dialog">
      <div className="section-heading"><h2 id="pdf-viewer-title">Hướng dẫn chấm công · PDF</h2><button onClick={() => setViewPdf(false)}>Đóng</button></div>
      <label>Phóng trang<select value={zoom} onChange={(event) => setZoom(event.target.value)}><option value="100">Vừa màn hình</option><option value="150">150%</option><option value="200">200%</option></select></label>
      <p className="small">Trang 1/1</p><div className={`pdf-page-frame zoom-${zoom}`}><img src={pdfPreview} alt="Nội dung trang 1 của hướng dẫn chấm công"/></div>
      {files.guide?.url && <a className="action-link" href={files.guide.url} download={files.guide.name}>Tải bản PDF gốc</a>}
    </section></div>}
  </div>;
}
