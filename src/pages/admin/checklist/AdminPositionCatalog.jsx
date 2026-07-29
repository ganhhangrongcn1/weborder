import { useState } from "react";
import useChecklistManagement from "../../../hooks/useChecklistManagement.js";
import { loadChecklistPositions, saveChecklistPosition } from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminInput } from "../ui/AdminCommon.jsx";

const EMPTY_POSITION = { id: "", name: "", description: "", displayOrder: 90, isActive: true };

function toForm(position) {
  return { id: position.id, name: position.name, description: position.description || "", displayOrder: position.display_order || 0, isActive: position.is_active };
}

export default function AdminPositionCatalog() {
  const positions = useChecklistManagement(loadChecklistPositions);
  const [form, setForm] = useState(null);
  const rows = positions.data || [];

  async function save(event) {
    event.preventDefault();
    const ok = await positions.run(() => saveChecklistPosition(form), form.id ? "Đã cập nhật vị trí." : "Đã thêm vị trí mới.");
    if (ok) setForm(null);
  }

  return <div className="checklist-report-page">
    <div className="position-catalog-heading"><div><h3>Danh mục vị trí</h3><p>Vị trí công việc dùng cho hồ sơ nhân viên và báo cáo, không quyết định quyền đăng nhập.</p></div><AdminButton onClick={() => setForm({ ...EMPTY_POSITION })}>+ Thêm vị trí</AdminButton></div>
    {positions.error ? <p className="checklist-admin-message error">{positions.error}</p> : null}
    {positions.message ? <p className="checklist-admin-message success">{positions.message}</p> : null}
    <AdminCard className="checklist-report-table-card">{positions.loading ? <AdminEmptyState message="Đang tải danh mục vị trí…" /> : rows.length ? <div className="checklist-admin-table-wrap"><table className="checklist-admin-table"><thead><tr><th>Vị trí</th><th>Mô tả</th><th>Trạng thái</th><th>Thứ tự</th><th /></tr></thead><tbody>{rows.map((position) => <tr key={position.id}><td><strong>{position.name}</strong><small>{position.position_code}</small></td><td>{position.description || "—"}</td><td><AdminBadge tone={position.is_active ? "success" : "neutral"}>{position.is_active ? "Đang sử dụng" : "Tạm ngưng"}</AdminBadge></td><td>{position.display_order}</td><td><AdminButton variant="secondary" onClick={() => setForm(toForm(position))}>Sửa</AdminButton></td></tr>)}</tbody></table></div> : <AdminEmptyState message="Chưa có vị trí công việc." />}</AdminCard>
    {form ? <div className="checklist-admin-modal-backdrop" onMouseDown={() => setForm(null)}><section className="checklist-admin-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>{form.id ? "Cập nhật vị trí" : "Thêm vị trí"}</h2><p>Tạm ngưng vị trí thay vì xóa để giữ lịch sử nhân viên.</p></div><button type="button" onClick={() => setForm(null)}>×</button></header><form onSubmit={save}><label><span>Tên vị trí *</span><AdminInput required value={form.name} onValueChange={(value) => setForm({ ...form, name: value })} /></label><label><span>Mô tả trách nhiệm</span><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="checklist-admin-form-grid"><label><span>Thứ tự hiển thị</span><AdminInput type="number" min="0" value={form.displayOrder} onValueChange={(value) => setForm({ ...form, displayOrder: value })} /></label><label className="position-active-check"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span><strong>Đang sử dụng</strong><small>Tắt để không cho chọn khi tạo nhân viên mới.</small></span></label></div><footer><AdminButton type="button" variant="secondary" onClick={() => setForm(null)}>Hủy</AdminButton><AdminButton disabled={positions.saving}>{positions.saving ? "Đang lưu…" : "Lưu vị trí"}</AdminButton></footer></form></section></div> : null}
  </div>;
}
