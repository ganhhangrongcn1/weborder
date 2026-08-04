import Icon from "../../../components/Icon.jsx";
import { AdminBadge, AdminButton, AdminCard } from "../ui/AdminCommon.jsx";
import {
  PARTNER_REVIEW_INTERVAL_OPTIONS,
  badgeTone,
  formatReviewDate,
  intervalLabel,
  isStoreControlSelected,
  platformName,
  syncStatusLabel
} from "./partnerReviewUi.js";

export default function PartnerReviewOperations({
  sources = [],
  loading = false,
  settings,
  settingsSaving = false,
  workerStarting = false,
  storeControlSaving = "",
  onSettingsChange,
  onSaveSchedule,
  onRunNow,
  onCreateSource,
  onEditSource,
  onStoreControl
}) {
  const healthySources = sources.filter((source) => source.sync_status === "success").length;

  return (
    <details className="admin-review-operations">
      <summary>
        <div className="admin-review-operations-summary-icon"><Icon name="gear" size={19} /></div>
        <div>
          <strong>Gian hàng và đồng bộ</strong>
          <span>{sources.length} gian hàng · {healthySources}/{sources.length || 0} đồng bộ ổn định · Lần kế tiếp {formatReviewDate(settings.next_worker_cycle_at)}</span>
        </div>
        <span className="admin-review-operations-toggle">Mở cấu hình <Icon name="back" size={15} /></span>
      </summary>

      <div className="admin-review-operations-content">
        <AdminCard className="admin-review-schedule-card">
          <div className="admin-review-schedule-copy">
            <div className="admin-review-schedule-icon"><Icon name="refresh" size={20} /></div>
            <div>
              <h2>Lịch đồng bộ tự động</h2>
              <p>Worker chạy nền và lấy đánh giá theo chu kỳ đã chọn.</p>
              <small>Lần chạy gần nhất: {formatReviewDate(settings.last_worker_cycle_at)} · Lần kế tiếp: {formatReviewDate(settings.next_worker_cycle_at)}</small>
            </div>
          </div>
          <div className="admin-review-schedule-control">
            <label>
              <span>Đồng bộ lại sau mỗi</span>
              <select value={settings.sync_interval_minutes || 60} onChange={(event) => onSettingsChange(Number(event.target.value))}>
                {PARTNER_REVIEW_INTERVAL_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{intervalLabel(minutes)}</option>)}
              </select>
            </label>
            <AdminButton type="button" onClick={onSaveSchedule} disabled={settingsSaving}>{settingsSaving ? "Đang lưu..." : "Lưu lịch"}</AdminButton>
            <AdminButton type="button" variant="secondary" onClick={onRunNow} disabled={workerStarting}><Icon name="play" size={16} /> {workerStarting ? "Đang gửi..." : "Đồng bộ ngay"}</AdminButton>
          </div>
        </AdminCard>

        <AdminCard className="admin-review-source-card">
          <div className="admin-review-head">
            <div><h2>Nguồn đánh giá</h2><p>Một chi nhánh có thể có nhiều gian hàng đối tác.</p></div>
            <AdminButton onClick={onCreateSource}><Icon name="plus" size={16} /> Thêm gian hàng</AdminButton>
          </div>
          {loading ? <p className="admin-review-note">Đang tải dữ liệu...</p> : null}
          <div className="admin-review-list">
            {sources.map((source) => (
              <article key={source.id}>
                <div className="admin-review-source-main">
                  <span className={`admin-review-platform is-${source.platform}`}>{platformName(source.platform)}</span>
                  <div className="admin-review-source-identity">
                    <div className="admin-review-name"><strong>{source.display_name}</strong><small>{source.branch_code || "Chưa có mã"} · {source.account_key}</small></div>
                    <div className="admin-review-badges">
                      <AdminBadge tone={badgeTone(source.auth_status)}>{source.credentials_configured ? "Đã lưu đăng nhập" : "Thiếu đăng nhập"}</AdminBadge>
                      <AdminBadge tone={source.sync_enabled ? "success" : "neutral"}>{source.sync_enabled ? "Đang bật" : "Đã tắt"}</AdminBadge>
                      <AdminBadge tone={badgeTone(source.sync_status)}>{syncStatusLabel(source.sync_status)}</AdminBadge>
                    </div>
                  </div>
                </div>
                <div className="admin-review-source-actions">
                  {source.platform === "grabfood" ? (
                    <div className={`admin-review-store-control is-${source.store_control_status || "idle"}`}>
                      <button type="button" className={`is-busy ${isStoreControlSelected(source, "busy") ? "is-selected" : ""}`} disabled={Boolean(storeControlSaving) || ["pending", "running"].includes(source.store_control_status)} onClick={() => onStoreControl(source, "busy")}>
                        {storeControlSaving === `${source.id}:busy` ? "Đang gửi..." : "Bận 15 phút"}
                      </button>
                      <button type="button" className={`is-normal ${isStoreControlSelected(source, "normal") ? "is-selected" : ""}`} disabled={Boolean(storeControlSaving) || ["pending", "running"].includes(source.store_control_status)} onClick={() => onStoreControl(source, "normal")}>
                        {storeControlSaving === `${source.id}:normal` ? "Đang gửi..." : "Mở bình thường"}
                      </button>
                    </div>
                  ) : null}
                  <button type="button" className="admin-review-edit" onClick={() => onEditSource(source)}><Icon name="edit" size={15} /> Sửa</button>
                </div>
              </article>
            ))}
          </div>
        </AdminCard>
      </div>
    </details>
  );
}
