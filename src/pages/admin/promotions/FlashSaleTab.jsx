import {
  DISCOUNT_TYPE_OPTIONS,
  FLASH_APPLY_SCOPE_OPTIONS,
  ROUND_MODE_OPTIONS,
  formatCountdownFromMs,
  formatMoney,
  getFlashStatus,
  mergeDateAndTime,
  toIdList,
  toggleCsvId
} from "./promotionTabUtils.js";

export default function FlashSaleTab({
  flashSalePromos,
  selectedFlashPromo,
  setSelectedFlashPromoId,
  createPromotion,
  nowTick,
  updatePromotion,
  activeCategories,
  activeProducts,
  setSmartPromotions,
  smartPromotions
}) {
  return flashSalePromos.length ? (
    <div className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách Flash Sale</strong>
          <button type="button" className="admin-cta" onClick={() => createPromotion("flash_sale")}>+ Tạo mới</button>
        </div>
        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {flashSalePromos.map((promo) => {
            const status = getFlashStatus(promo, new Date(nowTick));
            const isSelected = selectedFlashPromo?.id === promo.id;
            const totalSlots = Number(promo.condition?.totalSlots || 0);
            const soldCount = Math.min(Number(promo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER);
            return (
              <button
                key={promo.id}
                type="button"
                onClick={() => setSelectedFlashPromoId(promo.id)}
                className={`w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">{promo.title || promo.name || "Flash Sale"}</strong>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-xl font-black text-orange-600">
                  {promo.reward.type === "percent_discount" ? `-${Number(promo.reward.value || 0)}%` : `-${formatMoney(promo.reward.value || 0)}`}
                </p>
                <p className="mt-1 text-xs text-slate-700">{promo.condition?.startTime || "00:00"} - {promo.condition?.endTime || "23:59"}</p>
                <p className="mt-1 text-[11px] text-slate-500">Đã bán {soldCount}/{totalSlots || 0} suất</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {selectedFlashPromo ? (
          <>
            {(() => {
              const status = getFlashStatus(selectedFlashPromo, new Date(nowTick));
              const totalSlots = Math.max(0, Number(selectedFlashPromo.condition?.totalSlots || 0));
              const soldCount = Math.max(0, Math.min(Number(selectedFlashPromo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER));
              const remaining = Math.max(totalSlots - soldCount, 0);
              const progress = totalSlots > 0 ? Math.min((soldCount / totalSlots) * 100, 100) : 0;
              const endDateTime = mergeDateAndTime(selectedFlashPromo.endAt, selectedFlashPromo.condition?.endTime || "23:59", true);
              const countdown = status.code === "running" && endDateTime
                ? formatCountdownFromMs(endDateTime.getTime() - nowTick)
                : "";
              return (
                <div className={`mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3 ${selectedFlashPromo.active ? "opacity-100" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">⚡ {selectedFlashPromo.title || "FLASH SALE"}</p>
                      <p className="mt-1 text-2xl font-black text-orange-600">
                        {selectedFlashPromo.reward.type === "percent_discount"
                          ? `GIẢM ${Number(selectedFlashPromo.reward.value || 0)}%`
                          : `GIẢM ${formatMoney(selectedFlashPromo.reward.value || 0)}`}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{selectedFlashPromo.condition?.startTime || "00:00"} - {selectedFlashPromo.condition?.endTime || "23:59"}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Đã bán {soldCount}/{totalSlots || 0} suất · Còn lại {remaining} suất</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {countdown ? <p className="mt-2 text-xs font-bold text-orange-700">Kết thúc sau: {countdown}</p> : null}
                </div>
              );
            })()}

            <div className="space-y-4">
              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">1. Chọn món chạy Flash Sale</h4>
                {(() => {
                  const selectedScope = selectedFlashPromo.condition.applyScope || "product";
                  const selectedCategoryIds = toIdList(selectedFlashPromo.condition.categoryIds || "");
                  const selectedProductIds = toIdList(selectedFlashPromo.condition.productIds || "");
                  return (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-[12px] font-semibold text-slate-500 md:col-span-2">
                        Áp dụng cho
                        <select className="admin-input mt-1" value={selectedScope} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, applyScope: event.target.value } })}>
                          {FLASH_APPLY_SCOPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      {selectedScope === "category" ? (
                        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[12px] font-semibold text-slate-600">Chọn danh mục áp dụng</p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {activeCategories.map((categoryName) => (
                              <label key={categoryName} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selectedCategoryIds.includes(categoryName)}
                                  onChange={() =>
                                    updatePromotion(selectedFlashPromo.id, {
                                      condition: {
                                        ...selectedFlashPromo.condition,
                                        categoryIds: toggleCsvId(selectedFlashPromo.condition.categoryIds || "", categoryName)
                                      }
                                    })
                                  }
                                />
                                <span>{categoryName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {selectedScope === "product" ? (
                        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[12px] font-semibold text-slate-600">Chọn món áp dụng</p>
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {activeProducts.map((product) => (
                              <label key={product.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selectedProductIds.includes(product.id)}
                                  onChange={() =>
                                    updatePromotion(selectedFlashPromo.id, {
                                      condition: {
                                        ...selectedFlashPromo.condition,
                                        productIds: toggleCsvId(selectedFlashPromo.condition.productIds || "", product.id)
                                      }
                                    })
                                  }
                                />
                                <span className="flex-1">{product.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">2. Giảm bao nhiêu?</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Kiểu giảm
                    <select className="admin-input mt-1" value={selectedFlashPromo.reward.type} onChange={(event) => updatePromotion(selectedFlashPromo.id, { reward: { ...selectedFlashPromo.reward, type: event.target.value } })}>
                      {DISCOUNT_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Giá trị giảm
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.reward.value || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { reward: { ...selectedFlashPromo.reward, value: Number(event.target.value || 0) } })} />
                  </label>
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">3. Chạy khi nào?</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày bắt đầu
                    <input className="admin-input mt-1" type="date" value={selectedFlashPromo.startAt || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { startAt: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày kết thúc
                    <input className="admin-input mt-1" type="date" value={selectedFlashPromo.endAt || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { endAt: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Giờ bắt đầu
                    <input className="admin-input mt-1" type="time" value={selectedFlashPromo.condition.startTime || "10:00"} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, startTime: event.target.value } })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Giờ kết thúc
                    <input className="admin-input mt-1" type="time" value={selectedFlashPromo.condition.endTime || "13:00"} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, endTime: event.target.value } })} />
                  </label>
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">4. Giới hạn suất</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tổng số suất flash sale
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.condition.totalSlots || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, totalSlots: Number(event.target.value || 0) } })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Mỗi khách mua tối đa
                    <input className="admin-input mt-1" type="number" min="1" value={Number(selectedFlashPromo.condition.maxPerCustomer || 1)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, maxPerCustomer: Number(event.target.value || 1) } })} />
                  </label>
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">5. Tên hiển thị</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên chương trình
                    <input className="admin-input mt-1" value={selectedFlashPromo.title || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { title: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên nội bộ
                    <input className="admin-input mt-1" value={selectedFlashPromo.name || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { name: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500 md:col-span-2">
                    Mô tả ngắn
                    <input className="admin-input mt-1" value={selectedFlashPromo.text || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { text: event.target.value })} />
                  </label>
                </div>
              </div>

              <details className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-[13px] font-black uppercase tracking-wide text-slate-700">
                  Tùy chọn nâng cao
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Làm tròn giá sau giảm
                    <select className="admin-input mt-1" value={selectedFlashPromo.reward.roundMode || "none"} onChange={(event) => updatePromotion(selectedFlashPromo.id, { reward: { ...selectedFlashPromo.reward, roundMode: event.target.value } })}>
                      {ROUND_MODE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Priority / Độ ưu tiên
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.priority || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { priority: Number(event.target.value || 0) })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Không cho chồng khuyến mãi
                    <div className="mt-2">
                      <label className="admin-switch">
                        <input type="checkbox" checked={Boolean(selectedFlashPromo.condition.noStackWithOtherPromotions)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, noStackWithOtherPromotions: event.target.checked } })} />
                        <span />
                      </label>
                    </div>
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Đã bán (demo/admin)
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.condition.soldCount || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, soldCount: Number(event.target.value || 0) } })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Bật chương trình
                    <div className="mt-2">
                      <label className="admin-switch">
                        <input type="checkbox" checked={Boolean(selectedFlashPromo.active)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { active: event.target.checked })} />
                        <span />
                      </label>
                    </div>
                  </label>
                </div>
              </details>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button className="admin-danger" onClick={() => setSmartPromotions(smartPromotions.filter((item) => item.id !== selectedFlashPromo.id))}>Xóa chương trình</button>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">Chọn chương trình Flash Sale để chỉnh sửa.</p>
        )}
      </div>
    </div>
  ) : null;
}
