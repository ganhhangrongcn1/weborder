import { useMemo, useState } from "react";
import {
  getLoyaltyEarnPercent,
  normalizeLoyaltyProgramConfig
} from "../../../services/loyaltyProgramConfigService.js";
import { AdminButton, AdminInput, AdminPanel, AdminTabs } from "../ui/index.js";
import LoyaltyOpsPanel from "./LoyaltyOpsPanel.jsx";
import LoyaltyRewardsSettings from "./LoyaltyRewardsSettings.jsx";
import LoyaltyTierSettings from "./LoyaltyTierSettings.jsx";

const LOYALTY_SECTIONS = [
  { value: "rules", label: "Quy tắc điểm" },
  { value: "tiers", label: "Hạng thành viên" },
  { value: "rewards", label: "Thưởng tự động" }
];

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
  coupons = [],
  refreshCrm
}) {
  const [activeSection, setActiveSection] = useState("rules");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveTone, setSaveTone] = useState("success");
  const config = normalizeLoyaltyProgramConfig(crmSnapshot?.loyaltyConfig || {});
  const loyaltyCoupons = useMemo(() => (
    (coupons || [])
      .filter((coupon) => String(coupon?.voucherType || "checkout") === "loyalty")
      .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || "")))
  ), [coupons]);
  const assignedVoucherCount = useMemo(() => (
    config.tiers.filter((tier) => String(tier.milestoneVoucherId || "").trim()).length
  ), [config.tiers]);
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
      setSaveMessage("Đã lưu và kích hoạt cấu hình thành viên mới.");
    } catch (error) {
      const detail = String(error?.message || "").trim();
      setSaveTone("error");
      setSaveMessage(detail ? `Không thể lưu cấu hình: ${detail}` : "Không thể lưu cấu hình thành viên.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigChange = (patch) => updateLoyaltyConfig(setCrmSnapshot, patch);
  const handleTierChange = (tierIndex, patch) => updateTier(setCrmSnapshot, tierIndex, patch);
  const handleStreakChange = (day, value) => updateStreakReward(setCrmSnapshot, day, value);

  return (
    <section className="admin-stack admin-loyalty-settings">
      <header className="admin-loyalty-command">
        <div className="admin-loyalty-command-copy">
          <span>Chương trình thành viên</span>
          <h2>Thành viên & tích điểm</h2>
          <p>Một cấu hình dùng chung cho website, QR, POS và đơn đối tác.</p>
        </div>

        <div className="admin-loyalty-command-stats" aria-label="Tóm tắt cấu hình loyalty">
          <div><span>Số hạng</span><strong>{config.tiers.length}</strong></div>
          <div><span>Tích điểm</span><strong>{formatPercent(minEarnPercent)}–{formatPercent(maxEarnPercent)}%</strong></div>
          <div><span>Dùng tối đa</span><strong>{config.maxRedemptionPercent}%</strong></div>
          <div><span>Voucher đã gắn</span><strong>{assignedVoucherCount}/{config.tiers.length}</strong></div>
        </div>

        <AdminButton className="admin-loyalty-save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
        </AdminButton>
      </header>

      {saveMessage ? (
        <p className={`admin-loyalty-save-message ${saveTone === "error" ? "is-error" : ""}`} role="status">
          {saveMessage}
        </p>
      ) : null}

      <AdminTabs
        tabs={LOYALTY_SECTIONS}
        value={activeSection}
        onChange={setActiveSection}
        className="admin-loyalty-tabs"
      />

      {activeSection === "rules" ? (
        <AdminPanel
          title="Quy tắc điểm"
          description="Các giới hạn áp dụng chung cho mọi hạng và mọi kênh bán."
          className="admin-loyalty-card admin-loyalty-rules"
        >
          <div className="admin-loyalty-rule-setting">
            <div className="admin-loyalty-rule-copy">
              <span>Thanh toán bằng điểm</span>
              <h3>Giới hạn số điểm được dùng trong một đơn</h3>
              <p>Ví dụ đặt 30%: đơn 200.000đ được dùng tối đa 60.000 điểm.</p>
            </div>
            <label className="admin-loyalty-field admin-loyalty-rule-input">
              <span>Tỷ lệ tối đa (%)</span>
              <AdminInput
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                step="1"
                value={config.maxRedemptionPercent}
                onChange={(event) => handleConfigChange({
                  maxRedemptionPercent: Math.min(100, Math.max(1, Number(event.target.value || 1)))
                })}
              />
            </label>
          </div>

          <div className="admin-loyalty-rule-facts">
            <div><span>Quy đổi</span><strong>1 điểm = 1đ</strong></div>
            <div><span>Hết hạn điểm</span><strong>Điểm mới có hạn 60 ngày; điểm cũ giữ nguyên</strong></div>
            <div><span>Chu kỳ xét hạng</span><strong>Theo năm dương lịch</strong></div>
          </div>
        </AdminPanel>
      ) : null}

      {activeSection === "tiers" ? (
        <LoyaltyTierSettings
          tiers={config.tiers}
          assignedVoucherCount={assignedVoucherCount}
          maxEarnPercent={maxEarnPercent}
          onTierChange={handleTierChange}
        />
      ) : null}

      {activeSection === "rewards" ? (
        <LoyaltyRewardsSettings
          config={config}
          loyaltyCoupons={loyaltyCoupons}
          assignedVoucherCount={assignedVoucherCount}
          onConfigChange={handleConfigChange}
          onStreakChange={handleStreakChange}
          onTierChange={handleTierChange}
        />
      ) : null}

      <details className="admin-loyalty-advanced">
        <summary>
          <div>
            <strong>Công cụ đối soát hệ thống</strong>
            <small>Chỉ dành cho quản trị khi cần kiểm tra hoặc bù backlog loyalty.</small>
          </div>
          <span>Mở công cụ</span>
        </summary>
        <div className="admin-loyalty-advanced-body">
          <LoyaltyOpsPanel embedded onRefresh={refreshCrm} />
        </div>
      </details>
    </section>
  );
}
