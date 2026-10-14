import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";

export default function ShippingSettings({ shippingConfig, onSave }) {
  const [draftShippingConfig, setDraftShippingConfig] = useState(() => ({ ...(shippingConfig || {}) }));
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingSaveMessage, setShippingSaveMessage] = useState("");
  useEffect(() => { setDraftShippingConfig({ ...(shippingConfig || {}) }); }, [shippingConfig]);
  const shippingDirty = useMemo(() => JSON.stringify(draftShippingConfig) !== JSON.stringify(shippingConfig || {}), [draftShippingConfig, shippingConfig]);
  const handleSaveShipping = async () => {
    if (!shippingDirty || shippingSaving) return;
    setShippingSaving(true);
    setShippingSaveMessage("");
    try {
      await onSave(draftShippingConfig);
      setShippingSaveMessage("Đã lưu phí giao hàng chung.");
    } catch {
      setShippingSaveMessage("Chưa lưu được phí giao hàng. Vui lòng thử lại.");
    } finally { setShippingSaving(false); }
  };
  return (
<AdminCard className="admin-panel admin-store-panel">
        <div className="admin-panel-head">
          <div><h2>Phí giao hàng chung</h2><p className="admin-help-text">Áp dụng toàn hệ thống. Bật/tắt giao hàng từng quán tại Quản lý chi nhánh.</p></div>
          <AdminButton
            variant={shippingDirty ? "primary" : "secondary"}
            className={!shippingDirty || shippingSaving ? "opacity-70 cursor-not-allowed" : ""}
            disabled={!shippingDirty || shippingSaving}
            onClick={handleSaveShipping}
          >
            {shippingSaving ? "Đang lưu..." : "Lưu phí giao hàng"}
          </AdminButton>
        </div>
        {shippingSaveMessage ? <p className="admin-store-message">{shippingSaveMessage}</p> : null}
        <div className="admin-mini-grid admin-ship-compact-grid">
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Phí 3km đầu</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.baseFeeFirst3Km}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, baseFeeFirst3Km: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Giá mỗi km tiếp theo</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.feePerNextKm}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, feePerNextKm: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Ưu đãi freeship</label>
            <div className="admin-ship-info-note">
              Cấu hình tại Ưu đãi bán hàng → Freeship.
            </div>
          </div>
          <div className="admin-mini-card admin-ship-compact-item">
            <label>Bán kính giao hàng tối đa (km)</label>
            <AdminInput
              className="admin-input"
              type="number"
              value={draftShippingConfig.maxRadiusKm}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, maxRadiusKm: Number(event.target.value) }))}
            />
          </div>
          <div className="admin-mini-card admin-ship-compact-item admin-ship-note-item">
            <label>Ghi chú hiển thị cho khách</label>
            <textarea
              className="admin-input"
              rows="4"
              value={draftShippingConfig.customerNote || ""}
              onChange={(event) => setDraftShippingConfig((current) => ({ ...current, customerNote: event.target.value }))}
            />
          </div>
        </div>
        <AdminButton variant="secondary" className="admin-secondary" onClick={() => setDraftShippingConfig((current) => ({ ...current, baseFeeFirst3Km: DEFAULT_SHIPPING_CONFIG.baseFeeFirst3Km, feePerNextKm: DEFAULT_SHIPPING_CONFIG.feePerNextKm, maxRadiusKm: DEFAULT_SHIPPING_CONFIG.maxRadiusKm, customerNote: DEFAULT_SHIPPING_CONFIG.customerNote }))}>
          Khôi phục phí ship mặc định
        </AdminButton>
      </AdminCard>
  );
}
