import { useState } from "react";
import { AdminButton, AdminInput, AdminPanel } from "../ui/index.js";

function updateLoyaltyConfig(setCrmSnapshot, patch) {
  setCrmSnapshot((current) => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      ...patch
    }
  }));
}

function updateStreakReward(setCrmSnapshot, day, value) {
  setCrmSnapshot((current) => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      streakRewards: {
        ...(current?.loyaltyConfig?.streakRewards || {}),
        [day]: Math.max(1, Number(value || 1))
      }
    }
  }));
}

export default function LoyaltySettings({ crmSnapshot, setCrmSnapshot, onSave }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const config = crmSnapshot?.loyaltyConfig || {};
  const currencyPerPoint = Math.max(1, Number(config.currencyPerPoint || 100));
  const pointPerUnit = Math.max(1, Number(config.pointPerUnit || 1));
  const checkinDailyPoints = Math.max(1, Number(config.checkinDailyPoints || 100));
  const streakRewards = config.streakRewards || {};
  const reward7 = Math.max(1, Number(streakRewards[7] || streakRewards["7"] || 700));
  const reward14 = Math.max(1, Number(streakRewards[14] || streakRewards["14"] || 1500));
  const reward30 = Math.max(1, Number(streakRewards[30] || streakRewards["30"] || 3000));
  const redeemPointUnit = Math.max(1, Number(config.redeemPointUnit || 1));
  const redeemValue = Math.max(1, Number(config.redeemValue || 1));

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    const payload = {
      ...(crmSnapshot?.loyaltyConfig || {}),
      currencyPerPoint,
      pointPerUnit,
      checkinDailyPoints,
      streakRewards: {
        7: reward7,
        14: reward14,
        30: reward30
      },
      redeemPointUnit,
      redeemValue
    };
    try {
      setCrmSnapshot((current) => ({
        ...current,
        loyaltyConfig: payload
      }));
      await Promise.resolve(onSave?.(payload));
      setSaveMessage("Đã lưu cấu hình tích điểm.");
    } catch (_error) {
      setSaveMessage("Lưu cấu hình tích điểm thất bại. Kiểm tra kết nối/Pilot policy.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-stack admin-loyalty-settings">
      <AdminPanel
        title="Quản lý tích điểm khách hàng"
        action={<AdminButton onClick={handleSave} disabled={isSaving}>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</AdminButton>}
      />
      {saveMessage ? <p className="text-sm text-slate-600">{saveMessage}</p> : null}

      <AdminPanel title="Kiếm điểm từ đơn hàng" className="admin-loyalty-card">
        <div className="admin-mini-grid admin-ui-panel-body">
          <label className="admin-mini-card">
            <span>Số tiền chi tiêu (đ)</span>
            <AdminInput
              type="number"
              value={currencyPerPoint}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { currencyPerPoint: Math.max(1, Number(event.target.value || 1)) })}
            />
          </label>
          <label className="admin-mini-card">
            <span>Điểm nhận được</span>
            <AdminInput
              type="number"
              value={pointPerUnit}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { pointPerUnit: Math.max(1, Number(event.target.value || 1)) })}
            />
          </label>
        </div>
        <small className="admin-loyalty-note">Khách hàng sẽ nhận được <strong>{pointPerUnit} điểm</strong> cho mỗi <strong>{currencyPerPoint.toLocaleString("vi-VN")}đ</strong> chi tiêu.</small>
      </AdminPanel>

      <AdminPanel title="Điểm danh hàng ngày" className="admin-loyalty-card">
        <div className="admin-ui-panel-body admin-loyalty-form-stack">
          <label className="admin-mini-card">
            <span>Điểm danh mỗi ngày</span>
            <AdminInput
              type="number"
              value={checkinDailyPoints}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { checkinDailyPoints: Math.max(1, Number(event.target.value || 1)) })}
            />
          </label>
          <div className="admin-mini-grid">
            <label className="admin-mini-card">
              <span>Thưởng chuỗi 7 ngày</span>
              <AdminInput
                type="number"
                value={reward7}
                onChange={(event) => updateStreakReward(setCrmSnapshot, 7, event.target.value)}
              />
            </label>
            <label className="admin-mini-card">
              <span>Thưởng chuỗi 14 ngày</span>
              <AdminInput
                type="number"
                value={reward14}
                onChange={(event) => updateStreakReward(setCrmSnapshot, 14, event.target.value)}
              />
            </label>
            <label className="admin-mini-card">
              <span>Thưởng chuỗi 30 ngày</span>
              <AdminInput
                type="number"
                value={reward30}
                onChange={(event) => updateStreakReward(setCrmSnapshot, 30, event.target.value)}
              />
            </label>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel title="Sử dụng điểm" className="admin-loyalty-card">
        <div className="admin-mini-grid admin-ui-panel-body">
          <label className="admin-mini-card">
            <span>Số điểm đổi</span>
            <AdminInput
              type="number"
              value={redeemPointUnit}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { redeemPointUnit: Math.max(1, Number(event.target.value || 1)) })}
            />
          </label>
          <label className="admin-mini-card">
            <span>Giá trị (đ)</span>
            <AdminInput
              type="number"
              value={redeemValue}
              onChange={(event) => updateLoyaltyConfig(setCrmSnapshot, { redeemValue: Math.max(1, Number(event.target.value || 1)) })}
            />
          </label>
        </div>
        <small className="admin-loyalty-note">Khách hàng có thể dùng <strong>{redeemPointUnit} điểm</strong> để giảm <strong>{redeemValue.toLocaleString("vi-VN")}đ</strong> khi thanh toán.</small>
      </AdminPanel>
    </section>
  );
}
