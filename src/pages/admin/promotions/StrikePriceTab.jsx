import {
  APPLY_SCOPE_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  MIN_DISCOUNT_TO_SHOW_OPTIONS,
  ROUND_MODE_OPTIONS,
  formatDateShort,
  formatMoney,
  getStrikeStatus,
  toIdList,
  toggleCsvId
} from "./promotionTabUtils.js";

export default function StrikePriceTab({
  strikePromos,
  selectedStrikePromo,
  setSelectedStrikePromoId,
  createPromotion,
  preview,
  updatePromotion,
  activeCategories,
  activeProducts,
  setSmartPromotions,
  smartPromotions
}) {
  return strikePromos.length ? (
    <div className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách gạch giá</strong>
          <button type="button" className="admin-cta" onClick={() => createPromotion("strike_price")}>+ Tạo mới</button>
        </div>

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {strikePromos.map((promo) => {
            const status = getStrikeStatus(promo);
            const isSelected = selectedStrikePromo?.id === promo.id;
            return (
              <button
                key={promo.id}
                type="button"
                onClick={() => setSelectedStrikePromoId(promo.id)}
                className={`w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">{promo.title || promo.name || "Gạch giá món ăn"}</strong>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-xl font-black text-orange-600">
                  {promo.reward.type === "percent_discount" ? `-${Number(promo.reward.value || 0)}%` : `-${formatMoney(promo.reward.value || 0)}`}
                </p>
                <p className="mt-1 text-xs text-slate-700">
                  {promo.condition.applyScope === "all" ? "Toàn menu" : promo.condition.applyScope === "category" ? "Theo danh mục" : "Theo món cụ thể"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{formatDateShort(promo.startAt)} → {formatDateShort(promo.endAt)}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {selectedStrikePromo ? (
          <>
            <div className={`mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3 ${selectedStrikePromo.active ? "opacity-100" : "opacity-60"}`}>
              <p className="text-2xl font-black text-orange-600">
                🔥 {selectedStrikePromo.reward.type === "percent_discount" ? `GIẢM ${Number(selectedStrikePromo.reward.value || 0)}%` : `GIẢM ${formatMoney(selectedStrikePromo.reward.value || 0)}`}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {formatMoney(preview?.originalPrice || 0)} → {formatMoney(preview?.finalPrice || 0)}
                <span className="ml-2 text-orange-600">(-{Math.round(preview?.percentDiscount || 0)}%)</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">Áp dụng cho phạm vi đã chọn · Hết hạn: {formatDateShort(selectedStrikePromo.endAt)}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">1. Giảm bao nhiêu?</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Kiểu giảm
                    <select className="admin-input mt-1" value={selectedStrikePromo.reward.type} onChange={(event) => updatePromotion(selectedStrikePromo.id, { reward: { ...selectedStrikePromo.reward, type: event.target.value } })}>
                      {DISCOUNT_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Giá trị giảm
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedStrikePromo.reward.value || 0)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { reward: { ...selectedStrikePromo.reward, value: Number(event.target.value || 0) } })} />
                  </label>
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">2. Áp dụng cho món nào?</h4>
                {(() => {
                  const selectedScope = selectedStrikePromo.condition.applyScope || "all";
                  const selectedCategoryIds = toIdList(selectedStrikePromo.condition.categoryIds || "");
                  const selectedProductIds = toIdList(selectedStrikePromo.condition.productIds || "");
                  return (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-[12px] font-semibold text-slate-500 md:col-span-2">
                        Áp dụng cho
                        <select className="admin-input mt-1" value={selectedScope} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, applyScope: event.target.value } })}>
                          {APPLY_SCOPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      {selectedScope === "category" ? (
                        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[12px] font-semibold text-slate-600">Chọn danh mục áp dụng</p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {activeCategories.map((categoryName) => {
                              const checked = selectedCategoryIds.includes(categoryName);
                              return (
                                <label key={categoryName} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      updatePromotion(selectedStrikePromo.id, {
                                        condition: {
                                          ...selectedStrikePromo.condition,
                                          categoryIds: toggleCsvId(selectedStrikePromo.condition.categoryIds || "", categoryName)
                                        }
                                      })
                                    }
                                  />
                                  <span>{categoryName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {selectedScope === "product" ? (
                        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[12px] font-semibold text-slate-600">Chọn món áp dụng</p>
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {activeProducts.map((product) => {
                              const checked = selectedProductIds.includes(product.id);
                              return (
                                <label key={product.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      updatePromotion(selectedStrikePromo.id, {
                                        condition: {
                                          ...selectedStrikePromo.condition,
                                          productIds: toggleCsvId(selectedStrikePromo.condition.productIds || "", product.id)
                                        }
                                      })
                                    }
                                  />
                                  <span className="flex-1">{product.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {selectedScope === "all" ? (
                        <div className="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Đang áp dụng toàn bộ menu.
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">3. Chạy khi nào?</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày bắt đầu
                    <input className="admin-input mt-1" type="date" value={selectedStrikePromo.startAt || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { startAt: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày kết thúc
                    <input className="admin-input mt-1" type="date" value={selectedStrikePromo.endAt || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { endAt: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Bật chương trình
                    <div className="mt-2">
                      <label className="admin-switch">
                        <input type="checkbox" checked={Boolean(selectedStrikePromo.active)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { active: event.target.checked })} />
                        <span />
                      </label>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">4. Tên hiển thị</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên chương trình
                    <input className="admin-input mt-1" value={selectedStrikePromo.title || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { title: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên nội bộ
                    <input className="admin-input mt-1" value={selectedStrikePromo.name || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { name: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500 md:col-span-2">
                    Mô tả ngắn
                    <input className="admin-input mt-1" value={selectedStrikePromo.text || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { text: event.target.value })} />
                  </label>
                </div>
              </div>

              <details className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-[13px] font-black uppercase tracking-wide text-slate-700">
                  Tùy chọn nâng cao
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="text-[12px] font-semibold text-slate-500">
                      Làm tròn giá sau giảm
                      <select className="admin-input mt-1" value={selectedStrikePromo.reward.roundMode || "none"} onChange={(event) => updatePromotion(selectedStrikePromo.id, { reward: { ...selectedStrikePromo.reward, roundMode: event.target.value } })}>
                        {ROUND_MODE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-semibold text-slate-500">
                      Priority / Độ ưu tiên
                      <input className="admin-input mt-1" type="number" min="0" value={Number(selectedStrikePromo.priority || 0)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { priority: Number(event.target.value || 0) })} />
                    </label>
                    <label className="text-[12px] font-semibold text-slate-500">
                      Không cho chồng khuyến mãi
                      <div className="mt-2">
                        <label className="admin-switch">
                          <input type="checkbox" checked={Boolean(selectedStrikePromo.condition.noStackWithOtherPromotions)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, noStackWithOtherPromotions: event.target.checked } })} />
                          <span />
                        </label>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="text-[12px] font-semibold text-slate-500">
                      Áp dụng theo khung giờ
                      <div className="mt-2">
                        <label className="admin-switch">
                          <input type="checkbox" checked={Boolean(selectedStrikePromo.condition.useTimeWindow)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, useTimeWindow: event.target.checked } })} />
                          <span />
                        </label>
                      </div>
                    </label>
                    {selectedStrikePromo.condition.useTimeWindow ? (
                      <>
                        <label className="text-[12px] font-semibold text-slate-500">
                          Giờ bắt đầu
                          <input className="admin-input mt-1" type="time" value={selectedStrikePromo.condition.startTime || "09:00"} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, startTime: event.target.value } })} />
                        </label>
                        <label className="text-[12px] font-semibold text-slate-500">
                          Giờ kết thúc
                          <input className="admin-input mt-1" type="time" value={selectedStrikePromo.condition.endTime || "21:00"} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, endTime: event.target.value } })} />
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-[12px] font-semibold text-slate-500">
                      Chỉ hiển thị nếu mức giảm tối thiểu
                      <select className="admin-input mt-1" value={Number(selectedStrikePromo.condition.minDiscountToShow || 5)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, minDiscountToShow: Number(event.target.value || 5) } })}>
                        {MIN_DISCOUNT_TO_SHOW_OPTIONS.map((value) => (
                          <option key={value} value={value}>{value}%</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-semibold text-slate-500">
                      Giá tối thiểu sau giảm
                      <input className="admin-input mt-1" type="number" min="0" value={Number(selectedStrikePromo.condition.minFinalPrice || 0)} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, minFinalPrice: Number(event.target.value || 0) } })} />
                    </label>
                  </div>
                </div>
              </details>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button className="admin-danger" onClick={() => setSmartPromotions(smartPromotions.filter((item) => item.id !== selectedStrikePromo.id))}>Xóa chương trình</button>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">Chọn chương trình gạch giá để chỉnh sửa.</p>
        )}
      </div>
    </div>
  ) : null;
}
