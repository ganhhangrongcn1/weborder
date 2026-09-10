import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import useInventorySalesDeductionSettings from "../../../hooks/useInventorySalesDeductionSettings.js";

export default function InventorySalesDeductionSettings() {
  const state = useInventorySalesDeductionSettings();
  const [selection, setSelection] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const canWrite = state.status === "ready" && state.canManage && state.writeEnabled && !state.saving;
  const save = async () => {
    if (!selection || !confirmed || !canWrite) return;
    if (await state.save(selection, !selection.enabled)) {
      setNotice(`Đã ${selection.enabled ? "tắt" : "bật"} tự trừ khi bán tại ${selection.branchName}.`);
      setSelection(null);
    }
  };
  return <section className="inventory-list-card">
    <header className="inventory-count-manager__head"><span aria-hidden="true"><Icon name="gear" size={18} /></span><div><strong>Tự trừ tồn theo bán hàng</strong><small>Thiết lập riêng từng chi nhánh · chỉ Admin toàn hệ thống và Kho Tổng được thay đổi.</small></div><button type="button" disabled={state.saving} onClick={state.refresh}>Tải lại</button></header>
    <div className="inventory-sales-safe-note">Tắt chỉ dừng xuất kho từ đơn bán. Nhập, điều chuyển, sơ chế, hủy và kiểm kê vẫn hoạt động. Không xóa định lượng hoặc gán món.</div>
    <div className="inventory-count-notice">Khi chưa tự trừ: chốt nhận hàng, sơ chế và hủy trước; nhập số đếm cuối ngày, gửi kiểm kê để quản lý duyệt. Chênh lệch có thể gồm hàng đã bán, không mặc định là thất thoát. Không xuất thêm lần nữa cho phần đã điều chỉnh qua kiểm kê. <Link to="/admin/inventory/counts">Mở kiểm kê →</Link></div>
    {state.message ? <div className="inventory-count-notice is-error" role="alert">{state.message}</div> : null}
    {notice ? <div className="inventory-count-notice" role="status">{notice}</div> : null}
    {state.status === "loading" ? <p className="inventory-sales-safe-note">Đang tải cài đặt…</p> : null}
    <div className="inventory-table-scroll"><table className="inventory-data-table"><thead><tr><th>Chi nhánh</th><th>Chế độ hiện tại</th><th>Áp dụng cho đơn tạo từ</th><th>Thao tác</th></tr></thead><tbody>
      {state.rows.map((row) => <tr key={row.branchUuid}><td><strong>{row.branchName}</strong>{!row.hasWarehouse ? <small>Chưa có kho trừ mặc định</small> : null}</td><td><span className={`inventory-status-pill ${row.enabled ? "is-active" : "is-inactive"}`}>{row.enabled ? "Đang tự trừ khi bán" : "Tắt · chốt tồn bằng kiểm kê"}</span></td><td>{row.enabledFrom ? new Date(row.enabledFrom).toLocaleString("vi-VN") : "Chưa áp dụng"}</td><td><div className="inventory-row-actions inventory-count-actions"><button type="button" disabled={!canWrite || (!row.enabled && !row.hasWarehouse)} onClick={() => { setSelection(row); setConfirmed(false); setNotice(""); }}>{row.enabled ? "Tắt tự trừ" : "Bật tự trừ"}</button></div></td></tr>)}
    </tbody></table></div>
    {state.status === "ready" && !state.rows.length ? <div className="inventory-list-empty">Chưa có chi nhánh trong phạm vi được phép xem.</div> : null}
    <div className="inventory-readonly-footnote">Chi nhánh mới mặc định tắt. Khi bật chỉ xét đơn tạo mới từ thời điểm bật, không trừ bù đơn cũ. Đơn thiếu định lượng vẫn bị chặn và hiện tại Đối chiếu đơn ↔ kho. Hủy đơn đã ghi kho trước đó vẫn hoàn lại đúng bút toán gốc.</div>
    {selection ? <div className="inventory-modal-backdrop"><section className="inventory-warehouse-modal inventory-bom-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="deduction-confirm-title">
      <header><h2 id="deduction-confirm-title">{selection.enabled ? "Tắt" : "Bật"} tự trừ khi bán?</h2></header>
      <div className="inventory-bom-confirm-modal__body"><strong>{selection.branchName}</strong><p>{selection.enabled ? "Các đơn chưa ghi kho sẽ không được trừ bù khi bật lại. Từ lúc tắt, chốt tồn thực tế bằng kiểm kê." : "Chỉ đơn tạo mới sau khi lưu mới được xét trừ kho. Hoàn thiện định lượng, gán món và hoàn tất kiểm kê chốt tồn trước khi bật."}</p>
        <label className="inventory-stock-thresholds__toggle"><input type="checkbox" checked={confirmed} disabled={state.saving} onChange={(event) => setConfirmed(event.target.checked)} /><span>{selection.enabled ? "Tôi xác nhận chuyển sang chốt tồn bằng kiểm kê." : "Đã kiểm tra định lượng, gán món và chốt tồn thực tế."}</span></label>
        {state.message ? <p role="alert">{state.message}</p> : null}
      </div><footer className="inventory-bom-confirm-modal__footer"><button type="button" disabled={state.saving} onClick={() => setSelection(null)}>Đóng</button><button type="button" className="is-primary" disabled={!confirmed || !canWrite} onClick={save}>{state.saving ? "Đang lưu…" : "Xác nhận"}</button></footer>
    </section></div> : null}
  </section>;
}
