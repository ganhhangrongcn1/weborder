import { useEffect, useRef } from "react";
import "../../../styles/admin/inventory-lot-disposal.css";

export default function InventoryLotDisposalModal({ state, item = {}, warehouse = {}, unit = {} }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const lot = state.selection;
  return (
    <dialog ref={dialog} className="inventory-lot-disposal" onCancel={(event) => { event.preventDefault(); state.close(); }}>
      <form onSubmit={state.save}>
        <h2>Hủy lô này</h2>
        <p><strong>{item.name}</strong> · {warehouse.name}</p>
        <p>Lô <strong>{lot.lotNumber}</strong> · Hạn dùng: {lot.expiresOn || "Không có"}</p>
        {state.result ? <div role="status">Đã tạo phiếu nháp <strong>{state.result.documentNo}</strong>. Chưa trừ tồn. Vào Phiếu hủy để kiểm tra và hoàn tất.</div> : <>
          <label>Số lượng hủy ({unit.symbol || unit.name || "Đơn vị gốc"})
            <input autoFocus type="number" step="0.000001" min="0.000001" max={lot.remainingQuantity} required value={state.quantity}
              disabled={state.busy} onChange={(event) => state.setQuantity(event.target.value)} />
          </label>
          <small>Còn lại: {new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(lot.remainingQuantity)} {unit.symbol || unit.name}. Chỉ trừ đúng lô này khi hoàn tất phiếu.</small>
          <label>Lý do hủy<input required value={state.reason} disabled={state.busy} onChange={(event) => state.setReason(event.target.value)} /></label>
          <p>Lưu nháp chưa làm thay đổi tồn kho.</p>
        </>}
        {state.error ? <p role="alert">{state.error}</p> : null}
        <footer><button type="button" onClick={state.close} disabled={state.busy}>Đóng</button>
          {!state.result ? <button type="submit" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Tạo phiếu hủy nháp"}</button> : null}
        </footer>
      </form>
    </dialog>
  );
}
