import { Archive, ClipboardText, PencilSimple, Plus, SealCheck, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Modal from "../components/ui/Modal.jsx";
import { useChecklistAdmin } from "../hooks/useChecklistAdmin.js";

const EVIDENCE_LABELS = { never: "Không bắt buộc", fail: "Khi không đạt", improve_or_fail: "Cần cải thiện hoặc không đạt", always: "Luôn bắt buộc" };
const PENALTY_LABELS = { reminder: "Nhắc nhở", minor: "Nhẹ", major: "Nặng", critical: "Nghiêm trọng", severe: "Đình chỉ xử lý" };

function createItemForm(item, section, version, nextOrder) {
  return item ? {
    id: item.id, sectionId: item.section_id, versionId: item.version_id, content: item.content,
    guidance: item.guidance || "", weight: item.weight, isCritical: item.is_critical,
    evidenceRule: item.evidence_rule, defaultPenaltyLevel: item.default_penalty_level,
    isActive: item.is_active, displayOrder: item.display_order
  } : {
    id: "", sectionId: section.id, versionId: version.id, content: "", guidance: "", weight: 1,
    isCritical: false, evidenceRule: "fail", defaultPenaltyLevel: "minor", isActive: true,
    displayOrder: nextOrder
  };
}

export default function SupervisionManagementPage() {
  const checklist = useChecklistAdmin();
  const [itemForm, setItemForm] = useState(null);
  const workspace = checklist.data;
  const template = workspace?.templates[0];
  const versions = useMemo(() => (workspace?.versions || []).filter((item) => item.template_id === template?.id), [template?.id, workspace?.versions]);
  const draftVersion = versions.find((item) => item.status === "draft");
  const publishedVersion = versions.find((item) => item.status === "published");
  const selectedVersion = draftVersion || publishedVersion;
  const sections = useMemo(() => (workspace?.sections || []).filter((item) => item.version_id === selectedVersion?.id && item.is_active), [selectedVersion?.id, workspace?.sections]);
  const items = useMemo(() => (workspace?.items || []).filter((item) => item.version_id === selectedVersion?.id), [selectedVersion?.id, workspace?.items]);
  const activeItems = items.filter((item) => item.is_active);
  const totalWeight = activeItems.reduce((sum, item) => sum + Number(item.weight), 0);

  async function handleSaveItem(event) {
    event.preventDefault();
    const saved = itemForm.id ? await checklist.saveItem(itemForm) : await checklist.addItem(itemForm);
    if (saved) setItemForm(null);
  }

  return (
    <div className="management-page">
      <header className="management-heading">
        <div>
          <p className="eyebrow">Tiêu chuẩn vận hành</p>
          <h1>Quản lý giám sát</h1>
          <p>Quản lý nội dung, trọng số và mức độ vi phạm. Phiên bản đã công bố luôn được giữ nguyên để bảo toàn báo cáo cũ.</p>
        </div>
        {template && !draftVersion ? <button type="button" className="primary-action" onClick={() => checklist.createDraft(template.id)} disabled={checklist.working}><PencilSimple weight="bold" /> Tạo bản chỉnh sửa</button> : null}
        {draftVersion ? <button type="button" className="primary-action" onClick={() => checklist.publish(draftVersion.id)} disabled={checklist.working || totalWeight !== Number(draftVersion.total_weight)}><SealCheck weight="fill" /> Công bố phiên bản {draftVersion.version_number}</button> : null}
      </header>

      <section className="summary-strip">
        <div><ClipboardText weight="fill" /><span>Phiên bản đang xem</span><strong>{selectedVersion ? `v${selectedVersion.version_number}` : "—"}</strong></div>
        <div><span>Nhóm kiểm tra</span><strong>{sections.length}</strong></div>
        <div><span>Tiêu chí hoạt động</span><strong>{activeItems.length}</strong></div>
        <div><span>Tổng trọng số</span><strong className={totalWeight === 100 ? "text-success" : "text-danger"}>{totalWeight}/100</strong></div>
      </section>

      {draftVersion ? <div className="draft-banner"><Archive weight="fill" /><div><strong>Đang chỉnh bản nháp v{draftVersion.version_number}</strong><p>Các thay đổi chưa ảnh hưởng đến checklist giám sát đang sử dụng.</p></div></div> : null}
      {checklist.error ? <p className="inline-message inline-message--error">{checklist.error}</p> : null}
      {checklist.message ? <p className="inline-message inline-message--success">{checklist.message}</p> : null}

      {checklist.loading ? <section className="data-panel empty-state">Đang tải nội dung checklist…</section> : null}
      {!checklist.loading && !selectedVersion ? <section className="data-panel empty-state">Chưa có mẫu checklist hoạt động.</section> : null}

      <div className="section-stack">
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section_id === section.id);
          const activeSectionItems = sectionItems.filter((item) => item.is_active);
          const sectionWeight = activeSectionItems.reduce((sum, item) => sum + Number(item.weight), 0);
          return (
            <section className="checklist-section" key={section.id}>
              <header>
                <div><span className="section-order">{String(section.display_order).padStart(2, "0")}</span><div><h2>{section.name}</h2><p>{activeSectionItems.length} tiêu chí · {sectionWeight} điểm</p></div></div>
                {draftVersion ? <button type="button" className="secondary-action" onClick={() => setItemForm(createItemForm(null, section, selectedVersion, Math.max(0, ...sectionItems.map((item) => item.display_order)) + 1))}><Plus /> Thêm tiêu chí</button> : null}
              </header>
              <div className="criteria-list">
                {sectionItems.map((item) => (
                  <article className={`criteria-row${item.is_active ? "" : " criteria-row--inactive"}`} key={item.id}>
                    <span className="criteria-code">{item.item_code}</span>
                    <div className="criteria-content"><strong>{item.content}</strong><div className="criteria-meta">{item.is_critical ? <span className="critical-tag"><WarningCircle weight="fill" /> Lỗi nghiêm trọng</span> : null}<span>Ảnh: {EVIDENCE_LABELS[item.evidence_rule]}</span><span>Vi phạm: {PENALTY_LABELS[item.default_penalty_level]}</span>{!item.is_active ? <span>Đã tạm ẩn</span> : null}</div></div>
                    <strong className="criteria-weight">{Number(item.weight)}</strong>
                    {draftVersion ? <button type="button" className="table-action" onClick={() => setItemForm(createItemForm(item, section, selectedVersion, 0))}><PencilSimple /> Sửa</button> : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {itemForm ? (
        <Modal title={itemForm.id ? "Chỉnh sửa tiêu chí" : "Thêm tiêu chí"} description="Trọng số của tất cả tiêu chí hoạt động phải cộng đủ 100 trước khi công bố." onClose={() => setItemForm(null)}>
          <form className="editor-form" onSubmit={handleSaveItem}>
            <label><span>Nội dung kiểm tra *</span><textarea required rows="4" value={itemForm.content} onChange={(event) => setItemForm({ ...itemForm, content: event.target.value })} /></label>
            <label><span>Hướng dẫn cho giám sát</span><textarea rows="3" value={itemForm.guidance} onChange={(event) => setItemForm({ ...itemForm, guidance: event.target.value })} /></label>
            <div className="form-grid">
              <label><span>Trọng số</span><input required type="number" min="0.01" step="0.01" value={itemForm.weight} onChange={(event) => setItemForm({ ...itemForm, weight: event.target.value })} /></label>
              <label><span>Yêu cầu hình ảnh</span><select value={itemForm.evidenceRule} onChange={(event) => setItemForm({ ...itemForm, evidenceRule: event.target.value })}>{Object.entries(EVIDENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Mức vi phạm mặc định</span><select value={itemForm.defaultPenaltyLevel} onChange={(event) => setItemForm({ ...itemForm, defaultPenaltyLevel: event.target.value })}>{Object.entries(PENALTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="switch-list">
              <label><input type="checkbox" checked={itemForm.isCritical} onChange={(event) => setItemForm({ ...itemForm, isCritical: event.target.checked })} /><span><strong>Lỗi nghiêm trọng</strong><small>Không đạt tiêu chí này sẽ đánh dấu ca kiểm tra có lỗi nghiêm trọng.</small></span></label>
              {itemForm.id ? <label><input type="checkbox" checked={itemForm.isActive} onChange={(event) => setItemForm({ ...itemForm, isActive: event.target.checked })} /><span><strong>Đang sử dụng</strong><small>Tắt để bỏ tiêu chí khỏi lần chấm tiếp theo nhưng vẫn giữ lịch sử.</small></span></label> : null}
            </div>
            {checklist.error ? <p className="inline-message inline-message--error">{checklist.error}</p> : null}
            <footer className="form-actions"><button type="button" className="secondary-action" onClick={() => setItemForm(null)}>Hủy</button><button className="primary-action" disabled={checklist.working}>{checklist.working ? "Đang lưu…" : "Lưu tiêu chí"}</button></footer>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
