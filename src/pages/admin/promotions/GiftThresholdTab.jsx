import PromotionFormSection from "./PromotionFormSection.jsx";
import PromotionSalesChannelField from "./PromotionSalesChannelField.jsx";
import {
  PromotionSetupWarnings,
  PromotionSummaryPills,
  formatSalesChannelSummary
} from "./PromotionSetupFeedback.jsx";

function buildGiftWarnings(promotion = {}) {
  const warnings = [];
  if (Number(promotion?.condition?.minSubtotal || 0) <= 0) {
    warnings.push("Chưa đặt mốc đơn tối thiểu.");
  }
  if (!promotion?.reward?.productId) {
    warnings.push("Chưa chọn món tặng.");
  }
  if (promotion?.active === false) {
    warnings.push("Chương trình đang tắt, đơn hàng sẽ không tự gợi ý món tặng.");
  }
  if (promotion?.startAt && promotion?.endAt && String(promotion.startAt) > String(promotion.endAt)) {
    warnings.push("Ngày kết thúc đang trước ngày bắt đầu.");
  }
  if (promotion?.endAt) {
    const endDate = new Date(`${promotion.endAt}T23:59:59`);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      warnings.push("Chương trình đã hết hạn.");
    }
  }
  return warnings;
}

export default function GiftThresholdTab({
  giftPromo,
  updatePromotion,
  activeProducts
}) {
  if (!giftPromo) return null;
  const giftProduct = activeProducts.find((product) => product.id === giftPromo.reward.productId);
  const minSubtotal = Number(giftPromo.condition.minSubtotal || 0);
  const isActive = Boolean(giftPromo.active);
  const giftWarnings = buildGiftWarnings(giftPromo);

  return (
    <section className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <strong>Danh sách tặng món</strong>
        </div>
        <div className="admin-promo-list-card is-active">
          <div className="mb-2 flex items-start justify-between gap-2">
            <strong className="text-sm font-black text-slate-900">Tặng món theo mốc đơn</strong>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {isActive ? "Đang bật" : "Đang tắt"}
            </span>
          </div>
          <p className="text-xl font-black text-orange-600">
            Từ {minSubtotal.toLocaleString("vi-VN")}đ
          </p>
          <p className="mt-1 text-xs text-slate-700">
            {giftProduct?.name || "Chưa chọn món tặng"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {giftPromo.startAt || "Chưa đặt"} → {giftPromo.endAt || "Chưa đặt"}
          </p>
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="admin-promo-preview-card">
          <p className="text-2xl font-black leading-tight text-orange-600">
            Tặng {giftProduct?.name || "món quà"} từ {minSubtotal.toLocaleString("vi-VN")}đ
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {isActive ? "Đang bật" : "Đang tắt"} · {giftPromo.startAt || "Chưa đặt ngày bắt đầu"} → {giftPromo.endAt || "Chưa đặt ngày kết thúc"}
          </p>
        </div>

        <div className="admin-promo-form-flow">
          <PromotionSummaryPills
            items={[
              isActive ? "Đang bật" : "Đang tắt",
              formatSalesChannelSummary(giftPromo),
              `Đơn từ ${minSubtotal.toLocaleString("vi-VN")}đ`,
              giftProduct?.name ? `Tặng ${giftProduct.name}` : "Chưa chọn món tặng"
            ]}
          />
          <PromotionSetupWarnings warnings={giftWarnings} />

          <PromotionFormSection
            step="1"
            title="Điều kiện nhận quà"
            note="Khách đạt mốc đơn này sẽ được gợi ý món tặng."
          >
            <div className="admin-promo-form-grid">
              <label className="text-[12px] font-semibold text-slate-500">
                Mốc đơn tối thiểu
                <input className="admin-input mt-1" type="number" value={giftPromo.condition.minSubtotal || 0} onChange={(event) => updatePromotion(giftPromo.id, { condition: { ...giftPromo.condition, minSubtotal: Number(event.target.value) } })} />
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                Món tặng
                <select className="admin-input mt-1" value={giftPromo.reward.productId || ""} onChange={(event) => updatePromotion(giftPromo.id, { reward: { ...giftPromo.reward, type: "gift", productId: event.target.value, value: event.target.value } })}>
                  <option value="">Chọn món tặng</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </PromotionFormSection>

          <PromotionFormSection
            step="2"
            title="Thời gian & trạng thái"
            note="Đặt ngày chạy và bật/tắt chương trình."
          >
            <div className="admin-promo-form-grid">
              <label className="text-[12px] font-semibold text-slate-500">
                Ngày bắt đầu
                <input
                  className="admin-input mt-1"
                  type="date"
                  value={giftPromo.startAt || ""}
                  onChange={(event) => updatePromotion(giftPromo.id, { startAt: event.target.value })}
                />
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                Ngày kết thúc
                <input
                  className="admin-input mt-1"
                  type="date"
                  value={giftPromo.endAt || ""}
                  onChange={(event) => updatePromotion(giftPromo.id, { endAt: event.target.value })}
                />
              </label>
              <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                Kênh áp dụng
                <PromotionSalesChannelField
                  value={giftPromo.salesChannels}
                  onChange={(nextChannels) => updatePromotion(giftPromo.id, { salesChannels: nextChannels })}
                />
              </div>
              <div className="admin-promo-active-row admin-promo-form-span-2">
                <div>
                  <strong>Bật tặng món</strong>
                  <span>Tắt để giữ cấu hình nhưng không áp dụng cho đơn.</span>
                </div>
                <label className="admin-switch"><input type="checkbox" checked={isActive} onChange={(event) => updatePromotion(giftPromo.id, { active: event.target.checked })} /><span /></label>
              </div>
            </div>
          </PromotionFormSection>
        </div>
      </div>
    </section>
  );
}
