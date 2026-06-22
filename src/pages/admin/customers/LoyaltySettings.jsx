import { useMemo, useState } from "react";
import {
  getLoyaltyEarnPercent,
  getLoyaltyTierIconSymbol,
  LOYALTY_TIER_ICON_OPTIONS,
  normalizeLoyaltyProgramConfig
} from "../../../services/loyaltyProgramConfigService.js";
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from "../ui/index.js";

function formatPercent(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function updateLoyaltyConfig(setCrmSnapshot, patch) {
  setCrmSnapshot((current) => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      ...patch
    }
  }));
}

function updateTier(setCrmSnapshot, tierIndex, patch) {
  setCrmSnapshot((current) => {
    const normalized = normalizeLoyaltyProgramConfig(current?.loyaltyConfig || {});
    const tiers = normalized.tiers.map((tier, index) => (
      index === tierIndex ? { ...tier, ...patch } : tier
    ));
    return {
      ...current,
      loyaltyConfig: {
        ...(current?.loyaltyConfig || {}),
        tiers
      }
    };
  });
}

function updateStreakReward(setCrmSnapshot, day, value) {
  setCrmSnapshot((current) => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      streakRewards: {
        ...(current?.loyaltyConfig?.streakRewards || {}),
        [day]: Math.max(0, Number(value || 0))
      }
    }
  }));
}

