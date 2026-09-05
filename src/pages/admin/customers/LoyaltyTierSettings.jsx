import { useState } from "react";
import { adminFeatureFlags } from "../../../constants/featureFlags.js";
import {
  getLoyaltyEarnPercent,
  getLoyaltyTierIconSymbol,
  LOYALTY_TIER_ICON_OPTIONS
} from "../../../services/loyaltyProgramConfigService.js";
import { AdminInput, AdminPanel, AdminSelect } from "../ui/index.js";

function formatPercent(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default function LoyaltyTierSettings({
  tiers = [],
  assignedVoucherCount = 0,
  maxEarnPercent = 0,
  onTierChange
}) {
  const [expandedTierId, setExpandedTierId] = useState("");

  return (
    <AdminPanel
      title="Hạng thành viên"
      description="Bấm vào một hạng để xem và chỉnh cấu hình chi tiết."
      className="admin-loyalty-card"
      action={(
        <div className="admin-loyalty-panel-summary">
          <span>{tiers.length} hạng</span>
          <span>Cao nhất {formatPercent(maxEarnPercent)}%</span>
          {adminFeatureFlags.showLoyaltyVoucherSettings ? <span>{assignedVoucherCount} voucher đã gắn</span> : null}
        </div>
      )}
    >
      <div className="admin-loyalty-tier-list">
        {tiers.map((tier, index) => {
          const earnPercent = getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit);
          const expanded = expandedTierId === tier.id;
          return (
            <article className={`admin-loyalty-tier-row ${expanded ? "is-expanded" : ""}`} key={tier.id}>
              <button
                type="button"
                className="admin-loyalty-tier-toggle"
                aria-expanded={expanded}
                onClick={() => setExpandedTierId(expanded ? "" : tier.id)}
              >
                <span className="admin-loyalty-tier-symbol" aria-hidden="true">
                  {getLoyaltyTierIconSymbol(tier.iconKey)}
                </span>
                <span className="admin-loyalty-tier-name">
                  <small>Hạng {index + 1}</small>
                  <strong>{tier.name}</strong>
                </span>
                <span className="admin-loyalty-tier-threshold">
                  <small>Mốc chi tiêu năm</small>
                  <strong>{index === 0 ? "Mặc định" : formatCurrency(tier.minAnnualSpend)}</strong>
                </span>
                <span className="admin-loyalty-tier-rate">
                  <small>Tích điểm</small>
                  <strong>{formatPercent(earnPercent)}%</strong>
                </span>
                <span className="admin-loyalty-tier-chevron" aria-hidden="true">⌄</span>
              </button>

              {expanded ? (
                <div className="admin-loyalty-tier-editor">
                  <label className="admin-loyalty-field">
                    <span>Tên hiển thị</span>
                    <AdminInput
                      value={tier.name}
                      maxLength={40}
                      onChange={(event) => onTierChange?.(index, { name: event.target.value })}
                    />
                  </label>

                  <label className="admin-loyalty-field">
                    <span>Icon</span>
                    <AdminSelect
                      value={tier.iconKey}
                      onChange={(event) => onTierChange?.(index, { iconKey: event.target.value })}
                    >
                      {LOYALTY_TIER_ICON_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.symbol} {option.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>

                  <label className="admin-loyalty-field">
                    <span>Mốc chi tiêu năm</span>
                    <AdminInput
                      type="number"
                      min="0"
                      step="100000"
                      value={tier.minAnnualSpend}
                      disabled={index === 0}
                      onChange={(event) => onTierChange?.(index, {
                        minAnnualSpend: Math.max(0, Number(event.target.value || 0))
                      })}
                    />
                    {index === 0 ? <small className="admin-loyalty-field-note">Hạng đầu tiên luôn bắt đầu từ 0đ.</small> : null}
                  </label>

                  <div className="admin-loyalty-rate-card">
                    <div className="admin-loyalty-rate-card-head">
                      <span>Công thức tích điểm</span>
                      <small>{tier.currencyPerPoint.toLocaleString("vi-VN")}đ = {tier.pointPerUnit.toLocaleString("vi-VN")} điểm</small>
                    </div>
                    <div className="admin-loyalty-rate-inputs">
                      <label className="admin-loyalty-field">
                        <span>Số tiền</span>
                        <AdminInput
                          type="number"
                          min="1"
                          value={tier.currencyPerPoint}
                          onChange={(event) => onTierChange?.(index, {
                            currencyPerPoint: Math.max(1, Number(event.target.value || 1))
                          })}
                        />
                      </label>
                      <span className="admin-loyalty-rate-equals">=</span>
                      <label className="admin-loyalty-field">
                        <span>Điểm</span>
                        <AdminInput
                          type="number"
                          min="1"
                          value={tier.pointPerUnit}
                          onChange={(event) => onTierChange?.(index, {
                            pointPerUnit: Math.max(1, Number(event.target.value || 1))
                          })}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="admin-loyalty-note">
        Đơn tiền lẻ được làm tròn xuống.
        {adminFeatureFlags.showLoyaltyVoucherSettings ? " Voucher của từng hạng được quản lý tại thẻ Thưởng tự động." : ""}
      </p>
    </AdminPanel>
  );
}
