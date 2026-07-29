import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ signerName, disabled = false, onSave }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

  function prepareCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#292621";
  }

  useEffect(() => { prepareCanvas(); }, [signerName]);

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event) {
    if (disabled) return;
    drawingRef.current = true;
    const context = canvasRef.current.getContext("2d");
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
    canvasRef.current.setPointerCapture?.(event.pointerId);
  }

  function move(event) {
    if (!drawingRef.current || disabled) return;
    const context = canvasRef.current.getContext("2d");
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
    setHasInk(true);
  }

  function stop() { drawingRef.current = false; }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function save() {
    if (!hasInk || disabled) return;
    setSaving(true);
    const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/webp", 0.8));
    const saved = blob ? await onSave(new File([blob], `signature-${Date.now()}.webp`, { type: "image/webp" })) : false;
    if (saved) clear();
    setSaving(false);
  }

  return (
    <section className="signature-pad">
      <div><strong>Chữ ký của {signerName}</strong><small>Ký trực tiếp bằng ngón tay trong khung bên dưới.</small></div>
      <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} />
      <div className="signature-actions"><button type="button" onClick={clear} disabled={!hasInk || saving}>Xóa nét ký</button><button type="button" className="save-signature" onClick={save} disabled={!hasInk || saving}>{saving ? "Đang lưu…" : "Lưu chữ ký"}</button></div>
    </section>
  );
}
