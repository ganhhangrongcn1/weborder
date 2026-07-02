import { useEffect, useMemo, useState } from "react";
import {
  applyLoyaltyVoucherPresets,
  LOYALTY_VOUCHER_PRESETS
} from "../../../services/loyaltyVoucherPresetService.js";
import { ALL_PROMOTION_SALES_CHANNELS, normalizeSalesChannels } from "../../../services/promotionChannelService.js";
import PromotionFormSection from "./PromotionFormSection.jsx";
import PromotionSalesChannelField from "./PromotionSalesChannelField.jsx";
import {
  PromotionSetupWarnings,
  PromotionSummaryPills,
  formatSalesChannelSummary
} from "./PromotionSetupFeedback.jsx";

const VOUCHER_TYPES = [
  { value: "checkout", label: "Voucher thanh toán" },
  { value: "loyalty", label: "Voucher loyalty" }
];

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "running", label: "Đang chạy" },
  { value: "expiring", label: "Sắp hết hạn" },
  { value: "expired", label: "Hết hạn" },
  { value: "off", label: "Đang tắt" }
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

function getCouponId(coupon = {}) {
  return String(coupon.id || coupon.code || `coupon-${Date.now()}`);
}

function normalizeCoupon(coupon = {}) {
  const endAt = String(coupon.endAt || coupon.expiry || "");
  return {
    id: getCouponId(coupon),
    code: String(coupon.code || "SALE10").toUpperCase(),
    name: String(coupon.name || "Voucher mới"),
    discountType: coupon.discountType === "percent" ? "percent" : "fixed",
    value: Number(coupon.value || 0),
    maxDiscount: Number(coupon.maxDiscount || 0),
    minOrder: Number(coupon.minOrder || 0),
    startAt: String(coupon.startAt || ""),
    endAt,
    customerType: String(coupon.customerType || "all"),
    usageLimit: Number(coupon.usageLimit || 0),
    perUserLimit: Number(coupon.perUserLimit || 1),
    totalUsed: Number(coupon.totalUsed || 0),
    voucherType: String(coupon.voucherType || "checkout"),
    fulfillmentType: String(coupon.fulfillmentType || "all"),
    scopeType: String(coupon.scopeType || "all"),
    scopeValues: String(coupon.scopeValues || ""),
    salesChannels: normalizeSalesChannels(coupon.salesChannels, ALL_PROMOTION_SALES_CHANNELS),
    stackable: Boolean(coupon.stackable),
    active: coupon.active !== false,
    expiry: endAt
  };
}

function formatDiscountValue(coupon) {
  if (coupon.discountType === "percent") return `${Number(coupon.value || 0)}%`;
  return `${Number(coupon.value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDateShort(dateText) {
  if (!dateText) return "Không giới hạn";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("vi-VN");
}

function getCouponStatus(coupon) {
  if (!coupon.active) return { code: "off", label: "Tạm tắt", className: "bg-slate-100 text-slate-600" };
  if (!coupon.endAt) return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };

  const now = new Date();
  const endDate = new Date(`${coupon.endAt}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
  if (endDate.getTime() < now.getTime()) return { code: "expired", label: "Hết hạn", className: "bg-slate-100 text-slate-600" };

  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 3) return { code: "expiring", label: "Sắp hết hạn", className: "bg-orange-100 text-orange-700" };
  return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
}

function buildPreviewLines(coupon) {
  const main = coupon.discountType === "percent"
    ? `Giảm ${Number(coupon.value || 0)}%`
    : `Giảm ${Number(coupon.value || 0).toLocaleString("vi-VN")}đ`;
  const condition = Number(coupon.minOrder || 0)
    ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ`
    : "Áp dụng mọi đơn";
  const expiry = `Hết hạn: ${formatDateShort(coupon.endAt)}`;
  return { main, condition, expiry };
}

function buildCouponWarnings(coupon) {
  const warnings = [];
  if (!String(coupon?.code || "").trim()) warnings.push("Chưa nhập mã voucher.");
  if (!String(coupon?.name || "").trim()) warnings.push("Chưa nhập tên hiển thị cho khách.");
  if (Number(coupon?.value || 0) <= 0) warnings.push("Giá trị giảm đang bằng 0 nên khách sẽ không được giảm.");
  if (coupon?.discountType === "percent" && Number(coupon?.value || 0) > 100) warnings.push("Giảm theo % đang lớn hơn 100%.");
  if (coupon?.endAt) {
    const endDate = new Date(`${coupon.endAt}T23:59:59`);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) warnings.push("Voucher đã hết hạn, checkout sẽ không áp dụng.");
  }
  if (Number(coupon?.usageLimit || 0) > 0 && Number(coupon?.totalUsed || 0) >= Number(coupon?.usageLimit || 0)) {
    warnings.push("Voucher đã chạm giới hạn lượt dùng.");
  }
  return warnings;
}

function buildCouponSummary(coupon) {
  const status = getCouponStatus(coupon).label;
  const minOrder = Number(coupon?.minOrder || 0) > 0
    ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ`
    : "Mọi đơn";
  const usageLimit = Number(coupon?.usageLimit || 0) > 0
    ? `Còn ${Math.max(Number(coupon.usageLimit || 0) - Number(coupon.totalUsed || 0), 0)} lượt`
    : "Không giới hạn lượt";
  return [
    status,
    coupon?.voucherType === "loyalty" ? "Loyalty / CRM" : "Checkout",
    formatSalesChannelSummary(coupon),
    minOrder,
    usageLimit
  ];
}

