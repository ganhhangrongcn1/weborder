export default function FreeshipManager({
  freeShippingPromo,
  createPromotion,
  updatePromotion
}) {
  if (!freeShippingPromo) {
    return (
      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Freeship theo chương trình</h2>
        </div>
        <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Chưa có cấu hình freeship.</p>
          <button className="admin-cta mt-3" type="button" onClick={() => createPromotion("free_shipping")}>
            Tạo chương trình freeship
          </button>
        </div>
      </section>
    );
  }

  const minSubtotal = Number(freeShippingPromo?.condition?.minSubtotal || 0);
  const maxSupportShipFee = Number(freeShippingPromo?.condition?.maxSupportShipFee || 0);
  const isActive = freeShippingPromo?.active !== false;

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>Freeship theo chương trình</h2>
      </div>

      <div className="space-y-4">
        <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">Cấu hình chính</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-[12px] font-semibold text-slate-500">
              Mốc đơn tối thiểu
              <input
                className="admin-input mt-1"
                type="number"
                min="0"
                value={minSubtotal}
                onChange={(event) =>
                  updatePromotion(freeShippingPromo.id, {
                    condition: {
                      ...freeShippingPromo.condition,
                      minSubtotal: Number(event.target.value || 0)
                    }
                  })
                }
              />
            </label>

            <label className="text-[12px] font-semibold text-slate-500">
              Phí ship hỗ trợ tối đa (0 = toàn bộ)
              <input
                className="admin-input mt-1"
                type="number"
                min="0"
                value={maxSupportShipFee}
                onChange={(event) =>
                  updatePromotion(freeShippingPromo.id, {
                    condition: {
                      ...freeShippingPromo.condition,
                      maxSupportShipFee: Number(event.target.value || 0)
                    }
                  })
                }
              />
            </label>

            <label className="text-[12px] font-semibold text-slate-500">
              Bật chương trình
              <div className="mt-2">
                <label className="admin-switch">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => updatePromotion(freeShippingPromo.id, { active: event.target.checked })}
                  />
                  <span />
                </label>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">Thời gian chạy</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-[12px] font-semibold text-slate-500">
              Ngày bắt đầu
              <input
                className="admin-input mt-1"
                type="date"
                value={freeShippingPromo.startAt || ""}
                onChange={(event) => updatePromotion(freeShippingPromo.id, { startAt: event.target.value })}
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-500">
              Ngày kết thúc
              <input
                className="admin-input mt-1"
                type="date"
                value={freeShippingPromo.endAt || ""}
                onChange={(event) => updatePromotion(freeShippingPromo.id, { endAt: event.target.value })}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
