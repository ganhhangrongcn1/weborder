import { AdminPanel } from "../ui/AdminCommon.jsx";

export default function GiftThresholdTab({
  giftPromo,
  updatePromotion,
  activeProducts
}) {
  if (!giftPromo) return null;
  return (
    <AdminPanel title="Chương trình tặng món">
      <div className="admin-mini-grid">
        <div className="admin-mini-card">
          <label>Mốc đơn tối thiểu</label>
          <input className="admin-input" type="number" value={giftPromo.condition.minSubtotal || 0} onChange={(event) => updatePromotion(giftPromo.id, { condition: { ...giftPromo.condition, minSubtotal: Number(event.target.value) } })} />
        </div>
        <div className="admin-mini-card">
          <label>Món tặng (chỉ món mở bán)</label>
          <select className="admin-input" value={giftPromo.reward.productId || ""} onChange={(event) => updatePromotion(giftPromo.id, { reward: { ...giftPromo.reward, type: "gift", productId: event.target.value, value: event.target.value } })}>
            <option value="">Chọn món tặng</option>
            {activeProducts.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-mini-card">
          <label>Thời gian bắt đầu</label>
          <input
            className="admin-input"
            type="date"
            value={giftPromo.startAt || ""}
            onChange={(event) => updatePromotion(giftPromo.id, { startAt: event.target.value })}
          />
        </div>
        <div className="admin-mini-card">
          <label>Thời gian kết thúc</label>
          <input
            className="admin-input"
            type="date"
            value={giftPromo.endAt || ""}
            onChange={(event) => updatePromotion(giftPromo.id, { endAt: event.target.value })}
          />
        </div>
        <div className="admin-mini-card">
          <label>Bật chương trình</label>
          <label className="admin-switch"><input type="checkbox" checked={Boolean(giftPromo.active)} onChange={(event) => updatePromotion(giftPromo.id, { active: event.target.checked })} /><span /></label>
        </div>
      </div>
    </AdminPanel>
  );
}
