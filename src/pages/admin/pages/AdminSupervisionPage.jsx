import { useEffect, useMemo, useState } from "react";
import useChecklistManagement from "../../../hooks/useChecklistManagement.js";
import {
  cancelChecklistDraft,
  cloneChecklistVersion,
  createChecklistDraft,
  loadChecklistTemplates,
  publishChecklistVersion,
  saveChecklistCriterion
} from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminInput, AdminSelect } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";
import AdminSupervisionReports from "../checklist/AdminSupervisionReports.jsx";

const EVIDENCE_LABELS = {
  never: "Không bắt buộc",
  fail: "Khi không đạt",
  improve_or_fail: "Cần cải thiện hoặc không đạt",
  always: "Luôn bắt buộc"
};

const PENALTY_LABELS = {
  reminder: "Nhắc nhở",
  minor: "Nhẹ",
  major: "Nặng",
  critical: "Nghiêm trọng",
  severe: "Đình chỉ xử lý"
};

const VERSION_LABELS = {
  draft: "Bản nháp",
  published: "Đang áp dụng",
  archived: "Đã lưu trữ"
};

function toItemForm(item, section, version, displayOrder) {
  return item
    ? {
        id: item.id,
        sectionId: item.section_id,
        versionId: item.version_id,
        content: item.content,
        guidance: item.guidance || "",
        weight: item.weight,
        isCritical: item.is_critical,
        evidenceRule: item.evidence_rule,
        defaultPenaltyLevel: item.default_penalty_level,
        isActive: item.is_active,
        displayOrder: item.display_order
      }
    : {
        id: "",
        sectionId: section.id,
        versionId: version.id,
        content: "",
        guidance: "",
        weight: 1,
        isCritical: false,
        evidenceRule: "fail",
        defaultPenaltyLevel: "minor",
        isActive: true,
        displayOrder
      };
}

