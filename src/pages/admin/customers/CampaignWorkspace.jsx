import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "draft", label: "Bản nháp" },
  { value: "scheduled", label: "Đã đặt lịch" },
  { value: "paused", label: "Tạm dừng" },
  { value: "completed", label: "Đã chạy" }
];

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "Bản nháp";
}

function formatCampaignDate(value) {
  if (!value) return "Chưa đặt lịch";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function CampaignWorkspace({
  campaigns = [],
  presets = [],
  onCreate,
  onCreateFromPreset,
  onEdit,
  onPrepare,
  onStatusChange,
  onDelete
}) {
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState("");

  const summary = useMemo(() => campaigns.reduce((result, campaign) => {
    result.total += 1;
    result[campaign.status] = Number(result[campaign.status] || 0) + 1;
    result.success += Number(campaign.successCount || 0);
    return result;
  }, { total: 0, draft: 0, scheduled: 0, paused: 0, completed: 0, success: 0 }), [campaigns]);

  const visibleCampaigns = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const matchesKeyword = !normalizedKeyword || [campaign.name, campaign.voucherCode, campaign.voucherName]
        .some((value) => String(value || "").toLowerCase().includes(normalizedKeyword));
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [campaigns, keyword, statusFilter]);

  return (
    <section className="crm-campaign-manager">
      <header className="crm-campaign-manager__head">
        <div>
          <span>CRM chiến dịch</span>
          <h2>Quản lý chiến dịch voucher</h2>
          <p>Tạo kế hoạch, chọn đúng nhóm khách rồi dùng lại luồng kiểm tra và tặng voucher an toàn của GHR.</p>
        </div>
        <button type="button" className="crm-campaign-primary" onClick={() => onCreate("")}>+ Tạo chiến dịch</button>
      </header>

      <div className="crm-campaign-kpis">
        <article><span>Chiến dịch</span><strong>{summary.total.toLocaleString("vi-VN")}</strong></article>
        <article><span>Bản nháp</span><strong>{summary.draft.toLocaleString("vi-VN")}</strong></article>
        <article><span>Đã đặt lịch</span><strong>{summary.scheduled.toLocaleString("vi-VN")}</strong></article>
        <article><span>Voucher đã cấp</span><strong>{summary.success.toLocaleString("vi-VN")}</strong></article>
      </div>

      {campaigns.length ? (
        <>
          <div className="crm-campaign-manager__tools">
            <label>
              <Icon name="search" size={17} />
              <input value={keyword} placeholder="Tìm tên hoặc mã voucher..." onChange={(event) => setKeyword(event.target.value)} />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="crm-campaign-record-list">
            {visibleCampaigns.map((campaign) => {
              const isPaused = campaign.status === "paused";
              const isCompleted = campaign.status === "completed";
              const resumeStatus = campaign.plannedAt ? "scheduled" : "draft";
              return (
                <article key={campaign.id} className="crm-campaign-record">
                  <div className="crm-campaign-record__main">
                    <div className="crm-campaign-record__title">
                      <span className={`crm-campaign-status is-${campaign.status}`}>{getStatusLabel(campaign.status)}</span>
                      <strong>{campaign.name}</strong>
                      <small>{campaign.description || "Chưa có ghi chú nội bộ."}</small>
                    </div>
                    <div className="crm-campaign-record__meta">
                      <span><b>Nhóm khách</b>{campaign.objectiveLabel || "Nhóm khách đã chọn"}</span>
                      <span><b>Voucher</b>{campaign.voucherCode || "Chưa chọn"}</span>
                      <span><b>Dự kiến</b>{formatCampaignDate(campaign.plannedAt)}</span>
                      <span><b>Chi nhánh</b>{campaign.branchScope === "all" ? "Tất cả chi nhánh" : campaign.branchScope}</span>
                    </div>
                  </div>

                  <div className="crm-campaign-record__result">
                    <span><b>{Number(campaign.successCount || 0).toLocaleString("vi-VN")}</b>đã cấp</span>
                    <span><b>{Number(campaign.duplicateCount || 0).toLocaleString("vi-VN")}</b>chặn trùng</span>
                    <span><b>{Number(campaign.failedCount || 0).toLocaleString("vi-VN")}</b>lỗi</span>
                  </div>

                  <div className="crm-campaign-record__actions">
                    <button type="button" className="is-secondary" onClick={() => onEdit(campaign)}>Xem / sửa</button>
                    {!isPaused ? (
                      <button type="button" className="is-muted" onClick={() => onStatusChange(campaign.id, "paused")}>Tạm dừng</button>
                    ) : (
                      <button type="button" className="is-muted" onClick={() => onStatusChange(campaign.id, resumeStatus)}>Tiếp tục</button>
                    )}
                    <button type="button" className="is-primary" disabled={isPaused} onClick={() => onPrepare(campaign)}>
                      {isCompleted ? "Chạy lại" : "Chuẩn bị gửi"}
                    </button>
                    {deleteId === campaign.id ? (
                      <span className="crm-campaign-delete-confirm">
                        <button type="button" onClick={() => setDeleteId("")}>Không</button>
                        <button type="button" className="is-danger" onClick={() => onDelete(campaign.id)}>Xác nhận xóa</button>
                      </span>
                    ) : (
                      <button type="button" className="is-danger-text" onClick={() => setDeleteId(campaign.id)}>Xóa</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!visibleCampaigns.length ? (
            <div className="crm-campaign-manager__empty">
              <Icon name="search" size={26} />
              <strong>Không có chiến dịch phù hợp</strong>
              <span>Thử đổi từ khóa hoặc trạng thái lọc.</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="crm-campaign-get-started">
          <div className="crm-campaign-get-started__copy">
            <Icon name="gift" size={28} />
            <strong>Chưa có chiến dịch nào</strong>
            <p>Bắt đầu từ một nhóm khách quen thuộc. Hệ thống chỉ lưu bản nháp và chưa tặng voucher khi tạo.</p>
            <button type="button" className="crm-campaign-primary" onClick={() => onCreate("")}>Tạo chiến dịch đầu tiên</button>
          </div>
          <div className="crm-campaign-template-shortcuts">
            <span>Mẫu dùng nhanh</span>
            {presets.slice(0, 5).map((preset) => (
              <button key={preset.id} type="button" onClick={() => onCreateFromPreset(preset.id)}>
                <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                <b>{Number(preset.count || 0).toLocaleString("vi-VN")} khách</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="crm-campaign-manager__scope-note">
        Giai đoạn 1 quản lý chiến dịch voucher thủ công. Zalo, Email và tự động gửi theo lịch sẽ được bổ sung sau khi có dữ liệu hiệu quả thực tế.
      </p>
    </section>
  );
}