function inputClassName(isImportant = false) {
  const baseClass = "admin-input admin-promo-field-input";
  const sizeClass = isImportant ? "admin-promo-field-input--strong" : "";
  return `${baseClass} ${sizeClass}`;
}

function FieldLabel({ label, children }) {
  return (
    <label className="admin-promo-field-label">
      {label}
      {children}
    </label>
  );
}

export default function CouponManager({ coupons = [], setCoupons }) {
  const safeCoupons = useMemo(() => coupons.map((coupon) => normalizeCoupon(coupon)), [coupons]);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("checkout");
  const [statusFilter, setStatusFilter] = useState("running");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [presetMessage, setPresetMessage] = useState("");
  const visibleCoupons = useMemo(
    () => safeCoupons.filter((coupon) => String(coupon.voucherType || "checkout") === voucherTypeFilter),
    [safeCoupons, voucherTypeFilter]
  );
  const filteredCoupons = useMemo(
    () => {
      const searchValue = normalizeSearch(searchTerm);
      return visibleCoupons.filter((coupon) => {
        const status = getCouponStatus(coupon);
        const searchKey = normalizeSearch(`${coupon.code} ${coupon.name}`);
        const matchesStatus = statusFilter === "all" || status.code === statusFilter;
        const matchesSearch = !searchValue || searchKey.includes(searchValue);
        return matchesStatus && matchesSearch;
      });
    },
    [visibleCoupons, searchTerm, statusFilter]
  );
  const visibleStats = useMemo(
    () => visibleCoupons.reduce(
      (total, coupon) => {
        const code = getCouponStatus(coupon).code;
        total[code] = (total[code] || 0) + 1;
        return total;
      },
      { running: 0, expiring: 0, expired: 0, off: 0 }
    ),
    [visibleCoupons]
  );
  const loyaltyCoupons = safeCoupons.filter((coupon) => String(coupon.voucherType || "checkout") === "loyalty");
  const loyaltyCodes = new Set(loyaltyCoupons.map((coupon) => String(coupon.code || "").toUpperCase()).filter(Boolean));
  const loyaltyPresetReadyCount = LOYALTY_VOUCHER_PRESETS.filter((preset) => loyaltyCodes.has(preset.code)).length;

  useEffect(() => {
    if (!filteredCoupons.length) {
      setSelectedCouponId("");
      return;
    }
    const selectedStillVisible = filteredCoupons.some((coupon) => coupon.id === selectedCouponId);
    if (!selectedStillVisible) setSelectedCouponId(filteredCoupons[0].id);
  }, [selectedCouponId, filteredCoupons]);

  const selectedCoupon = filteredCoupons.find((item) => item.id === selectedCouponId) || null;
  const preview = selectedCoupon ? buildPreviewLines(selectedCoupon) : null;
  const couponWarnings = selectedCoupon ? buildCouponWarnings(selectedCoupon) : [];
  const couponSummary = selectedCoupon ? buildCouponSummary(selectedCoupon) : [];

  const patchCoupon = (couponId, patch) => {
    setCoupons((current) =>
      (current || []).map((item) => {
        const currentId = getCouponId(item);
        if (currentId !== couponId) return item;
        const next = normalizeCoupon({ ...item, ...patch, id: currentId });
        return { ...next, expiry: next.endAt || "" };
      })
    );
  };

  const addCoupon = () => {
    const seed = normalizeCoupon({
      id: `coupon-${Date.now()}`,
      code: voucherTypeFilter === "loyalty" ? "LOYAL10" : "NEW10",
      name: voucherTypeFilter === "loyalty" ? "Voucher loyalty mới" : "Voucher mới",
      discountType: "fixed",
      value: 10000,
      minOrder: 0,
      endAt: "",
      voucherType: voucherTypeFilter,
      salesChannels: ["web", "qr"],
      active: true
    });
    setCoupons((current) => [seed, ...(current || [])]);
    setSelectedCouponId(seed.id);
  };

  const addLoyaltyPresetPack = () => {
    const result = applyLoyaltyVoucherPresets(coupons);
    setCoupons(result.coupons);
    if (result.created[0]?.id) setSelectedCouponId(result.created[0].id);
    setVoucherTypeFilter("loyalty");
    setPresetMessage(
      result.createdCount > 0
        ? `Đã tạo ${result.createdCount} voucher loyalty mẫu. Anh chỉnh lại giá trị rồi bấm Lưu khuyến mãi là xong.`
        : "Bộ voucher loyalty mẫu đã có sẵn. Anh chỉ cần chỉnh lại mức giảm và hạn dùng."
    );
  };

  const removeCoupon = (couponId) => {
    setCoupons((current) => (current || []).filter((item) => getCouponId(item) !== couponId));
  };

  return (
    <section className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách voucher</strong>
          <button type="button" className="admin-cta" onClick={addCoupon}>+ Tạo mới</button>
        </div>

        <div className="admin-menu-tabs admin-gap-12 mb-3">
          {VOUCHER_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className={voucherTypeFilter === type.value ? "active" : ""}
              onClick={() => setVoucherTypeFilter(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="admin-promo-list-tools">
          <label>
            <span>Tìm voucher</span>
            <input
              className="admin-input"
              type="search"
              name="promo_coupon_search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nhập mã hoặc tên…"
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select className="admin-input" name="promo_coupon_status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-promo-mini-stats">
          <span><b>{visibleStats.running}</b> đang chạy</span>
          <span><b>{visibleStats.expiring}</b> sắp hết hạn</span>
          <span><b>{visibleStats.expired}</b> hết hạn</span>
          <span><b>{visibleStats.off}</b> đang tắt</span>
        </div>

        {voucherTypeFilter === "loyalty" ? (
          <div className="mb-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Setup nhanh loyalty</p>
                <strong className="mt-1 block text-sm font-black text-slate-900">
                  Có {loyaltyPresetReadyCount}/{LOYALTY_VOUCHER_PRESETS.length} voucher mẫu
                </strong>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Tạo một lần để dùng cho auto-tặng theo hạng, sau đó chỉ cần sửa lại số tiền hoặc hạn dùng.
                </p>
              </div>
              <button type="button" className="admin-cta" onClick={addLoyaltyPresetPack}>
                Tạo bộ mẫu
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {LOYALTY_VOUCHER_PRESETS.map((preset) => {
                const ready = loyaltyCodes.has(String(preset.code || "").toUpperCase());
                return (
                  <span
                    key={preset.code}
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${ready ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500"}`}
                  >
                    {preset.code}
                  </span>
                );
              })}
            </div>
            {presetMessage ? (
              <p className="mt-3 text-xs font-semibold text-amber-800">{presetMessage}</p>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const isSelected = selectedCoupon?.id === coupon.id;
            return (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedCouponId(coupon.id)}
                className={`admin-promo-list-card ${isSelected ? "is-active" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-lg font-black tracking-wide text-slate-900">{coupon.code || "---"}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-xl font-black text-orange-600">{formatDiscountValue(coupon)}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{Number(coupon.minOrder || 0) ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ` : "Mọi đơn"}</span>
                  <span>{formatDateShort(coupon.endAt)}</span>
                </div>
              </button>
            );
          })}

          {!filteredCoupons.length ? (
            <p className="admin-promo-empty-note">Không tìm thấy voucher phù hợp.</p>
          ) : null}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {!selectedCoupon ? (
          <p className="admin-promo-empty-note">Chọn voucher để chỉnh sửa.</p>
        ) : (
          <>
            <div className="admin-promo-preview-card">
              <p className="text-2xl font-black leading-tight text-orange-600">{preview?.main}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{preview?.condition}</p>
              <p className="mt-1 text-xs text-slate-500">{preview?.expiry}</p>
              <div className="admin-promo-preview-meta">
                <span>Hiển thị: {selectedCoupon.voucherType === "loyalty" ? "Loyalty / CRM" : "Checkout"}</span>
                <span>Giới hạn: {Number(selectedCoupon.usageLimit || 0) > 0 ? `${selectedCoupon.totalUsed}/${selectedCoupon.usageLimit} lượt` : "Không giới hạn"}</span>
                <span>Mỗi khách: {Number(selectedCoupon.perUserLimit || 1)} lượt</span>
              </div>
            </div>

            <div className="admin-promo-form-flow">
              <PromotionSummaryPills items={couponSummary} />
              <PromotionSetupWarnings warnings={couponWarnings} />

              <PromotionFormSection
                step="1"
                title="Khách thấy gì?"
                note="Mã, tên và nơi hiển thị của voucher."
              >
                <div className="admin-promo-form-grid">
                  <FieldLabel label="Mã voucher">
                    <input className={inputClassName(true)} value={selectedCoupon.code} onChange={(event) => patchCoupon(selectedCoupon.id, { code: String(event.target.value || "").toUpperCase().replace(/\s+/g, "") })} />
                  </FieldLabel>
                  <FieldLabel label="Tên hiển thị">
                    <input className={inputClassName()} value={selectedCoupon.name} onChange={(event) => patchCoupon(selectedCoupon.id, { name: event.target.value })} />
                  </FieldLabel>
                  <FieldLabel label="Loại voucher">
                    <select className={inputClassName()} value={selectedCoupon.voucherType} onChange={(event) => patchCoupon(selectedCoupon.id, { voucherType: event.target.value })}>
                      {VOUCHER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Ngày hết hạn">
                    <input className={inputClassName()} type="date" value={selectedCoupon.endAt} onChange={(event) => patchCoupon(selectedCoupon.id, { endAt: event.target.value, expiry: event.target.value })} />
                  </FieldLabel>
                  <div className="admin-promo-form-span-2 text-[12px] font-semibold text-slate-500">
                    Kênh áp dụng
                    <PromotionSalesChannelField
                      value={selectedCoupon.salesChannels}
                      onChange={(nextChannels) => patchCoupon(selectedCoupon.id, { salesChannels: nextChannels })}
                    />
                  </div>
                </div>
              </PromotionFormSection>

              <PromotionFormSection
                step="2"
                title="Giảm bao nhiêu?"
                note="Chọn kiểu giảm, giá trị giảm và mốc đơn tối thiểu."
              >
                <div className="admin-promo-form-grid">
                  <FieldLabel label="Loại giảm">
                    <select className={inputClassName(true)} value={selectedCoupon.discountType} onChange={(event) => patchCoupon(selectedCoupon.id, { discountType: event.target.value, maxDiscount: event.target.value === "percent" ? selectedCoupon.maxDiscount : 0 })}>
                      <option value="fixed">Giảm số tiền</option>
                      <option value="percent">Giảm theo %</option>
                    </select>
                  </FieldLabel>
                  <FieldLabel label={`Giá trị giảm (${selectedCoupon.discountType === "percent" ? "%" : "đ"})`}>
                    <input className={inputClassName(true)} type="number" min="0" value={selectedCoupon.value} onChange={(event) => patchCoupon(selectedCoupon.id, { value: Number(event.target.value || 0) })} />
                  </FieldLabel>
                  {selectedCoupon.discountType === "percent" ? (
                    <FieldLabel label="Giảm tối đa (đ)">
                      <input className={inputClassName()} type="number" min="0" value={selectedCoupon.maxDiscount} onChange={(event) => patchCoupon(selectedCoupon.id, { maxDiscount: Number(event.target.value || 0) })} />
                    </FieldLabel>
                  ) : null}
                  <FieldLabel label="Đơn tối thiểu (đ)">
                    <input className={inputClassName()} type="number" min="0" value={selectedCoupon.minOrder} onChange={(event) => patchCoupon(selectedCoupon.id, { minOrder: Number(event.target.value || 0) })} />
                  </FieldLabel>
                </div>
              </PromotionFormSection>

              <details className="admin-promo-form-card">
                <summary className="admin-promo-details-summary">3. Giới hạn sử dụng</summary>
                <div className="mt-4 space-y-4">
                  <div className="admin-promo-form-grid">
                    <FieldLabel label="Giới hạn dùng toàn bộ">
                      <input className={inputClassName()} type="number" min="0" value={selectedCoupon.usageLimit} onChange={(event) => patchCoupon(selectedCoupon.id, { usageLimit: Number(event.target.value || 0) })} />
                    </FieldLabel>
                    <FieldLabel label="Tối đa mỗi khách">
                      <input className={inputClassName()} type="number" min="1" value={selectedCoupon.perUserLimit} onChange={(event) => patchCoupon(selectedCoupon.id, { perUserLimit: Number(event.target.value || 1) })} />
                    </FieldLabel>
                    <FieldLabel label="Đã dùng">
                      <input className={inputClassName()} type="number" min="0" value={selectedCoupon.totalUsed} onChange={(event) => patchCoupon(selectedCoupon.id, { totalUsed: Number(event.target.value || 0) })} />
                    </FieldLabel>
                  </div>
                  <div className="admin-promo-active-row admin-promo-form-span-2">
                    <div>
                      <strong>Bật voucher</strong>
                      <span>Tắt để ẩn khỏi checkout/CRM nhưng vẫn giữ dữ liệu.</span>
                    </div>
                    <label className="admin-switch">
                      <input type="checkbox" checked={selectedCoupon.active} onChange={(event) => patchCoupon(selectedCoupon.id, { active: event.target.checked })} />
                      <span />
                    </label>
                  </div>
                </div>
              </details>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button type="button" className="admin-danger" onClick={() => removeCoupon(selectedCoupon.id)}>
                Xóa voucher này
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
