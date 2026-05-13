import { AdminButton, AdminIconButton } from "../ui/index.js";

export default function AppearanceCropModal({
  open,
  onClose,
  cropViewportRef,
  cropImageRef,
  cropSourceUrl,
  setCropOffset,
  setCropScale,
  setIsDraggingCrop,
  dragStartRef,
  cropOffset,
  isDraggingCrop,
  clampCropOffset,
  cropScale,
  applyCroppedImage
}) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <section className="admin-crop-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-crop-head">
          <div>
            <h3>Cắt ảnh banner</h3>
            <p>Tỷ lệ chuẩn 16:7 (1200x525). Kéo ảnh để chọn vùng đẹp.</p>
          </div>
          <AdminIconButton label="Đóng" variant="primary" onClick={onClose}>×</AdminIconButton>
        </div>
        <div className="admin-crop-viewport" ref={cropViewportRef}>
          <img
            ref={cropImageRef}
            src={cropSourceUrl}
            alt="Crop source"
            draggable={false}
            onLoad={() => {
              setCropOffset({ x: 0, y: 0 });
              setCropScale(1);
            }}
            onMouseDown={(event) => {
              setIsDraggingCrop(true);
              dragStartRef.current = { x: event.clientX, y: event.clientY, ox: cropOffset.x, oy: cropOffset.y };
            }}
            onMouseMove={(event) => {
              if (!isDraggingCrop) return;
              const dx = event.clientX - dragStartRef.current.x;
              const dy = event.clientY - dragStartRef.current.y;
              setCropOffset(clampCropOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy }));
            }}
            onMouseUp={() => setIsDraggingCrop(false)}
            onMouseLeave={() => setIsDraggingCrop(false)}
            style={{ transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})` }}
          />
        </div>
        <div className="admin-crop-controls">
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="2.6"
              step="0.01"
              value={cropScale}
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                setCropScale(nextScale);
                setCropOffset((current) => clampCropOffset(current, nextScale));
              }}
            />
          </label>
          <div className="admin-crop-actions">
            <AdminButton variant="secondary" onClick={onClose}>Hủy</AdminButton>
            <AdminButton onClick={applyCroppedImage}>Lưu ảnh</AdminButton>
          </div>
        </div>
      </section>
    </div>
  );
}
