import { DEFAULT_SHIPPING_CONFIG } from "../../../services/shippingService.js";

export default function ShippingSettings({ shippingConfig, setShippingConfig, onSave }) {
  return (
    <section className="admin-panel admin-store-panel">
      <div className="admin-panel-head">
        <h2>Cấu hình phí ship</h2>
        <button onClick={onSave}>Lưu</button>
      </div>
      <div className="admin-mini-grid">
        <div className="admin-mini-card">
          <label>Phí 3km đầu</label>
          <input className="admin-input" type="number" value={shippingConfig.baseFeeFirst3Km} onChange={(event) => setShippingConfig((current) => ({ ...current, baseFeeFirst3Km: Number(event.target.value) }))} />
        </div>
        <div className="admin-mini-card">
          <label>Giá mỗi km tiếp theo</label>
          <input className="admin-input" type="number" value={shippingConfig.feePerNextKm} onChange={(event) => setShippingConfig((current) => ({ ...current, feePerNextKm: Number(event.target.value) }))} />
        </div>
        <div className="admin-mini-card">
          <label>Ngưỡng miễn phí ship</label>
          <input className="admin-input" type="number" value={shippingConfig.freeShipThreshold} onChange={(event) => setShippingConfig((current) => ({ ...current, freeShipThreshold: Number(event.target.value) }))} />
        </div>
        <div className="admin-mini-card">
          <label>Bật hỗ trợ phí ship</label>
          <label className="admin-switch"><input type="checkbox" checked={Boolean(shippingConfig.supportShippingEnabled)} onChange={(event) => setShippingConfig((current) => ({ ...current, supportShippingEnabled: event.target.checked }))} /><span /></label>
        </div>
        <div className="admin-mini-card">
          <label>Phí ship hỗ trợ tối đa</label>
          <input className="admin-input" type="number" min="0" value={shippingConfig.maxSupportShipFee ?? 0} onChange={(event) => setShippingConfig((current) => ({ ...current, maxSupportShipFee: Number(event.target.value) }))} />
        </div>
        <div className="admin-mini-card">
          <label>Bán kính giao hàng tối đa (km)</label>
          <input className="admin-input" type="number" value={shippingConfig.maxRadiusKm} onChange={(event) => setShippingConfig((current) => ({ ...current, maxRadiusKm: Number(event.target.value) }))} />
        </div>
        <div className="admin-mini-card">
          <label>Ghi chú hiển thị cho khách</label>
          <textarea className="admin-input" rows="4" value={shippingConfig.customerNote || ""} onChange={(event) => setShippingConfig((current) => ({ ...current, customerNote: event.target.value }))} />
        </div>
      </div>
      <button className="admin-secondary" onClick={() => setShippingConfig({ ...DEFAULT_SHIPPING_CONFIG })}>Khôi phục mặc định</button>
    </section>
  );
}
