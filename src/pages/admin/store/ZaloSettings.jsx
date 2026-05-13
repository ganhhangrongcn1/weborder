import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ZALO_TEMPLATE } from "../../../services/zaloService.js";
import { AdminButton, AdminInput, AdminPanel, AdminTextarea } from "../ui/index.js";

export default function ZaloSettings({ zaloConfig, setZaloConfig, onSave }) {
  const [draftConfig, setDraftConfig] = useState(() => ({ ...(zaloConfig || {}) }));

  useEffect(() => {
    setDraftConfig({ ...(zaloConfig || {}) });
  }, [zaloConfig]);

  const hasChanges = useMemo(
    () => JSON.stringify(draftConfig || {}) !== JSON.stringify(zaloConfig || {}),
    [draftConfig, zaloConfig]
  );

  const handleSave = () => {
    setZaloConfig(draftConfig);
    onSave(draftConfig);
  };

  return (
    <AdminPanel
      className="admin-store-panel"
      title="Cấu hình Zalo nhận đơn"
      action={(
        <AdminButton
          variant={hasChanges ? "primary" : "secondary"}
          className={!hasChanges ? "opacity-70 cursor-not-allowed" : ""}
          disabled={!hasChanges}
          onClick={handleSave}
        >
          Lưu thay đổi
        </AdminButton>
      )}
    >
      <div className="admin-mini-grid admin-ui-panel-body">
        <div className="admin-mini-card">
          <label>Số điện thoại Zalo nhận đơn</label>
          <AdminInput
            value={draftConfig.phone || ""}
            onChange={(event) => setDraftConfig((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))}
          />
          <small>Dùng số dạng 09... hoặc 03... (không khoảng trắng).</small>
        </div>
        <div className="admin-mini-card">
          <label>Nội dung tin nhắn mẫu</label>
          <AdminTextarea
            rows="10"
            value={draftConfig.template || DEFAULT_ZALO_TEMPLATE}
            onChange={(event) => setDraftConfig((current) => ({ ...current, template: event.target.value }))}
          />
          <small>
            Biến hỗ trợ: {"{{customer_name}}, {{phone}}, {{items}}, {{total}}, {{address}}, {{note}}, {{order_code}}, {{order_time}}, {{fulfillment_type}}, {{pickup_branch}}, {{delivery_branch}}, {{payment_method}}, {{map_link}}, {{distance_km}}, {{subtotal}}, {{shipping_fee}}"}
          </small>
        </div>
      </div>
    </AdminPanel>
  );
}
