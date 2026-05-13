import { AdminButton, AdminIconButton, AdminInput, AdminSelect } from "../ui/index.js";

export default function MenuCategoryEditorModal({
  open,
  onClose,
  editingCategoryDraft,
  setEditingCategoryDraft,
  deleteCategoryFromEditor,
  saveCategoryEditor
}) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop admin-side-backdrop" onClick={onClose}>
      <section className="admin-product-modal admin-product-side-panel" onClick={(event) => event.stopPropagation()}>
        <div className="admin-product-modal-head admin-product-side-head">
          <AdminIconButton label="Đóng" onClick={onClose}>×</AdminIconButton>
          <div>
            <h2>CHỈNH SỬA DANH MỤC</h2>
          </div>
        </div>

        <div className="admin-product-form admin-product-side-form category-editor-form">
          <label className="wide">
            MỚI *
            <AdminInput value={editingCategoryDraft} onChange={(event) => setEditingCategoryDraft(event.target.value)} />
          </label>
          <label className="wide">
            LỊCH BÁN *
            <AdminSelect value="all" readOnly>
              <option value="all">Tất cả giờ mở cửa</option>
            </AdminSelect>
          </label>
        </div>

        <div className="admin-modal-actions admin-side-actions menu-item-editor-actions">
          <AdminButton variant="danger" className="admin-danger" onClick={deleteCategoryFromEditor}>Xóa danh mục</AdminButton>
          <span />
          <AdminButton onClick={saveCategoryEditor} style={{ gridColumn: "1 / -1" }}>
            Lưu thay đổi
          </AdminButton>
        </div>
      </section>
    </div>
  );
}
