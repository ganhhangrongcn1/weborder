import { useEffect, useMemo, useState } from "react";
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
import PromotionFormSection from "./PromotionFormSection.jsx";
import PromotionSalesChannelField from "./PromotionSalesChannelField.jsx";
import {
  PromotionSetupWarnings,
  PromotionSummaryPills,
  formatSalesChannelSummary
} from "./PromotionSetupFeedback.jsx";

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "running", label: "Đang chạy" },
  { value: "upcoming", label: "Sắp chạy" },
  { value: "expired", label: "Hết hạn" },
  { value: "off", label: "Đã tắt" }
];

function normalizeSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getStrikeStatusCode(promo) {
  const label = getStrikeStatus(promo).label;
  if (label === "Đã tắt") return "off";
  if (label === "Sắp chạy") return "upcoming";
  if (label === "Hết hạn") return "expired";
  return "running";
}

function getEmptyFilterMessage(statusFilter) {
  if (statusFilter === "running") return "Chưa có chương trình giảm giá món đang chạy.";
  if (statusFilter === "upcoming") return "Chưa có chương trình giảm giá món sắp chạy.";
  if (statusFilter === "expired") return "Chưa có chương trình giảm giá món hết hạn.";
  if (statusFilter === "off") return "Chưa có chương trình giảm giá món đang tắt.";
  return "Không tìm thấy chương trình phù hợp.";
}

function getScopeSummary(promo) {
  const scope = promo?.condition?.applyScope || "all";
  if (scope === "category") return `Theo ${toIdList(promo?.condition?.categoryIds).length} danh mục`;
  if (scope === "product") return `Theo ${toIdList(promo?.condition?.productIds).length} món`;
  return "Toàn menu";
}

