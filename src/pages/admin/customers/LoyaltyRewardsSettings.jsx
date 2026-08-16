import { Link } from "react-router-dom";
import { buildLoyaltyVoucherChecklist } from "../../../services/loyaltyVoucherPresetService.js";
import { getLoyaltyTierIconSymbol } from "../../../services/loyaltyProgramConfigService.js";
import { AdminInput, AdminPanel, AdminSelect } from "../ui/index.js";

function getStatusLabel(status = "") {
  const labels = {
    ready: "Sẵn sàng",
    missing: "Chưa gắn",
    inactive: "Đang tắt",
    expired: "Hết hạn",
    optional: "Tùy chọn"
  };
  return labels[status] || "Cần kiểm tra";
}

function getStatusTone(status = "") {
  if (status === "ready") return "claimed";
  if (status === "inactive" || status === "expired") return "blocked";
  if (status === "optional") return "unknown";
  return "pending";
}

export default function LoyaltyRewardsSettings({
  config,
  loyaltyCoupons = [],
  assignedVoucherCount = 0,
  onConfigChange,
  onStreakChange,
  onTierChange
}) {
  const voucherChecklist = buildLoyaltyVoucherChecklist(config.tiers, loyaltyCoupons);

  return (
    <AdminPanel
      title="Thưởng tự động"
      description="Gắn quà theo hạng và bật những chương trình thưởng đang thực sự sử dụng."
      className="admin-loyalty-card"
    >
      <section className="admin-loyalty-reward-section">
        <div className="admin-loyalty-section-head">
          <div>
            <h3>Voucher hạng theo tháng</h3>
            <p>Mỗi hạng nhận tối đa một voucher mỗi tháng.</p>
          </div>
          <div className="admin-loyalty-section-actions">
            <span>{assignedVoucherCount}/{config.tiers.length} hạng đã gắn</span>
            <Link to="/admin/vouchers">Mở kho voucher</Link>
          </div>
        </div>

        <div className="admin-loyalty-voucher-list">
          {voucherChecklist.map(({ tier, status }, index) => (
            <article className="admin-loyalty-voucher-row" key={tier.id}>
              <div className="admin-loyalty-voucher-tier">
                <span className="admin-loyalty-tier-symbol" aria-hidden="true">
                  {getLoyaltyTierIconSymbol(tier.iconKey)}
                </span>
                <div>
                  <small>Hạng {index + 1}</small>
                  <strong>{tier.name}</strong>
                </div>
              </div>
              <AdminSelect
                aria-label={`Voucher cho hạng ${tier.name}`}
                value={tier.milestoneVoucherId}
                onChange={(event) => onTierChange?.(index, { milestoneVoucherId: event.target.value })}
              >
                <option value="">Chưa gắn voucher</option>
                {loyaltyCoupons.map((voucher) => (
                  <option key={voucher.id || voucher.code} value={voucher.id || voucher.code}>
                    {voucher.code || "Không có mã"} - {voucher.name || voucher.title || "Voucher loyalty"}{voucher.active === false ? " (đang tắt)" : ""}
                  </option>
                ))}
              </AdminSelect>
              <span className={`crm-point-status crm-point-status--${getStatusTone(status)}`}>
                {getStatusLabel(status)}
              </span>
            </article>
          ))}
        </div>
      </section>

      <details className="admin-loyalty-subdetails">
        <summary>
          <div>
            <strong>Chương trình điểm danh</strong>
            <small>Thưởng khách ghé Gánh theo ngày và chuỗi 7, 15, 30 ngày.</small>
          </div>
          <span className={config.checkinEnabled ? "is-on" : ""}>
            {config.checkinEnabled ? "Đang bật" : "Đang tắt"}
          </span>
        </summary>
        <div className="admin-loyalty-checkin-body">
          <label className="admin-loyalty-toggle">
            <input
              type="checkbox"
              checked={config.checkinEnabled}
              onChange={(event) => onConfigChange?.({ checkinEnabled: event.target.checked })}
            />
            <span>Bật chương trình điểm danh</span>
          </label>
          <div className="admin-loyalty-checkin-grid">
            <label className="admin-loyalty-field">
              <span>Mỗi ngày</span>
              <AdminInput
                type="number"
                min="0"
                value={config.checkinDailyPoints}
                disabled={!config.checkinEnabled}
                onChange={(event) => onConfigChange?.({
                  checkinDailyPoints: Math.max(0, Number(event.target.value || 0))
                })}
              />
            </label>
            {[7, 15, 30].map((day) => (
              <label className="admin-loyalty-field" key={day}>
                <span>Chuỗi {day} ngày</span>
                <AdminInput
                  type="number"
                  min="0"
                  value={config.streakRewards[day]}
                  disabled={!config.checkinEnabled}
                  onChange={(event) => onStreakChange?.(day, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </details>
    </AdminPanel>
  );
}
