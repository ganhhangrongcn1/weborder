import PromotionFormSection from "./PromotionFormSection.jsx";
import {
  PromotionSetupWarnings,
  PromotionSummaryPills
} from "./PromotionSetupFeedback.jsx";

function formatMoneyValue(value = 0) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function getSupportLabel(maxSupportShipFee = 0) {
  return Number(maxSupportShipFee || 0) > 0
    ? `Hỗ trợ tối đa ${formatMoneyValue(maxSupportShipFee)}`
    : "Hỗ trợ toàn bộ phí ship";
}

function getSupportExample(maxSupportShipFee = 0) {
  const supportCap = Number(maxSupportShipFee || 0);
  if (supportCap <= 0) return "Khi đơn đủ mốc, khách web không trả phí ship.";
  const sampleShipFee = supportCap + 6000;
  return `Ví dụ phí ship ${formatMoneyValue(sampleShipFee)}, cửa hàng hỗ trợ ${formatMoneyValue(supportCap)}, khách trả ${formatMoneyValue(sampleShipFee - supportCap)}.`;
}

function buildFreeshipWarnings(promotion = {}) {
  const warnings = [];
  if (Number(promotion?.condition?.minSubtotal || 0) <= 0) warnings.push("Chưa đặt mốc đơn tối thiểu.");
  if (promotion?.active === false) warnings.push("Chương trình đang tắt, web checkout sẽ không áp dụng.");
  if (promotion?.endAt) {
    const endDate = new Date(`${promotion.endAt}T23:59:59`);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) warnings.push("Chương trình đã hết hạn.");
  }
  return warnings;
}

export default function FreeshipManager({
  freeShippingPromo,
  createPromotion,
  updatePromotion
}) {
  if (!freeShippingPromo) {
    return (
      <section className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <strong>Danh sách hỗ trợ ship</strong>
          </div>
          <p className="admin-promo-empty-note">Chưa có chương trình hỗ trợ ship.</p>
        </aside>
        <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="admin-promo-empty-note">Tạo cấu hình để bắt đầu chỉnh hỗ trợ phí ship.</p>
          <button className="admin-cta mt-3" type="button" onClick={() => createPromotion("free_shipping")}>
            + Tạo chương trình hỗ trợ ship
          </button>
        </div>
      </section>
    );
  }

  const minSubtotal = Number(freeShippingPromo?.condition?.minSubtotal || 0);
  const maxSupportShipFee = Number(freeShippingPromo?.condition?.maxSupportShipFee || 0);
  const isActive = freeShippingPromo?.active !== false;
  const patchFreeShipping = (patch) => updatePromotion(freeShippingPromo.id, { ...patch, salesChannels: ["web"] });
  const supportLabel = getSupportLabel(maxSupportShipFee);
  const freeshipWarnings = buildFreeshipWarnings(freeShippingPromo);

  return (
    <section className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <strong>Danh sách hỗ trợ ship</strong>
        </div>
        <div className="admin-promo-list-card is-active">
          <div className="mb-2 flex items-start justify-between gap-2">
            <strong className="text-sm font-black text-slate-900">Hỗ trợ ship theo đơn</strong>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {isActive ? "Đang bật" : "Đang tắt"}
            </span>
          </div>
          <p className="text-xl font-black text-orange-600">
            Từ {minSubtotal.toLocaleString("vi-VN")}đ
          </p>
          <p className="mt-1 text-xs text-slate-700">
            {supportLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {freeShippingPromo.startAt || "Chưa đặt"} → {freeShippingPromo.endAt || "Chưa đặt"}
          </p>
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="admin-promo-preview-card">
          <p className="text-2xl font-black leading-tight text-orange-600">
            Hỗ trợ ship từ {minSubtotal.toLocaleString("vi-VN")}đ
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {supportLabel}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {getSupportExample(maxSupportShipFee)}
          </p>
          <div className="admin-promo-preview-meta">
            <span>{isActive ? "Đang bật" : "Đang tắt"}</span>
            <span>Bắt đầu: {freeShippingPromo.startAt || "Chưa đặt"}</span>
            <span>Kết thúc: {freeShippingPromo.endAt || "Chưa đặt"}</span>
          </div>
        </div>

        <div className="admin-promo-form-flow">
          <PromotionSummaryPills
            items={[
              isActive ? "Đang bật" : "Đang tắt",
              "Web khách hàng",
              `Đơn từ ${formatMoneyValue(minSubtotal)}`,
              supportLabel
            ]}
          />
          <PromotionSetupWarnings warnings={freeshipWarnings} />

          <PromotionFormSection
            step="1"
            title="Điều kiện hỗ trợ ship"
            note="Đặt mốc đơn tối thiểu và mức phí ship cửa hàng hỗ trợ."
          >
            <div className="admin-promo-form-grid">
              <label className="text-[12px] font-semibold text-slate-500">
                Mốc đơn tối thiểu
                <input
                  className="admin-input mt-1"
                  type="number"
                  min="0"
                  value={minSubtotal}
                  onChange={(event) =>
                    patchFreeShipping({
                      condition: {
                        ...freeShippingPromo.condition,
                        minSubtotal: Number(event.target.value || 0)
                      }
                    })
                  }
                />
              </label>

              <label className="text-[12px] font-semibold text-slate-500">
                Hỗ trợ tối đa (0 = toàn bộ phí ship)
                <input
                  className="admin-input mt-1"
                  type="number"
                  min="0"
                  value={maxSupportShipFee}
                  onChange={(event) =>
                    patchFreeShipping({
                      condition: {
                        ...freeShippingPromo.condition,
                        maxSupportShipFee: Number(event.target.value || 0)
                      }
                    })
                  }
                />
              </label>

              <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                Kênh áp dụng
                <div className="admin-promo-active-row mt-1">
                  <div>
                    <strong>Web khách hàng</strong>
                    <span>QR tại quầy và POS không dùng phí ship nên không áp dụng hỗ trợ ship.</span>
                  </div>
                </div>
              </div>

              <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                Trạng thái
                <div className="admin-promo-active-row mt-1">
                  <div>
                    <strong>Bật hỗ trợ ship</strong>
                    <span>Tắt để ẩn hỗ trợ ship khỏi web checkout.</span>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(event) => patchFreeShipping({ active: event.target.checked })}
                    />
                    <span />
                  </label>
                </div>
              </div>
            </div>
          </PromotionFormSection>

          <PromotionFormSection
            step="2"
            title="Thời gian chạy"
            note="Có thể để trống nếu chương trình chạy dài hạn."
          >
            <div className="admin-promo-form-grid">
              <label className="text-[12px] font-semibold text-slate-500">
                Ngày bắt đầu
                <input
                  className="admin-input mt-1"
                  type="date"
                  value={freeShippingPromo.startAt || ""}
                  onChange={(event) => patchFreeShipping({ startAt: event.target.value })}
                />
              </label>
              <label className="text-[12px] font-semibold text-slate-500">
                Ngày kết thúc
                <input
                  className="admin-input mt-1"
                  type="date"
                  value={freeShippingPromo.endAt || ""}
                  onChange={(event) => patchFreeShipping({ endAt: event.target.value })}
                />
              </label>
            </div>
          </PromotionFormSection>
        </div>
      </div>
    </section>
  );
}
