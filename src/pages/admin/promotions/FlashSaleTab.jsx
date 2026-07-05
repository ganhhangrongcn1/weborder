import { useEffect, useMemo, useState } from "react";
import {
  DISCOUNT_TYPE_OPTIONS,
  FLASH_APPLY_SCOPE_OPTIONS,
  ROUND_MODE_OPTIONS,
  WEEKDAY_OPTIONS,
  formatCountdownFromMs,
  formatRewardValue,
  formatWeekdaySummary,
  getFlashStatus,
  mergeDateAndTime,
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
  { value: "waiting_weekday", label: "Chưa tới ngày" },
  { value: "sold_out", label: "Hết suất" },
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

function getEmptyFilterMessage(statusFilter) {
  if (statusFilter === "running") return "Chưa có flash sale đang chạy.";
  if (statusFilter === "upcoming") return "Chưa có flash sale sắp chạy.";
  if (statusFilter === "waiting_weekday") return "Chưa có flash sale chờ đúng ngày.";
  if (statusFilter === "sold_out") return "Chưa có flash sale hết suất.";
  if (statusFilter === "expired") return "Chưa có flash sale hết hạn.";
  if (statusFilter === "off") return "Chưa có flash sale đang tắt.";
  return "Không tìm thấy flash sale phù hợp.";
}

function getScopeSummary(promo) {
  const scope = promo?.condition?.applyScope || "product";
  if (scope === "category") return `Theo ${toIdList(promo?.condition?.categoryIds).length} danh mục`;
  return `Theo ${toIdList(promo?.condition?.productIds).length} món`;
}

function buildFlashWarnings(promo, nowTick) {
  const warnings = [];
  const scope = promo?.condition?.applyScope || "product";
  const status = getFlashStatus(promo, new Date(nowTick));
  if (Number(promo?.reward?.value || 0) <= 0) warnings.push("Giá trị flash sale đang bằng 0.");
  if (scope === "category" && !toIdList(promo?.condition?.categoryIds).length) warnings.push("Đang chọn theo danh mục nhưng chưa tick danh mục nào.");
  if (scope !== "category" && !toIdList(promo?.condition?.productIds).length) warnings.push("Đang chọn theo món nhưng chưa tick món nào.");
  if (promo?.startAt && promo?.endAt && String(promo.startAt) > String(promo.endAt)) warnings.push("Ngày kết thúc đang trước ngày bắt đầu.");
  if (status.code === "sold_out") warnings.push("Flash sale đã hết suất.");
  if (status.code === "expired") warnings.push("Flash sale đã hết hạn.");
  return warnings;
}

export default function FlashSaleTab({
  flashSalePromos,
  selectedFlashPromo,
  setSelectedFlashPromoId,
  createPromotion,
  nowTick,
  updatePromotion,
  activeCategories,
  activeProducts,
  statusPromotions = [],
  setSmartPromotions,
  smartPromotions
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("running");
  const statusPromotionById = useMemo(
    () => new Map(statusPromotions.map((promo) => [String(promo?.id || ""), promo])),
    [statusPromotions]
  );
  const filteredFlashPromos = useMemo(
    () => {
      const searchValue = normalizeSearch(searchTerm);
      return flashSalePromos.filter((promo) => {
        const statusSource = statusPromotionById.get(String(promo.id || "")) || promo;
        const status = getFlashStatus(statusSource, new Date(nowTick));
        const searchKey = normalizeSearch(`${promo.title} ${promo.name} ${promo.text} ${promo.condition?.startTime} ${promo.condition?.endTime}`);
        const matchesStatus = statusFilter === "all" || status.code === statusFilter;
        const matchesSearch = !searchValue || searchKey.includes(searchValue);
        return matchesStatus && matchesSearch;
      });
    },
    [flashSalePromos, nowTick, searchTerm, statusFilter, statusPromotionById]
  );

  useEffect(() => {
    if (!filteredFlashPromos.length) {
      setSelectedFlashPromoId("");
      return;
    }
    if (!selectedFlashPromo || !filteredFlashPromos.some((promo) => promo.id === selectedFlashPromo.id)) {
      setSelectedFlashPromoId(filteredFlashPromos[0].id);
    }
  }, [filteredFlashPromos, selectedFlashPromo, setSelectedFlashPromoId]);

  const visibleSelectedFlashPromo = filteredFlashPromos.some((promo) => promo.id === selectedFlashPromo?.id)
    ? selectedFlashPromo
    : null;
  const visibleStatusPromotion = visibleSelectedFlashPromo
    ? statusPromotionById.get(String(visibleSelectedFlashPromo.id || "")) || visibleSelectedFlashPromo
    : null;
  const flashWarnings = visibleSelectedFlashPromo ? buildFlashWarnings(visibleSelectedFlashPromo, nowTick) : [];

  return flashSalePromos.length ? (
    <div className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách Flash Sale</strong>
          <button type="button" className="admin-cta" onClick={() => createPromotion("flash_sale")}>+ Tạo mới</button>
        </div>
        <div className="admin-promo-list-tools">
          <label>
            <span>Tìm flash sale</span>
            <input
              className="admin-input"
              type="search"
              name="promo_flash_search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tên hoặc khung giờ…"
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select className="admin-input" name="promo_flash_status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {filteredFlashPromos.map((promo) => {
            const statusSource = statusPromotionById.get(String(promo.id || "")) || promo;
            const status = getFlashStatus(statusSource, new Date(nowTick));
            const isSelected = selectedFlashPromo?.id === promo.id;
            const totalSlots = Number(promo.condition?.totalSlots || 0);
            const soldCount = Math.min(Number(promo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER);
            return (
              <button
                key={promo.id}
                type="button"
                onClick={() => setSelectedFlashPromoId(promo.id)}
                className={`admin-promo-list-card ${isSelected ? "is-active" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">{promo.title || promo.name || "Flash Sale"}</strong>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-xl font-black text-orange-600">
                  {formatRewardValue(promo.reward)}
                </p>
                <p className="mt-1 text-xs text-slate-700">{promo.condition?.startTime || "00:00"} - {promo.condition?.endTime || "23:59"}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{formatWeekdaySummary(promo.condition?.weekdays)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Đã bán {soldCount}/{totalSlots || 0} suất</p>
              </button>
            );
          })}
          {!filteredFlashPromos.length ? (
            <p className="admin-promo-empty-note">{getEmptyFilterMessage(statusFilter)}</p>
          ) : null}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {visibleSelectedFlashPromo ? (
          <>
            {(() => {
              const status = getFlashStatus(visibleStatusPromotion, new Date(nowTick));
              const totalSlots = Math.max(0, Number(visibleSelectedFlashPromo.condition?.totalSlots || 0));
              const soldCount = Math.max(0, Math.min(Number(visibleSelectedFlashPromo.condition?.soldCount || 0), totalSlots || Number.MAX_SAFE_INTEGER));
              const remaining = Math.max(totalSlots - soldCount, 0);
              const progress = totalSlots > 0 ? Math.min((soldCount / totalSlots) * 100, 100) : 0;
              const endDateTime = mergeDateAndTime(visibleSelectedFlashPromo.endAt, visibleSelectedFlashPromo.condition?.endTime || "23:59", true);
              const countdown = status.code === "running" && endDateTime
                ? formatCountdownFromMs(endDateTime.getTime() - nowTick)
                : "";
              return (
                <div className={`admin-promo-preview-card ${visibleSelectedFlashPromo.active ? "" : "is-muted"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">⚡ {visibleSelectedFlashPromo.title || "FLASH SALE"}</p>
                      <p className="mt-1 text-2xl font-black text-orange-600">
                        {formatRewardValue(visibleSelectedFlashPromo.reward)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{visibleSelectedFlashPromo.condition?.startTime || "00:00"} - {visibleSelectedFlashPromo.condition?.endTime || "23:59"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{formatWeekdaySummary(visibleSelectedFlashPromo.condition?.weekdays)}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Đã bán {soldCount}/{totalSlots || 0} suất · Còn lại {remaining} suất</p>
                  <div className="admin-promo-progress">
                    <div className="admin-promo-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  {countdown ? <p className="mt-2 text-xs font-bold text-orange-700">Kết thúc sau: {countdown}</p> : null}
                </div>
              );
            })()}

            <div className="admin-promo-form-flow">
              <PromotionSummaryPills
                items={[
                  getFlashStatus(visibleStatusPromotion, new Date(nowTick)).label,
                  formatSalesChannelSummary(visibleSelectedFlashPromo),
                  getScopeSummary(visibleSelectedFlashPromo),
                  `${visibleSelectedFlashPromo.condition?.startTime || "00:00"} - ${visibleSelectedFlashPromo.condition?.endTime || "23:59"}`,
                  formatRewardValue(visibleSelectedFlashPromo.reward)
                ]}
              />
              <PromotionSetupWarnings warnings={flashWarnings} />

              <PromotionFormSection
                step="1"
                title="Món chạy flash sale"
                note="Chọn danh mục hoặc từng món để tránh giảm nhầm toàn menu."
              >
                {(() => {
                  const selectedScope = selectedFlashPromo.condition.applyScope || "product";
                  const selectedCategoryIds = toIdList(selectedFlashPromo.condition.categoryIds || "");
                  const selectedProductIds = toIdList(selectedFlashPromo.condition.productIds || "");
                  return (
                    <div className="admin-promo-form-grid">
                      <label className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                        Áp dụng cho
                        <select className="admin-input mt-1" value={selectedScope} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, applyScope: event.target.value } })}>
                          {FLASH_APPLY_SCOPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      {selectedScope === "category" ? (
                        <div className="admin-promo-form-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        <div className="admin-promo-form-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
              </PromotionFormSection>

              <PromotionFormSection
                step="2"
                title="Giá flash sale"
                note="Chọn kiểu giảm hoặc giá đồng giá cho món đang chạy."
              >
                <div className="admin-promo-form-grid">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Kiểu giảm
                    <select className="admin-input mt-1" value={selectedFlashPromo.reward.type} onChange={(event) => updatePromotion(selectedFlashPromo.id, { reward: { ...selectedFlashPromo.reward, type: event.target.value } })}>
                      {DISCOUNT_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    {selectedFlashPromo.reward.type === "fixed_price" ? "Giá đồng giá" : "Giá trị giảm"}
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.reward.value || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { reward: { ...selectedFlashPromo.reward, value: Number(event.target.value || 0) } })} />
                  </label>
                </div>
                {selectedFlashPromo.reward.type === "fixed_price" ? (
                  <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                    Kênh được bật sẽ bán đúng giá này cho món/danh mục được chọn khi chương trình đang chạy.
                  </p>
                ) : null}
              </PromotionFormSection>

              <PromotionFormSection
                step="3"
                title="Thời gian chạy"
                note="Đặt ngày, khung giờ và ngày lặp trong tuần."
              >
                <div className="admin-promo-form-grid">
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
                  <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                    Kênh áp dụng
                    <PromotionSalesChannelField
                      value={selectedFlashPromo.salesChannels}
                      onChange={(nextChannels) => updatePromotion(selectedFlashPromo.id, { salesChannels: nextChannels })}
                    />
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-600">Lặp theo ngày trong tuần</p>
                    <button
                      type="button"
                      className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm"
                      onClick={() => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, weekdays: [] } })}
                    >
                      Mọi ngày
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((weekday) => {
                      const selectedWeekdays = Array.isArray(selectedFlashPromo.condition.weekdays) ? selectedFlashPromo.condition.weekdays.map(Number) : [];
                      const isChecked = selectedWeekdays.includes(weekday.value);
                      const nextWeekdays = isChecked
                        ? selectedWeekdays.filter((day) => day !== weekday.value)
                        : [...selectedWeekdays, weekday.value];
                      return (
                        <label key={weekday.value} className={`rounded-full border px-3 py-2 text-xs font-black ${isChecked ? "border-orange-300 bg-orange-100 text-orange-700" : "border-slate-200 bg-white text-slate-500"}`}>
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={isChecked}
                            onChange={() => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, weekdays: nextWeekdays } })}
                          />
                          {weekday.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    Ví dụ flashsale Thứ 4: chỉ tick T4. Không tick ngày nào nghĩa là chạy mọi ngày trong khoảng ngày bắt đầu/kết thúc.
                  </p>
                </div>
              </PromotionFormSection>

              <PromotionFormSection
                step="4"
                title="Số suất"
                note="Giới hạn tổng lượt bán và số lượng mỗi khách được mua."
              >
                <div className="admin-promo-form-grid">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tổng số suất flash sale
                    <input className="admin-input mt-1" type="number" min="0" value={Number(selectedFlashPromo.condition.totalSlots || 0)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, totalSlots: Number(event.target.value || 0) } })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Mỗi khách mua tối đa
                    <input className="admin-input mt-1" type="number" min="1" value={Number(selectedFlashPromo.condition.maxPerCustomer || 1)} onChange={(event) => updatePromotion(selectedFlashPromo.id, { condition: { ...selectedFlashPromo.condition, maxPerCustomer: Number(event.target.value || 1) } })} />
                  </label>
                </div>
              </PromotionFormSection>

              <PromotionFormSection
                step="5"
                title="Tên khách thấy"
                note="Nội dung dùng để hiển thị trên menu và quản lý nội bộ."
              >
                <div className="admin-promo-form-grid">
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên chương trình
                    <input className="admin-input mt-1" value={selectedFlashPromo.title || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { title: event.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold text-slate-500">
                    Tên nội bộ
                    <input className="admin-input mt-1" value={selectedFlashPromo.name || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { name: event.target.value })} />
                  </label>
                  <label className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                    Mô tả ngắn
                    <input className="admin-input mt-1" value={selectedFlashPromo.text || ""} onChange={(event) => updatePromotion(selectedFlashPromo.id, { text: event.target.value })} />
                  </label>
                </div>
              </PromotionFormSection>

              <details className="admin-promo-form-card">
                <summary className="admin-promo-details-summary">
                  6. Nâng cao: ưu tiên & số đã bán
                </summary>
                <div className="admin-promo-form-grid mt-4">
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
          <p className="admin-promo-empty-note">
            {filteredFlashPromos.length ? "Chọn chương trình Flash Sale để chỉnh sửa." : getEmptyFilterMessage(statusFilter)}
          </p>
        )}
      </div>
    </div>
  ) : null;
}