function formatDate(value) {
  if (!value) return "Chưa áp dụng";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function AdminSupervisionPage({ branches = [] }) {
  const checklist = useChecklistManagement(loadChecklistTemplates);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(null);
  const [cancelDraftId, setCancelDraftId] = useState("");
  const workspace = checklist.data;
  const template = workspace?.templates?.[0];
  const versions = useMemo(
    () => (workspace?.versions || []).filter((item) => item.template_id === template?.id),
    [template?.id, workspace?.versions]
  );
  const draft = versions.find((item) => item.status === "draft");
  const published = versions.find((item) => item.status === "published");
  const selectedVersion = versions.find((item) => item.id === selectedVersionId) || draft || published || versions[0];
  const sections = useMemo(
    () => (workspace?.sections || []).filter((item) => item.version_id === selectedVersion?.id && item.is_active),
    [selectedVersion?.id, workspace?.sections]
  );
  const items = useMemo(
    () => (workspace?.items || []).filter((item) => item.version_id === selectedVersion?.id),
    [selectedVersion?.id, workspace?.items]
  );
  const selectedSection = sections.find((item) => item.id === selectedSectionId) || sections[0];
  const sectionItems = items.filter((item) => item.section_id === selectedSection?.id);
  const visibleItems = sectionItems.filter((item) => {
    const normalizedSearch = search.trim().toLocaleLowerCase("vi");
    const matchesSearch = !normalizedSearch || `${item.item_code} ${item.content}`.toLocaleLowerCase("vi").includes(normalizedSearch);
    const matchesFilter =
      filter === "all"
      || (filter === "photo" && item.evidence_rule !== "never")
      || (filter === "critical" && item.is_critical)
      || (filter === "inactive" && !item.is_active);
    return matchesSearch && matchesFilter;
  });
  const activeItems = items.filter((item) => item.is_active);
  const totalWeight = activeItems.reduce((sum, item) => sum + Number(item.weight), 0);
  const weightDifference = Number(selectedVersion?.total_weight || 100) - totalWeight;
  const canEdit = selectedVersion?.status === "draft";
  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "history", label: "Lịch sử kiểm tra" },
    { id: "schedule", label: "Lịch kiểm tra" },
    { id: "config", label: "Cấu hình checklist" }
  ];

  useEffect(() => {
    if (!selectedVersionId && selectedVersion?.id) setSelectedVersionId(selectedVersion.id);
  }, [selectedVersion?.id, selectedVersionId]);

  useEffect(() => {
    setSelectedSectionId((current) => sections.some((section) => section.id === current) ? current : sections[0]?.id || "");
  }, [sections]);

  useEffect(() => {
    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem || selectedItem.section_id !== selectedSection?.id) {
      const firstItem = items.find((item) => item.section_id === selectedSection?.id);
      setSelectedItemId(firstItem?.id || "");
      setForm(firstItem ? toItemForm(firstItem, selectedSection, selectedVersion, 0) : null);
      return;
    }
    setForm(toItemForm(selectedItem, selectedSection, selectedVersion, 0));
  }, [items, selectedItemId, selectedSection, selectedVersion]);

  function selectItem(item) {
    setSelectedItemId(item.id);
    setForm(toItemForm(item, selectedSection, selectedVersion, 0));
  }

  function addItem() {
    const nextOrder = Math.max(0, ...sectionItems.map((item) => item.display_order)) + 1;
    setSelectedItemId("");
    setForm(toItemForm(null, selectedSection, selectedVersion, nextOrder));
  }

  async function handleSave(event) {
    event.preventDefault();
    const saved = await checklist.run(
      () => saveChecklistCriterion(form),
      form.id ? "Đã cập nhật tiêu chí." : "Đã thêm tiêu chí mới."
    );
    if (!saved || form.id) return;
    setForm(null);
  }

  async function handleClone(version) {
    const cloned = await checklist.run(
      () => cloneChecklistVersion(version.id),
      `Đã tạo bản nháp mới từ phiên bản ${version.version_number}.`
    );
    if (cloned) setSelectedVersionId("");
  }

  async function handleCancelDraft(version) {
    const cancelled = await checklist.run(
      () => cancelChecklistDraft(version.id),
      `Đã hủy bản nháp v${version.version_number}. Phiên bản đang áp dụng được giữ nguyên.`
    );
    if (cancelled) {
      setCancelDraftId("");
      setSelectedVersionId(published?.id || "");
      setSelectedItemId("");
    }
  }

  if (activeTab !== "config") {
    return <div className="checklist-admin-page">
      <nav className="checklist-admin-tabs">
        {tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>
      <AdminSupervisionReports branches={branches} view={activeTab} />
    </div>;
  }

  return <div className="checklist-admin-page">
    <nav className="checklist-admin-tabs">
      {tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </nav>

    <header className="checklist-config-heading">
      <div>
        <p>Cấu hình vận hành</p>
        <h1>Checklist cửa hàng</h1>
        <span>Chọn nhóm, chọn tiêu chí rồi chỉnh ngay trong cùng một màn hình.</span>
      </div>
      <div>
        {!draft && template ? <AdminButton disabled={checklist.saving} onClick={() => checklist.run(() => createChecklistDraft(template.id), "Đã tạo bản nháp để chỉnh sửa.")}>Tạo bản chỉnh sửa</AdminButton> : null}
        {draft ? <AdminButton disabled={checklist.saving || totalWeight !== Number(draft.total_weight)} onClick={() => checklist.run(() => publishChecklistVersion(draft.id), "Đã công bố phiên bản checklist mới.")}>Công bố phiên bản {draft.version_number}</AdminButton> : null}
      </div>
    </header>

    <div className="checklist-version-bar">
      <div>
        <span className={`version-status ${selectedVersion?.status || ""}`}>{VERSION_LABELS[selectedVersion?.status] || "Chưa có phiên bản"}</span>
        <strong>{selectedVersion ? `Phiên bản ${selectedVersion.version_number}` : "—"}</strong>
        <small>{canEdit ? "Mọi thay đổi đang được lưu vào bản nháp." : "Phiên bản này chỉ được xem để bảo toàn lịch sử."}</small>
      </div>
      <div className={`weight-meter${weightDifference === 0 ? " valid" : " invalid"}`}>
        <span><strong>{totalWeight}/100 điểm</strong><small>{weightDifference === 0 ? "Đã cân bằng" : weightDifference > 0 ? `Còn thiếu ${weightDifference} điểm` : `Đang vượt ${Math.abs(weightDifference)} điểm`}</small></span>
        <i><b style={{ width: `${Math.min(100, Math.max(0, totalWeight))}%` }} /></i>
      </div>
    </div>

    <details className="checklist-version-history">
      <summary><span><strong>Lịch sử phiên bản</strong><small>{versions.length} phiên bản được lưu</small></span><b>Xem lịch sử</b></summary>
      <div>
        {versions.map((version) => <article key={version.id} className={selectedVersion?.id === version.id ? "selected" : ""}>
          <button type="button" onClick={() => { setSelectedVersionId(version.id); setSelectedItemId(""); }}>
            <span className={`version-number ${version.status}`}>v{version.version_number}</span>
            <span><strong>{VERSION_LABELS[version.status]}</strong><small>{formatDate(version.published_at || version.created_at)}</small></span>
          </button>
          {version.status !== "draft" ? <AdminButton variant="secondary" disabled={Boolean(draft) || checklist.saving} onClick={() => handleClone(version)}>Sao chép để sử dụng</AdminButton> : cancelDraftId === version.id ? <div className="cancel-draft-confirm"><span>Hủy toàn bộ thay đổi của v{version.version_number}?</span><button type="button" onClick={() => setCancelDraftId("")}>Giữ lại</button><button type="button" className="danger" disabled={checklist.saving} onClick={() => handleCancelDraft(version)}>Xác nhận hủy</button></div> : <div className="draft-version-actions"><AdminBadge tone="warning">Đang chỉnh sửa</AdminBadge><button type="button" className="cancel-draft-button" onClick={() => setCancelDraftId(version.id)}>Hủy bản nháp</button></div>}
        </article>)}
        {draft ? <p>Đang có bản nháp v{draft.version_number}. Hãy công bố bản nháp trước khi sao chép một phiên bản khác.</p> : null}
      </div>
    </details>

    {checklist.error ? <p className="checklist-admin-message error">{checklist.error}</p> : null}
    {checklist.message ? <p className="checklist-admin-message success">{checklist.message}</p> : null}
    {checklist.loading ? <AdminCard><AdminEmptyState message="Đang tải checklist…" /></AdminCard> : null}
    {!checklist.loading && !selectedVersion ? <AdminCard><AdminEmptyState message="Chưa có mẫu checklist hoạt động." /></AdminCard> : null}

    {selectedVersion ? <section className="checklist-config-workspace">
      <aside className="checklist-section-rail">
        <header><strong>Nhóm kiểm tra</strong><small>{sections.length} nhóm</small></header>
        <nav>{sections.map((section) => {
          const scopedItems = items.filter((item) => item.section_id === section.id && item.is_active);
          const scopedWeight = scopedItems.reduce((sum, item) => sum + Number(item.weight), 0);
          return <button type="button" key={section.id} className={selectedSection?.id === section.id ? "active" : ""} onClick={() => { setSelectedSectionId(section.id); setSelectedItemId(""); }}>
            <span>{String(section.display_order).padStart(2, "0")}</span>
            <div><strong>{section.name}</strong><small>{scopedItems.length} tiêu chí · {scopedWeight} điểm</small></div>
          </button>;
        })}</nav>
      </aside>

      <section className="checklist-item-browser">
        <header>
          <div><strong>{selectedSection?.name}</strong><small>{sectionItems.length} tiêu chí trong nhóm</small></div>
          {canEdit ? <AdminButton variant="secondary" onClick={addItem}>+ Thêm tiêu chí</AdminButton> : null}
        </header>
        <div className="checklist-item-filters">
          <input type="search" value={search} placeholder="Tìm theo mã hoặc nội dung…" onChange={(event) => setSearch(event.target.value)} />
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Tất cả tiêu chí</option>
            <option value="photo">Có yêu cầu ảnh</option>
            <option value="critical">Lỗi nghiêm trọng</option>
            <option value="inactive">Đang tắt</option>
          </select>
        </div>
        <div className="checklist-item-list">
          {visibleItems.map((item) => <button type="button" key={item.id} className={`${selectedItemId === item.id ? "active" : ""}${item.is_active ? "" : " inactive"}`} onClick={() => selectItem(item)}>
            <code>{item.item_code}</code>
            <span><strong>{item.content}</strong><small>{EVIDENCE_LABELS[item.evidence_rule]} · {PENALTY_LABELS[item.default_penalty_level]}</small></span>
            <b>{Number(item.weight)}</b>
          </button>)}
          {!visibleItems.length ? <AdminEmptyState message="Không tìm thấy tiêu chí phù hợp." /> : null}
        </div>
      </section>

      <aside className="checklist-item-editor">
        <header>
          <div><strong>{form?.id ? "Chỉnh sửa tiêu chí" : form ? "Thêm tiêu chí" : "Chi tiết tiêu chí"}</strong><small>{canEdit ? "Thay đổi chỉ ảnh hưởng bản nháp." : `Đang xem phiên bản ${selectedVersion.version_number}.`}</small></div>
          {form?.id ? <code>{items.find((item) => item.id === form.id)?.item_code}</code> : null}
        </header>
        {form ? <form onSubmit={handleSave}>
          <label><span>Nội dung kiểm tra <b>*</b></span><textarea required rows="5" disabled={!canEdit} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
          <label><span>Hướng dẫn cho giám sát</span><textarea rows="3" disabled={!canEdit} value={form.guidance} onChange={(event) => setForm({ ...form, guidance: event.target.value })} /></label>
          <div className="checklist-editor-grid">
            <label><span>Trọng số</span><AdminInput required disabled={!canEdit} type="number" min="0.01" step="0.01" value={form.weight} onValueChange={(value) => setForm({ ...form, weight: value })} /></label>
            <label><span>Yêu cầu hình ảnh</span><AdminSelect disabled={!canEdit} value={form.evidenceRule} onChange={(event) => setForm({ ...form, evidenceRule: event.target.value })} options={Object.entries(EVIDENCE_LABELS).map(([value, label]) => ({ value, label }))} /></label>
            <label><span>Mức vi phạm</span><AdminSelect disabled={!canEdit} value={form.defaultPenaltyLevel} onChange={(event) => setForm({ ...form, defaultPenaltyLevel: event.target.value })} options={Object.entries(PENALTY_LABELS).map(([value, label]) => ({ value, label }))} /></label>
          </div>
          <div className="checklist-editor-switches">
            <label><input type="checkbox" disabled={!canEdit} checked={form.isCritical} onChange={(event) => setForm({ ...form, isCritical: event.target.checked })} /><span><strong>Lỗi nghiêm trọng</strong><small>Đánh dấu rõ trong biên bản khi không đạt.</small></span></label>
            {form.id ? <label><input type="checkbox" disabled={!canEdit} checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span><strong>Đang sử dụng</strong><small>Tắt để bỏ khỏi lần kiểm tra tiếp theo.</small></span></label> : null}
          </div>
          {canEdit ? <footer><AdminButton disabled={checklist.saving}>{checklist.saving ? "Đang lưu…" : "Lưu tiêu chí"}</AdminButton></footer> : null}
        </form> : <AdminEmptyState message="Chọn một tiêu chí để xem chi tiết." />}
      </aside>
    </section> : null}
  </div>;
}
