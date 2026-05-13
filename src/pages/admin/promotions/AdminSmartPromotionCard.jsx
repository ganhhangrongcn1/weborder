import { promotionPlaces, promotionTypes, rewardTypes } from "../../../data/defaultData.js";
import { AdminSwitch } from "../ui/AdminCommon.jsx";

export default function AdminSmartPromotionCard({ promotion, onChange, onDelete, products = [] }) {
  const patchCondition = (patch) => onChange({ condition: { ...promotion.condition, ...patch } });
  const patchReward = (patch) => onChange({ reward: { ...promotion.reward, ...patch } });
  const togglePlace = (place) => {
    const current = promotion.displayPlaces || [];
    const displayPlaces = current.includes(place) ? current.filter((item) => item !== place) : [...current, place];
    onChange({ displayPlaces });
  };
  const activeProducts = products.filter((item) => item?.visible !== false);

  return (
    <div className="admin-smart-promo-card">
      <div className="admin-smart-promo-head">
        <div>
          <span>{promotion.type}</span>
          <strong>{promotion.name}</strong>
          <small>{promotion.active ? "Đang bật trên app khách" : "Đang tắt"}</small>
        </div>
        <AdminSwitch checked={promotion.active} onChange={(active) => onChange({ active })} />
      </div>

      <div className="admin-smart-grid">
        <label>Tên nội bộ<input value={promotion.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label>Tiêu đề khách thấy<input value={promotion.title} onChange={(event) => onChange({ title: event.target.value })} /></label>
        <label>Mô tả ngắn<input value={promotion.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
        <label>Loại chương trình<select value={promotion.type} onChange={(event) => onChange({ type: event.target.value })}>{promotionTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <label>Đơn tối thiểu<input type="number" value={promotion.condition.minSubtotal} onChange={(event) => patchCondition({ minSubtotal: Number(event.target.value) })} /></label>
        <label>Loại khách<select value={promotion.condition.customerType} onChange={(event) => patchCondition({ customerType: event.target.value })}><option value="all">Tất cả</option><option value="new">Khách mới</option><option value="returning">Khách cũ</option><option value="member">Đã đăng nhập</option></select></label>
        <label>Phần thưởng<select value={promotion.reward.type} onChange={(event) => patchReward({ type: event.target.value })}>{rewardTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <label>Giá trị<input value={promotion.reward.value} onChange={(event) => patchReward({ value: event.target.value })} /></label>
        {promotion.reward.type === "gift" && (
          <label>
            Món tặng
            <select
              value={promotion.reward.productId || ""}
              onChange={(event) => patchReward({ productId: event.target.value, value: event.target.value || promotion.reward.value })}
            >
              <option value="">Chọn món đang mở bán</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>Ưu tiên<input type="number" value={promotion.priority} onChange={(event) => onChange({ priority: Number(event.target.value) })} /></label>
        <label>Ngày bắt đầu<input type="date" value={promotion.startAt} onChange={(event) => onChange({ startAt: event.target.value })} /></label>
        <label>Ngày kết thúc<input type="date" value={promotion.endAt} onChange={(event) => onChange({ endAt: event.target.value })} /></label>
        <label>Icon<select value={promotion.icon} onChange={(event) => onChange({ icon: event.target.value })}><option value="bike">Freeship</option><option value="sale">Giảm giá</option><option value="gift">Quà tặng</option><option value="cup">Nước uống/điểm</option></select></label>
      </div>

      <div className="admin-place-row">
        <span>Hiển thị ở:</span>
        {promotionPlaces.map((place) => (
          <button key={place.id} type="button" onClick={() => togglePlace(place.id)} className={(promotion.displayPlaces || []).includes(place.id) ? "active" : ""}>{place.label}</button>
        ))}
      </div>

      <div className="admin-supabase-note">
        <strong>Supabase sau này:</strong> lưu dòng này vào bảng <code>promotions</code>, các cột JSON nên là <code>condition</code>, <code>reward</code>, <code>display_places</code>.
      </div>

      <button className="admin-danger" onClick={onDelete}>Xóa chương trình</button>
    </div>
  );
}
