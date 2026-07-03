import { useMemo, useState } from "react";
import {
  buildLoyaltyVoucherChecklist,
  LOYALTY_VOUCHER_PRESETS
} from "../../../services/loyaltyVoucherPresetService.js";
import {
  getLoyaltyEarnPercent,
  getLoyaltyTierIconSymbol,
  LOYALTY_TIER_ICON_OPTIONS,
  normalizeLoyaltyProgramConfig
} from "../../../services/loyaltyProgramConfigService.js";
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from "../ui/index.js";
import LoyaltyOpsPanel from "./LoyaltyOpsPanel.jsx";

function formatPercent(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
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

function getChecklistLabel(status = "") {
  const labels = {
    ready: "Sẵn sàng",
    missing: "Chưa gắn",
    inactive: "Đang tắt",
    expired: "Hết hạn",
    optional: "Tùy chọn"
  };
  return labels[status] || "Cần kiểm tra";
}

function getChecklistTone(status = "") {
  const tones = {
    ready: "claimed",
    missing: "pending",
    inactive: "blocked",
    expired: "blocked",
    optional: "unknown"
  };
  return tones[status] || "pending";
}

function getTierHint(index) {
  const hints = [
    "Hạng chào khách mới, nên dễ vào và tạo thiện cảm ngay từ đơn đầu.",
    "Mốc đầu tiên để khách thấy hành trình này dễ chạm tới.",
    "Hạng bắt đầu tạo cảm giác thân quen, nên ưu đãi rõ ràng hơn.",
    "Hạng dành cho khách quay lại đều, phù hợp với quà có giá trị hơn.",
    "Hạng cao nhất, giữ tỷ lệ tích điểm tối đa và quà lên hạng nổi bật nhất."
  ];
  return hints[index] || "Điều chỉnh tên, mốc và quà sao cho dễ vận hành lâu dài.";
}

export default function LoyaltySettings({
  crmSnapshot,
  setCrmSnapshot,
  onSave,
  coupons = [],
  refreshCrm
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveTone, setSaveTone] = useState("success");
  const config = normalizeLoyaltyProgramConfig(crmSnapshot?.loyaltyConfig || {});
  const loyaltyCoupons = useMemo(() => (
    (coupons || [])
      .filter((coupon) => String(coupon?.voucherType || "checkout") === "loyalty")
      .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || "")))
  ), [coupons]);
  const voucherChecklist = useMemo(
    () => buildLoyaltyVoucherChecklist(config.tiers, loyaltyCoupons),
    [config.tiers, loyaltyCoupons]
  );
  const assignedVoucherCount = useMemo(
    () => voucherChecklist.filter((item) => item.assignedCoupon).length,
    [voucherChecklist]
  );
  const activeVoucherCount = useMemo(
    () => loyaltyCoupons.filter((voucher) => voucher.active !== false).length,
    [loyaltyCoupons]
  );
  const earnPercents = useMemo(
    () => config.tiers.map((tier) => getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit)),
    [config.tiers]
  );
  const maxEarnPercent = earnPercents.length ? Math.max(...earnPercents) : 0;
  const minEarnPercent = earnPercents.length ? Math.min(...earnPercents) : 0;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    setSaveTone("success");
    const payload = normalizeLoyaltyProgramConfig(crmSnapshot?.loyaltyConfig || {});

    try {
      setCrmSnapshot((current) => ({ ...current, loyaltyConfig: payload }));
      await Promise.resolve(onSave?.(payload));
      setSaveMessage("Đã lưu và kích hoạt cấu hình loyalty mới.");
    } catch (error) {
      const detail = String(error?.message || "").trim();
      setSaveTone("error");
      setSaveMessage(
        detail
          ? `Không thể lưu cấu hình: ${detail}`
          : "Không thể lưu cấu hình loyalty."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-stack admin-loyalty-settings">
      <AdminPanel
        title="Trung tâm loyalty"
        description="Giữ một nguồn cấu hình chung cho website, QR, POS và đơn đối tác."
        className="admin-loyalty-card admin-loyalty-hub"
        action={(
          <AdminButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu và kích hoạt"}
          </AdminButton>
        )}
      >
        <div className="admin-loyalty-hub-body">
          <div className="admin-loyalty-hub-copy">
            <span className="admin-loyalty-eyebrow">Một nơi để chốt luật chơi</span>
            <h3>Thiết lập xong ở đây là khách và toàn bộ kênh bán sẽ dùng chung một logic.</h3>
            <p>
              Phần này nên ưu tiên dễ hiểu, dễ vận hành và chỉ thay khi thật sự cần.
              Quà tặng theo mốc, tích điểm, giữ hạng và điểm danh đều đang bám theo cùng một cấu hình.
            </p>
          </div>

          <div className="admin-loyalty-overview">
            <div><span>Quy đổi điểm</span><strong>1 điểm = 1đ</strong></div>
            <div><span>Dùng điểm tối đa</span><strong>50% giá trị đơn</strong></div>
            <div><span>Hết hạn điểm</span><strong>12 tháng từ lần mua cuối</strong></div>
            <div><span>Chu kỳ hạng</span><strong>Theo năm dương lịch</strong></div>
          </div>
        </div>

        <div className="admin-loyalty-rule-grid">
          <article>
            <span>Tỷ lệ tích điểm</span>
            <strong>{formatPercent(minEarnPercent)}% - {formatPercent(maxEarnPercent)}%</strong>
            <small>Giữ cảm giác dễ mua từ hạng đầu và đủ hấp dẫn ở hạng cao nhất.</small>
          </article>
          <article>
            <span>Voucher hạng theo tháng</span>
            <strong>{assignedVoucherCount}/{config.tiers.length} hạng đã gắn</strong>
            <small>{activeVoucherCount} voucher loyalty đang hoạt động. Mỗi hạng tặng tối đa 1 lần/tháng, hạn dùng lấy theo số ngày đã cấu hình trên từng voucher.</small>
          </article>
          <article>
            <span>Điểm danh</span>
            <strong>{config.checkinEnabled ? "Đang bật" : "Đang tắt"}</strong>
            <small>
              Thưởng mỗi ngày {config.checkinDailyPoints.toLocaleString("vi-VN")} điểm,
              cộng thêm ở mốc 7, 14 và 30 ngày.
            </small>
          </article>
        </div>
      </AdminPanel>

      {saveMessage ? (
        <p className={`admin-loyalty-save-message ${saveTone === "error" ? "is-error" : ""}`} role="status">
          {saveMessage}
        </p>
      ) : null}

      <AdminPanel
        title="5 hạng thành viên"
        description="Mỗi hạng là một nấc tiến gần hơn. Ở đây anh chỉ cần chốt tên, icon, mốc chi tiêu, tỷ lệ tích điểm và quà tặng theo mốc."
        className="admin-loyalty-card"
      >
        <div className="admin-loyalty-tier-intro">
          <div>
            <strong>Khách sẽ nhìn thấy rõ hạng hiện tại và hạng kế tiếp</strong>
            <small>Vì chỉ có 5 hạng nên mình ưu tiên cấu trúc dạng thẻ, dễ rà và dễ sửa hơn bảng ngang dài.</small>
          </div>
          <div className="admin-loyalty-tier-metrics">
            <span>{config.tiers.length} hạng</span>
            <span>Cao nhất {formatPercent(maxEarnPercent)}%</span>
            <span>{assignedVoucherCount} quà đã gắn</span>
          </div>
        </div>

        <div className="admin-loyalty-tier-cards">
          {config.tiers.map((tier, index) => {
            const earnPercent = getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit);
            return (
              <article className="admin-loyalty-tier-card-item" key={tier.id}>
                <div className="admin-loyalty-tier-card-head">
                  <div className="admin-loyalty-tier-preview">
                    <span className="admin-loyalty-tier-symbol" aria-hidden="true">
                      {getLoyaltyTierIconSymbol(tier.iconKey)}
                    </span>
                    <div>
                      <small>Hạng {index + 1}</small>
                      <strong>{tier.name}</strong>
                      <p>{getTierHint(index)}</p>
                    </div>
                  </div>
                  <div className="admin-loyalty-percent-badge">
                    <span>Tích điểm</span>
                    <strong>{formatPercent(earnPercent)}%</strong>
                  </div>
                </div>

                <div className="admin-loyalty-tier-card-grid">
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
                    <small className="admin-loyalty-field-note">
                      {index === 0
                        ? "Hạng khởi đầu luôn bắt đầu từ 0đ."
                        : `Khách đạt từ ${formatCurrency(tier.minAnnualSpend)} trong năm sẽ vào hạng này.`}
                    </small>
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
                  </div>

                  <label className="admin-loyalty-field admin-loyalty-tier-voucher">
                    <span>Voucher hạng mỗi tháng</span>
                    <AdminSelect
                      value={tier.milestoneVoucherId}
                      onChange={(event) => updateTier(setCrmSnapshot, index, {
                        milestoneVoucherId: event.target.value
                      })}
                    >
                      <option value="">Chưa gắn voucher</option>
                      {loyaltyCoupons.map((voucher) => (
                        <option key={voucher.id || voucher.code} value={voucher.id || voucher.code}>
                          {voucher.code || "Không có mã"} - {voucher.name || voucher.title || "Voucher loyalty"}{voucher.active === false ? " (đang tắt)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
        <p className="admin-loyalty-note">
          Đơn tiền lẻ được tính theo công thức làm tròn xuống. Không gắn voucher thì khách vẫn thăng hạng bình thường.
        </p>
      </AdminPanel>

      <AdminPanel
        title="Voucher hạng theo tháng"
        description="Mỗi tháng khách nhận tối đa 1 voucher theo hạng hiện tại. Nếu trong tháng đó khách lên hạng mới, hệ thống tặng thêm voucher của hạng mới."
        className="admin-loyalty-card"
      >
        <div className="admin-loyalty-quick-steps">
          <span><strong>1.</strong> Tạo bộ voucher loyalty mẫu</span>
          <span><strong>2.</strong> Gắn từng voucher vào đúng hạng</span>
          <span><strong>3.</strong> Lưu lại để tự tặng mỗi tháng, hạn dùng lấy theo từng voucher đã gắn</span>
        </div>

        <div className="admin-loyalty-checklist-summary">
          <article>
            <span>Đã gắn voucher</span>
            <strong>{assignedVoucherCount}/{config.tiers.length} hạng</strong>
          </article>
          <article>
            <span>Voucher loyalty đang bật</span>
            <strong>{activeVoucherCount}</strong>
          </article>
          <article>
            <span>Bộ voucher gợi ý</span>
            <strong>{LOYALTY_VOUCHER_PRESETS.length} mẫu</strong>
          </article>
        </div>

        <div className="admin-loyalty-checklist">
          {voucherChecklist.map(({ tier, preset, assignedCoupon, status }) => (
            <article className="admin-loyalty-checklist-row" key={tier.id}>
              <div className="admin-loyalty-checklist-main">
                <span className="admin-loyalty-tier-symbol" aria-hidden="true">
                  {getLoyaltyTierIconSymbol(tier.iconKey)}
                </span>
                <div>
                  <strong>{tier.name}</strong>
                  <small>
                    {assignedCoupon
                      ? `${assignedCoupon.code || "Không có mã"} · ${assignedCoupon.name || assignedCoupon.title || "Voucher loyalty"}`
                      : preset
                        ? `Gợi ý mã: ${preset.code}`
                        : "Chưa có gợi ý"}
                  </small>
                </div>
              </div>
              <div className="admin-loyalty-checklist-meta">
                <span className={`crm-point-status crm-point-status--${getChecklistTone(status)}`}>
                  {getChecklistLabel(status)}
                </span>
                <small>
                  {preset?.note || "Anh có thể đổi quà bất cứ lúc nào rồi lưu lại phiên bản mới."}
                </small>
              </div>
            </article>
          ))}
        </div>
        <p className="admin-loyalty-note">
          Hạng {config.tiers[0]?.name || "đầu tiên"} có thể để như quà chào sân hoặc tặng tay trong CRM, không bắt buộc auto-grant.
        </p>
      </AdminPanel>

      <AdminPanel
        title="Điểm danh"
        description="Nếu đang chạy chương trình ghé Gánh mỗi ngày, anh chỉ cần chốt điểm mỗi ngày và ba mốc thưởng thêm."
        className="admin-loyalty-card"
      >
        <div className="admin-loyalty-checkin-head">
          <label className="admin-loyalty-toggle">
            <input
              type="checkbox"
              checked={config.checkinEnabled}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { checkinEnabled: event.target.checked })}
            />
            <span>{config.checkinEnabled ? "Đang bật chương trình điểm danh" : "Đang tắt chương trình điểm danh"}</span>
          </label>
          <div className="admin-loyalty-checkin-badges">
            <span>Mỗi ngày: {config.checkinDailyPoints.toLocaleString("vi-VN")} điểm</span>
            <span>Chuỗi 7 / 14 / 30 ngày</span>
          </div>
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

      <details className="admin-loyalty-advanced">
        <summary>
          <div>
            <strong>Đối soát loyalty nâng cao</strong>
            <small>Chỉ mở khi cần quét backlog, tách nhóm safe hoặc bù điểm hàng loạt.</small>
          </div>
          <span>Tùy chọn nâng cao</span>
        </summary>
        <div className="admin-loyalty-advanced-body">
          <LoyaltyOpsPanel embedded onRefresh={refreshCrm} />
        </div>
      </details>
    </section>
  );
}