export default function LoyaltySettings({
  crmSnapshot,
  setCrmSnapshot,
  onSave,
  coupons = []
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const config = normalizeLoyaltyProgramConfig(crmSnapshot?.loyaltyConfig || {});
  const loyaltyVouchers = useMemo(() => (
    (coupons || [])
      .filter((coupon) => coupon?.active !== false && String(coupon?.voucherType || "checkout") === "loyalty")
      .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || "")))
  ), [coupons]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    const payload = normalizeLoyaltyProgramConfig(crmSnapshot?.loyaltyConfig || {});

    try {
      setCrmSnapshot((current) => ({ ...current, loyaltyConfig: payload }));
      await Promise.resolve(onSave?.(payload));
      setSaveMessage("Đã lưu và kích hoạt phiên bản cấu hình loyalty mới.");
    } catch (error) {
      const detail = String(error?.message || "").trim();
      setSaveMessage(detail
        ? `Không thể lưu cấu hình: ${detail}`
        : "Không thể lưu cấu hình loyalty.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-stack admin-loyalty-settings">
      <AdminPanel
        title="Trung tâm Loyalty"
        action={(
          <AdminButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu và kích hoạt"}
          </AdminButton>
        )}
      >
        <div className="admin-loyalty-overview">
          <div><span>Quy đổi điểm</span><strong>1 điểm = 1đ</strong></div>
          <div><span>Dùng điểm tối đa</span><strong>50% giá trị đơn</strong></div>
          <div><span>Hết hạn điểm</span><strong>12 tháng từ lần mua cuối</strong></div>
          <div><span>Chu kỳ hạng</span><strong>Theo năm dương lịch</strong></div>
        </div>
      </AdminPanel>

      {saveMessage ? (
        <p className="admin-loyalty-save-message" role="status">{saveMessage}</p>
      ) : null}

      <AdminPanel title="5 hạng thành viên" className="admin-loyalty-card">
        <div className="admin-loyalty-tier-list">
          <div className="admin-loyalty-tier-header" aria-hidden="true">
            <span>Tên và icon</span><span>Mốc chi tiêu năm</span><span>Tích điểm</span><span>Tỷ lệ</span><span>Quà đạt mốc</span>
          </div>
          {config.tiers.map((tier, index) => {
            const earnPercent = getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit);
            return (
              <div className="admin-loyalty-tier-row" key={tier.id}>
                <div className="admin-loyalty-tier-identity">
                  <div className="admin-loyalty-tier-preview">
                    <span className="admin-loyalty-tier-symbol" aria-hidden="true">
                      {getLoyaltyTierIconSymbol(tier.iconKey)}
                    </span>
                    <div><strong>{tier.name}</strong><small>ID: {tier.id}</small></div>
                  </div>
                  <div className="admin-loyalty-tier-identity-fields">
                    <label className="admin-loyalty-field">
                      <span>Tên hiển thị</span>
                      <AdminInput
                        value={tier.name}
                        maxLength={40}
                        onChange={(event) => updateTier(setCrmSnapshot, index, {
                          name: event.target.value
                        })}
                      />
                    </label>
                    <label className="admin-loyalty-field">
                      <span>Icon</span>
                      <AdminSelect
                        value={tier.iconKey}
                        onChange={(event) => updateTier(setCrmSnapshot, index, {
                          iconKey: event.target.value
                        })}
                      >
                        {LOYALTY_TIER_ICON_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.symbol} {option.label}
                          </option>
                        ))}
                      </AdminSelect>
                    </label>
                  </div>
                </div>
                <label className="admin-loyalty-field">
                  <span>Mốc chi tiêu năm</span>
                  <AdminInput
                    type="number"
                    min="0"
                    step="100000"
                    value={tier.minAnnualSpend}
                    disabled={index === 0}
                    onChange={(event) => updateTier(setCrmSnapshot, index, {
                      minAnnualSpend: Math.max(0, Number(event.target.value || 0))
                    })}
                  />
                </label>
                <div className="admin-loyalty-rate-inputs">
                  <label className="admin-loyalty-field">
                    <span>Số tiền</span>
                    <AdminInput
                      type="number"
                      min="1"
                      value={tier.currencyPerPoint}
                      onChange={(event) => updateTier(setCrmSnapshot, index, {
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
                      onChange={(event) => updateTier(setCrmSnapshot, index, {
                        pointPerUnit: Math.max(1, Number(event.target.value || 1))
                      })}
                    />
                  </label>
                </div>
                <div className="admin-loyalty-percent">
                  <strong>{formatPercent(earnPercent)}%</strong>
                  <small>{tier.currencyPerPoint.toLocaleString("vi-VN")}đ = {tier.pointPerUnit.toLocaleString("vi-VN")} điểm</small>
                </div>
                <label className="admin-loyalty-field">
                  <span>Voucher tự tặng</span>
                  <AdminSelect
                    value={tier.milestoneVoucherId}
                    onChange={(event) => updateTier(setCrmSnapshot, index, {
                      milestoneVoucherId: event.target.value
                    })}
                  >
                    <option value="">Chưa gán voucher</option>
                    {loyaltyVouchers.map((voucher) => (
                      <option key={voucher.id || voucher.code} value={voucher.id || voucher.code}>
                        {voucher.code || "Không có mã"} - {voucher.title || voucher.name || "Voucher loyalty"}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
              </div>
            );
          })}
        </div>
        <p className="admin-loyalty-note">
          Đơn tiền lẻ được tính bằng công thức làm tròn xuống. Không gán voucher vẫn thăng hạng bình thường.
        </p>
      </AdminPanel>

      <AdminPanel title="Điểm danh" className="admin-loyalty-card">
        <div className="admin-loyalty-checkin-head">
          <label className="admin-loyalty-toggle">
            <input
              type="checkbox"
              checked={config.checkinEnabled}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { checkinEnabled: event.target.checked })}
            />
            <span>Bật chương trình điểm danh</span>
          </label>
        </div>
        <div className="admin-loyalty-checkin-grid">
          <label className="admin-loyalty-field">
            <span>Mỗi ngày</span>
            <AdminInput
              type="number"
              min="0"
              value={config.checkinDailyPoints}
              disabled={!config.checkinEnabled}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, {
                checkinDailyPoints: Math.max(0, Number(event.target.value || 0))
              })}
            />
          </label>
          {[7, 14, 30].map((day) => (
            <label className="admin-loyalty-field" key={day}>
              <span>Chuỗi {day} ngày</span>
              <AdminInput
                type="number"
                min="0"
                value={config.streakRewards[day]}
                disabled={!config.checkinEnabled}
                onChange={(event) => updateStreakReward(setCrmSnapshot, day, event.target.value)}
              />
            </label>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}
