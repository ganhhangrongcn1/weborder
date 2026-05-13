import { useEffect, useMemo, useState } from "react";

const VOUCHER_TYPES = [
  { value: "checkout", label: "Voucher thanh toán" },
  { value: "loyalty", label: "Voucher loyalty" }
];

function getCouponId(coupon = {}) {
  return String(coupon.id || coupon.code || `coupon-${Date.now()}`);
}

function normalizeCoupon(coupon = {}) {
  const endAt = String(coupon.endAt || coupon.expiry || "");
  return {
    id: getCouponId(coupon),
    code: String(coupon.code || "SALE10").toUpperCase(),
    name: String(coupon.name || "Mã giảm giá mới"),
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
  if (!coupon.active) return { label: "Tạm tắt", className: "bg-slate-100 text-slate-600" };
  if (!coupon.endAt) return { label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };

  const now = new Date();
  const endDate = new Date(`${coupon.endAt}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return { label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
  if (endDate.getTime() < now.getTime()) return { label: "Hết hạn", className: "bg-slate-100 text-slate-600" };

  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 3) return { label: "Sắp hết hạn", className: "bg-orange-100 text-orange-700" };
  return { label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
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

function inputClassName(isImportant = false) {
  const baseClass = "admin-input mt-1 w-full rounded-xl border border-slate-200 bg-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
  const sizeClass = isImportant ? "px-4 py-3 text-base font-semibold text-slate-900" : "px-3 py-2.5 text-sm font-medium text-slate-800";
  return `${baseClass} ${sizeClass}`;
}

function FieldLabel({ label, children }) {
  return (
    <label className="text-[12px] font-semibold text-slate-500">
      {label}
      {children}
    </label>
  );
}

export default function CouponManager({ coupons = [], setCoupons }) {
  const safeCoupons = useMemo(() => coupons.map((coupon) => normalizeCoupon(coupon)), [coupons]);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("checkout");
  const visibleCoupons = safeCoupons.filter((coupon) => String(coupon.voucherType || "checkout") === voucherTypeFilter);
  const [selectedCouponId, setSelectedCouponId] = useState("");

  useEffect(() => {
    if (!visibleCoupons.length) {
      setSelectedCouponId("");
      return;
    }
    const selectedStillVisible = visibleCoupons.some((coupon) => coupon.id === selectedCouponId);
    if (!selectedStillVisible) setSelectedCouponId(visibleCoupons[0].id);
  }, [selectedCouponId, visibleCoupons]);

  const selectedCoupon = visibleCoupons.find((item) => item.id === selectedCouponId) || null;
  const preview = selectedCoupon ? buildPreviewLines(selectedCoupon) : null;

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
      name: voucherTypeFilter === "loyalty" ? "Voucher loyalty mới" : "Mã giảm giá mới",
      discountType: "fixed",
      value: 10000,
      minOrder: 0,
      endAt: "",
      voucherType: voucherTypeFilter,
      active: true
    });
    setCoupons((current) => [seed, ...(current || [])]);
    setSelectedCouponId(seed.id);
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

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {visibleCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const isSelected = selectedCoupon?.id === coupon.id;
            return (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedCouponId(coupon.id)}
                className={`w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`}
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

          {!visibleCoupons.length ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Chưa có voucher</p>
          ) : null}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {!selectedCoupon ? (
          <p className="py-8 text-center text-sm text-slate-500">Chọn voucher để chỉnh sửa.</p>
        ) : (
          <>
            <div className="mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-2xl font-black leading-tight text-orange-600">{preview?.main}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{preview?.condition}</p>
              <p className="mt-1 text-xs text-slate-500">{preview?.expiry}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">1. Thông tin chính</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                </div>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700">2. Giá trị & điều kiện</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              </div>

              <details className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-[13px] font-black uppercase tracking-wide text-slate-700">Tùy chọn nâng cao</summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <strong className="block text-sm font-black text-slate-800">Bật voucher</strong>
                      <span className="text-xs font-semibold text-slate-500">Tắt để ẩn khỏi checkout/CRM nhưng vẫn giữ dữ liệu.</span>
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