function buildStrikeWarnings(promo) {
  const warnings = [];
  const scope = promo?.condition?.applyScope || "all";
  if (Number(promo?.reward?.value || 0) <= 0) warnings.push("Giá trị giảm đang bằng 0.");
  if (scope === "category" && !toIdList(promo?.condition?.categoryIds).length) warnings.push("Đang chọn theo danh mục nhưng chưa tick danh mục nào.");
  if (scope === "product" && !toIdList(promo?.condition?.productIds).length) warnings.push("Đang chọn theo món nhưng chưa tick món nào.");
  if (promo?.startAt && promo?.endAt && String(promo.startAt) > String(promo.endAt)) warnings.push("Ngày kết thúc đang trước ngày bắt đầu.");
  if (getStrikeStatus(promo).label === "Hết hạn") warnings.push("Chương trình đã hết hạn, menu sẽ không áp dụng.");
  return warnings;
}

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("running");
  const filteredStrikePromos = useMemo(
    () => {
      const searchValue = normalizeSearch(searchTerm);
      return strikePromos.filter((promo) => {
        const searchKey = normalizeSearch(`${promo.title} ${promo.name} ${promo.text}`);
        const statusCode = getStrikeStatusCode(promo);
        const matchesStatus = statusFilter === "all" || statusCode === statusFilter;
        const matchesSearch = !searchValue || searchKey.includes(searchValue);
        return matchesStatus && matchesSearch;
      });
    },
    [strikePromos, searchTerm, statusFilter]
  );

  useEffect(() => {
    if (!filteredStrikePromos.length) {
      setSelectedStrikePromoId("");
      return;
    }
    if (!selectedStrikePromo || !filteredStrikePromos.some((promo) => promo.id === selectedStrikePromo.id)) {
      setSelectedStrikePromoId(filteredStrikePromos[0].id);
    }
  }, [filteredStrikePromos, selectedStrikePromo, setSelectedStrikePromoId]);

  const visibleSelectedStrikePromo = filteredStrikePromos.some((promo) => promo.id === selectedStrikePromo?.id)
    ? selectedStrikePromo
    : null;
  const strikeWarnings = visibleSelectedStrikePromo ? buildStrikeWarnings(visibleSelectedStrikePromo) : [];

  return strikePromos.length ? (
    <div className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách giảm giá món</strong>
          <button type="button" className="admin-cta" onClick={() => createPromotion("strike_price")}>+ Tạo mới</button>
        </div>

        <div className="admin-promo-list-tools">
          <label>
            <span>Tìm chương trình</span>
            <input
              className="admin-input"
              type="search"
              name="promo_strike_search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tên hoặc mô tả…"
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select className="admin-input" name="promo_strike_status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {filteredStrikePromos.map((promo) => {
            const status = getStrikeStatus(promo);
            const isSelected = selectedStrikePromo?.id === promo.id;
            return (
              <button
                key={promo.id}
                type="button"
                onClick={() => setSelectedStrikePromoId(promo.id)}
                className={`admin-promo-list-card ${isSelected ? "is-active" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">{promo.title || promo.name || "Giảm giá món ăn"}</strong>
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

          {!filteredStrikePromos.length ? (
            <p className="admin-promo-empty-note">{getEmptyFilterMessage(statusFilter)}</p>
          ) : null}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {visibleSelectedStrikePromo ? (
          <>
            <div className={`admin-promo-preview-card ${visibleSelectedStrikePromo.active ? "" : "is-muted"}`}>
              <p className="text-2xl font-black text-orange-600">
                🔥 {visibleSelectedStrikePromo.reward.type === "percent_discount" ? `GIẢM ${Number(visibleSelectedStrikePromo.reward.value || 0)}%` : `GIẢM ${formatMoney(visibleSelectedStrikePromo.reward.value || 0)}`}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {formatMoney(preview?.originalPrice || 0)} → {formatMoney(preview?.finalPrice || 0)}
                <span className="ml-2 text-orange-600">(-{Math.round(preview?.percentDiscount || 0)}%)</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">Áp dụng cho phạm vi đã chọn · Hết hạn: {formatDateShort(visibleSelectedStrikePromo.endAt)}</p>
            </div>

            <div className="admin-promo-form-flow">
              <PromotionSummaryPills
                items={[
                  getStrikeStatus(visibleSelectedStrikePromo).label,
                  formatSalesChannelSummary(visibleSelectedStrikePromo),
                  getScopeSummary(visibleSelectedStrikePromo),
                  visibleSelectedStrikePromo.reward.type === "percent_discount" ? `Giảm ${Number(visibleSelectedStrikePromo.reward.value || 0)}%` : visibleSelectedStrikePromo.reward.type === "fixed_price" ? `Đồng giá ${formatMoney(visibleSelectedStrikePromo.reward.value || 0)}` : `Giảm ${formatMoney(visibleSelectedStrikePromo.reward.value || 0)}`
                ]}
              />
              <PromotionSetupWarnings warnings={strikeWarnings} />

              <PromotionFormSection
                step="1"
                title="Mức giảm"
                note="Chọn giảm theo phần trăm hoặc giảm số tiền cố định."
              >
                <div className="admin-promo-form-grid">
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
              </PromotionFormSection>

              <PromotionFormSection
                step="2"
                title="Phạm vi áp dụng"
                note="Chọn toàn menu, theo danh mục hoặc từng món cụ thể."
              >
                {(() => {
                  const selectedScope = selectedStrikePromo.condition.applyScope || "all";
                  const selectedCategoryIds = toIdList(selectedStrikePromo.condition.categoryIds || "");
                  const selectedProductIds = toIdList(selectedStrikePromo.condition.productIds || "");
                  return (
                    <div className="admin-promo-form-grid">
                      <label className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                        Áp dụng cho
                        <select className="admin-input mt-1" value={selectedScope} onChange={(event) => updatePromotion(selectedStrikePromo.id, { condition: { ...selectedStrikePromo.condition, applyScope: event.target.value } })}>
                          {APPLY_SCOPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      {selectedScope === "category" ? (
                        <div className="admin-promo-form-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        <div className="admin-promo-form-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        <div className="admin-promo-form-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Đang áp dụng toàn bộ menu.
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </PromotionFormSection>

              <PromotionFormSection
                step="3"
                title="Thời gian & trạng thái"
                note="Đặt ngày chạy và bật/tắt chương trình."
              >
                <div className="admin-promo-form-grid">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày bắt đầu
                    <input className="admin-input mt-1" type="date" value={selectedStrikePromo.startAt || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { startAt: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Ngày kết thúc
                    <input className="admin-input mt-1" type="date" value={selectedStrikePromo.endAt || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { endAt: event.target.value })} />
                  </label>
                  <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                    Kênh áp dụng
                    <PromotionSalesChannelField
                      value={selectedStrikePromo.salesChannels}
                      onChange={(nextChannels) => updatePromotion(selectedStrikePromo.id, { salesChannels: nextChannels })}
                    />
                  </div>
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
              </PromotionFormSection>

              <PromotionFormSection
                step="4"
                title="Tên khách thấy"
                note="Nội dung dùng để hiển thị trên menu và quản lý nội bộ."
              >
                <div className="admin-promo-form-grid">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên chương trình
                    <input className="admin-input mt-1" value={selectedStrikePromo.title || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { title: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên nội bộ
                    <input className="admin-input mt-1" value={selectedStrikePromo.name || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { name: event.target.value })} />
                  </label>
                  <label className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                    Mô tả ngắn
                    <input className="admin-input mt-1" value={selectedStrikePromo.text || ""} onChange={(event) => updatePromotion(selectedStrikePromo.id, { text: event.target.value })} />
                  </label>
                </div>
              </PromotionFormSection>

              <details className="admin-promo-form-card">
                <summary className="admin-promo-details-summary">
                  5. Nâng cao: hiển thị & chồng ưu đãi
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="admin-promo-form-grid">
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

                  <div className="admin-promo-form-grid">
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

                  <div className="admin-promo-form-grid">
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
          <p className="admin-promo-empty-note">
            {filteredStrikePromos.length ? "Chọn chương trình giảm giá món để chỉnh sửa." : getEmptyFilterMessage(statusFilter)}
          </p>
        )}
      </div>
    </div>
  ) : null;
}
