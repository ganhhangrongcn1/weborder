import { useEffect, useMemo, useState } from "react";
import {
  applyLoyaltyVoucherPresets,
  LOYALTY_VOUCHER_PRESETS
} from "../../../services/loyaltyVoucherPresetService.js";
import { normalizeLoyaltyProgramConfig } from "../../../services/loyaltyProgramConfigService.js";
import { ALL_PROMOTION_SALES_CHANNELS, normalizeSalesChannels } from "../../../services/promotionChannelService.js";
import {
  buildCouponFromSetupPreset,
  getVoucherAudienceDefinition,
  listVoucherSetupPresetsForGroup,
  VOUCHER_CAMPAIGN_AUDIENCES
} from "../../../services/voucherCampaignPresetService.js";
import {
  describeCouponExpiry,
  getCouponValidDaysAfterGrant,
  getCouponVoucherType,
  normalizeValidDaysAfterGrant
} from "../../../services/voucherTemplateService.js";
import {
  COUPON_MANAGEMENT_GROUPS,
  getCouponManagementGroupDefinition,
  listCouponManagementGroupsForVoucherType,
  normalizeCouponManagementGroup
} from "../../../services/voucherManagementGroupService.js";
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

function getCouponRef(coupon = {}) {
  return String(coupon?.id || coupon?.code || "").trim();
}

function normalizeCoupon(coupon = {}, loyaltyConfig = {}) {
  const voucherType = getCouponVoucherType(coupon);
  const endAt = voucherType === "loyalty" ? "" : String(coupon.endAt || coupon.expiry || "");
  const managementGroup = normalizeCouponManagementGroup(coupon, loyaltyConfig);

  return {
    id: getCouponId(coupon),
    code: String(coupon.code || "SALE10").toUpperCase(),
    name: coupon.name == null ? "Voucher mới" : String(coupon.name),
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
    voucherType,
    managementGroup,
    campaignType: String(coupon.campaignType || ""),
    campaignAudience: String(coupon.campaignAudience || "all"),
    campaignLabel: String(coupon.campaignLabel || coupon.name || ""),
    validDaysAfterGrant: voucherType === "loyalty"
      ? getCouponValidDaysAfterGrant(coupon, 7)
      : 0,
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
  if (getCouponVoucherType(coupon) === "loyalty") {
    return coupon.active
      ? { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" }
      : { code: "off", label: "Tạm tắt", className: "bg-slate-100 text-slate-600" };
  }

  if (!coupon.active) return { code: "off", label: "Tạm tắt", className: "bg-slate-100 text-slate-600" };
  if (!coupon.endAt) return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };

  const now = new Date();
  const endDate = new Date(`${coupon.endAt}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) {
    return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
  }
  if (endDate.getTime() < now.getTime()) {
    return { code: "expired", label: "Hết hạn", className: "bg-slate-100 text-slate-600" };
  }

  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 3) {
    return { code: "expiring", label: "Sắp hết hạn", className: "bg-orange-100 text-orange-700" };
  }

  return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
}

function buildPreviewLines(coupon) {
  const title = String(coupon.name || "").trim() || String(coupon.code || "Voucher").trim() || "Voucher";
  const main = coupon.discountType === "percent"
    ? `Giảm ${Number(coupon.value || 0)}%`
    : `Giảm ${Number(coupon.value || 0).toLocaleString("vi-VN")}đ`;
  const condition = Number(coupon.minOrder || 0)
    ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ`
    : "Áp dụng mọi đơn";
  const expiry = getCouponVoucherType(coupon) === "loyalty"
    ? `Dùng trong: ${describeCouponExpiry(coupon, 7)}`
    : `Hết hạn: ${formatDateShort(coupon.endAt)}`;

  return { title, main, condition, expiry };
}

function buildCouponWarnings(coupon) {
  const warnings = [];
  if (!String(coupon?.code || "").trim()) warnings.push("Chưa nhập mã voucher.");
  if (!String(coupon?.name || "").trim()) warnings.push("Chưa nhập tên hiển thị cho khách.");
  if (Number(coupon?.value || 0) <= 0) warnings.push("Giá trị giảm đang bằng 0 nên khách sẽ không được giảm.");
  if (coupon?.discountType === "percent" && Number(coupon?.value || 0) > 100) warnings.push("Giảm theo % đang lớn hơn 100%.");

  if (getCouponVoucherType(coupon) === "loyalty") {
    if (Number(coupon?.validDaysAfterGrant || 0) <= 0) {
      warnings.push("Voucher loyalty cần có số ngày sử dụng sau khi nhận.");
    }
  } else if (coupon?.endAt) {
    const endDate = new Date(`${coupon.endAt}T23:59:59`);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      warnings.push("Voucher đã hết hạn, checkout sẽ không áp dụng.");
    }
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
  const managementLabel = getCouponManagementGroupDefinition(coupon?.managementGroup).label;
  const audienceLabel = getVoucherAudienceDefinition(coupon?.campaignAudience).label;

  return [
    status,
    managementLabel,
    coupon?.voucherType === "loyalty" ? describeCouponExpiry(coupon, 7) : formatSalesChannelSummary(coupon),
    coupon?.managementGroup === "loyalty_crm" ? audienceLabel : minOrder
  ];
}

function inputClassName(isImportant = false) {
  const baseClass = "admin-input admin-promo-field-input";
  const sizeClass = isImportant ? "admin-promo-field-input--strong" : "";
  return `${baseClass} ${sizeClass}`.trim();
}

function FieldLabel({ label, children }) {
  return (
    <label className="admin-promo-field-label">
      {label}
      {children}
    </label>
  );
}

export default function CouponManager({
  coupons = [],
  setCoupons,
  loyaltyConfig = {},
  setLoyaltyConfig = () => {}
}) {
  const normalizedLoyaltyConfig = useMemo(
    () => normalizeLoyaltyProgramConfig(loyaltyConfig || {}),
    [loyaltyConfig]
  );
  const safeCoupons = useMemo(
    () => coupons.map((coupon) => normalizeCoupon(coupon, normalizedLoyaltyConfig)),
    [coupons, normalizedLoyaltyConfig]
  );
  const [managementGroupFilter, setManagementGroupFilter] = useState("checkout_sales");
  const [statusFilter, setStatusFilter] = useState("running");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [presetMessage, setPresetMessage] = useState("");

  const couponGroups = useMemo(
    () => COUPON_MANAGEMENT_GROUPS.map((group) => ({
      ...group,
      count: safeCoupons.filter((coupon) => coupon.managementGroup === group.value).length
    })),
    [safeCoupons]
  );
  const activeGroup = useMemo(
    () => getCouponManagementGroupDefinition(managementGroupFilter),
    [managementGroupFilter]
  );
  const activeGroupPresets = useMemo(
    () => listVoucherSetupPresetsForGroup(managementGroupFilter),
    [managementGroupFilter]
  );

  const visibleCoupons = useMemo(
    () => safeCoupons.filter((coupon) => String(coupon.managementGroup || "checkout_sales") === managementGroupFilter),
    [safeCoupons, managementGroupFilter]
  );

  const filteredCoupons = useMemo(() => {
    const searchValue = normalizeSearch(searchTerm);
    return visibleCoupons.filter((coupon) => {
      const status = getCouponStatus(coupon);
      const searchKey = normalizeSearch(`${coupon.code} ${coupon.name}`);
      const matchesStatus = statusFilter === "all" || status.code === statusFilter;
      const matchesSearch = !searchValue || searchKey.includes(searchValue);
      return matchesStatus && matchesSearch;
    });
  }, [visibleCoupons, searchTerm, statusFilter]);

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

  const loyaltyCoupons = useMemo(
    () => safeCoupons.filter((coupon) => String(coupon.voucherType || "checkout") === "loyalty"),
    [safeCoupons]
  );
  const loyaltyAutoCoupons = useMemo(
    () => safeCoupons.filter((coupon) => coupon.managementGroup === "loyalty_auto"),
    [safeCoupons]
  );
  const loyaltyCrmCoupons = useMemo(
    () => safeCoupons.filter((coupon) => coupon.managementGroup === "loyalty_crm"),
    [safeCoupons]
  );

  const loyaltyCodes = new Set(
    loyaltyCoupons.map((coupon) => String(coupon.code || "").toUpperCase()).filter(Boolean)
  );
  const loyaltyPresetReadyCount = LOYALTY_VOUCHER_PRESETS.filter((preset) => loyaltyCodes.has(preset.code)).length;
  const loyaltySetupReady = loyaltyPresetReadyCount === LOYALTY_VOUCHER_PRESETS.length;
  const welcomeVoucherCoupon = useMemo(
    () => loyaltyCoupons.find((coupon) => getCouponRef(coupon) === String(normalizedLoyaltyConfig.welcomeVoucherId || "").trim()) || null,
    [loyaltyCoupons, normalizedLoyaltyConfig.welcomeVoucherId]
  );

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
        const next = normalizeCoupon({ ...item, ...patch, id: currentId }, normalizedLoyaltyConfig);
        return { ...next, expiry: next.endAt || "" };
      })
    );
  };

  const insertCoupon = (seed) => {
    setCoupons((current) => [seed, ...(current || [])]);
    setSelectedCouponId(seed.id);
  };

  const addCoupon = () => {
    const voucherType = activeGroup.voucherType;
    const seed = normalizeCoupon({
      id: `coupon-${Date.now()}`,
      code: managementGroupFilter === "loyalty_auto" ? "AUTO10" : managementGroupFilter === "loyalty_crm" ? "CRM10" : "NEW10",
      name: activeGroup.label,
      discountType: "fixed",
      value: 10000,
      minOrder: 0,
      endAt: "",
      voucherType,
      managementGroup: managementGroupFilter,
      validDaysAfterGrant: voucherType === "loyalty" ? 7 : 0,
      salesChannels: ["web", "qr"],
      campaignAudience: "all",
      campaignLabel: activeGroup.label,
      active: true
    }, normalizedLoyaltyConfig);

    insertCoupon(seed);
  };

  const addCouponFromPreset = (presetValue) => {
    const presetCoupon = buildCouponFromSetupPreset(presetValue, Date.now());
    if (!presetCoupon) return;
    const seed = normalizeCoupon(presetCoupon, normalizedLoyaltyConfig);
    setManagementGroupFilter(seed.managementGroup || managementGroupFilter);
    insertCoupon(seed);
  };

  const addLoyaltyPresetPack = () => {
    const result = applyLoyaltyVoucherPresets(coupons);
    const createdIds = new Set(result.created.map((coupon) => getCouponId(coupon)));

    setCoupons(result.coupons.map((coupon) => (
      createdIds.has(getCouponId(coupon))
        ? { ...coupon, managementGroup: "loyalty_auto" }
        : coupon
    )));
    if (result.created[0]?.id) setSelectedCouponId(result.created[0].id);
    setManagementGroupFilter("loyalty_auto");
    setPresetMessage(
      result.createdCount > 0
        ? `Đã tạo ${result.createdCount} voucher loyalty mẫu. Anh chỉnh lại giá trị rồi bấm Lưu khuyến mãi là xong.`
        : "Bộ voucher loyalty mẫu đã có sẵn. Anh chỉ cần chỉnh lại mức giảm và số ngày dùng sau khi nhận."
    );
  };

  const removeCoupon = (couponId) => {
    setCoupons((current) => (current || []).filter((item) => getCouponId(item) !== couponId));
  };

  const patchWelcomeVoucherConfig = (patch) => {
    setLoyaltyConfig((current) => normalizeLoyaltyProgramConfig({
      ...(current || normalizedLoyaltyConfig),
      ...patch
    }));
  };

  return (
    <section className="admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-black text-slate-800">Danh sách voucher</strong>
          <button type="button" className="admin-cta" onClick={addCoupon}>+ Tạo trống</button>
        </div>

        <div className="admin-promo-group-grid">
          {couponGroups.map((group) => (
            <button
              key={group.value}
              type="button"
              className={`admin-promo-group-card ${managementGroupFilter === group.value ? "is-active" : ""}`}
              onClick={() => setManagementGroupFilter(group.value)}
            >
              <span>{group.label}</span>
              <strong>{group.count}</strong>
              <small>{group.description}</small>
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
              placeholder="Nhập mã hoặc tên..."
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

        {managementGroupFilter === "loyalty_auto" ? (
          <details className="admin-promo-helper-card mb-3">
            <summary className="admin-promo-helper-summary">
              <div className="admin-promo-helper-copy">
                <span>Cài nhanh loyalty</span>
                <strong>Voucher loyalty tự động</strong>
                <small>Nhóm này quản lý voucher đang gắn vào welcome hoặc quà hạng theo tháng.</small>
              </div>
              <div className="admin-promo-helper-badges">
                <span className={loyaltySetupReady ? "is-ready" : ""}>
                  {loyaltyPresetReadyCount}/{LOYALTY_VOUCHER_PRESETS.length} mẫu
                </span>
                <span className={normalizedLoyaltyConfig.welcomeVoucherEnabled ? "is-ready" : ""}>
                  {normalizedLoyaltyConfig.welcomeVoucherEnabled ? "Auto đang bật" : "Auto đang tắt"}
                </span>
                <span className={loyaltyAutoCoupons.length > 0 ? "is-ready" : ""}>
                  {loyaltyAutoCoupons.length} voucher auto
                </span>
              </div>
            </summary>

            <div className="admin-promo-helper-body">
              <div className="admin-promo-helper-steps">
                <span>1. Tạo bộ voucher mẫu nếu chưa có.</span>
                <span>2. Chọn đúng voucher muốn tặng cho khách mới.</span>
                <span>3. Gắn voucher theo hạng rồi bấm Lưu khuyến mãi.</span>
              </div>

              <div className="admin-promo-helper-panels">
                <section className="admin-promo-helper-panel">
                  <div className="admin-promo-helper-panel-head">
                    <div>
                      <strong>Bộ voucher loyalty mẫu</strong>
                      <small>Dùng để setup nhanh bộ voucher tự động theo hạng.</small>
                    </div>
                    <button type="button" className="admin-cta" onClick={addLoyaltyPresetPack}>
                      Tạo bộ mẫu
                    </button>
                  </div>

                  <div className="admin-promo-helper-chip-list">
                    {LOYALTY_VOUCHER_PRESETS.map((preset) => {
                      const ready = loyaltyCodes.has(String(preset.code || "").toUpperCase());
                      return (
                        <span
                          key={preset.code}
                          className={`admin-promo-helper-chip ${ready ? "is-ready" : ""}`}
                        >
                          {preset.code}
                        </span>
                      );
                    })}
                  </div>

                  {presetMessage ? (
                    <p className="admin-promo-helper-note is-warm">{presetMessage}</p>
                  ) : null}
                </section>

                <section className="admin-promo-helper-panel">
                  <div className="admin-promo-helper-panel-head">
                    <div>
                      <strong>Tự động tặng khách mới</strong>
                      <small>Khách mới đăng ký thành viên sẽ nhận voucher này.</small>
                    </div>
                    <label className="admin-switch">
                      <input
                        type="checkbox"
                        checked={normalizedLoyaltyConfig.welcomeVoucherEnabled}
                        onChange={(event) => patchWelcomeVoucherConfig({
                          welcomeVoucherEnabled: event.target.checked
                        })}
                      />
                      <span />
                    </label>
                  </div>

                  <div className="grid gap-3">
                    <label className="admin-promo-field-label">
                      Voucher tự động tặng
                      <select
                        className="admin-input admin-promo-field-input"
                        value={normalizedLoyaltyConfig.welcomeVoucherId}
                        onChange={(event) => patchWelcomeVoucherConfig({
                          welcomeVoucherId: event.target.value
                        })}
                      >
                        <option value="">Chưa chọn voucher</option>
                        {loyaltyCoupons.map((voucher) => (
                          <option key={getCouponRef(voucher)} value={getCouponRef(voucher)}>
                            {voucher.code || "Không có mã"} - {voucher.name || voucher.title || "Voucher loyalty"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="admin-promo-helper-note">
                    {welcomeVoucherCoupon
                      ? `Đang chọn: ${welcomeVoucherCoupon.code || "Không có mã"} - ${welcomeVoucherCoupon.name || "Voucher loyalty"}.`
                      : "Chưa chọn voucher chào thành viên mới."}
                    {" "}Hệ thống sẽ lấy đúng số ngày sử dụng sau khi nhận ngay trên voucher này.
                  </p>
                </section>
              </div>
            </div>
          </details>
        ) : null}

        {managementGroupFilter === "loyalty_crm" ? (
          <section className="admin-promo-context-card mb-3">
            <div className="admin-promo-context-card__head">
              <div>
                <span>CRM / chiến dịch</span>
                <strong>Kho voucher riêng để anh tặng tay và chạy chương trình riêng</strong>
              </div>
              <b>{loyaltyCrmCoupons.length} voucher</b>
            </div>

            <div className="admin-promo-context-list">
              <span>Khách lâu chưa quay lại 7 ngày / 15 ngày</span>
              <span>Event tri ân, sinh nhật, mini game</span>
              <span>Tặng tay từ CRM mà không đụng vào voucher auto</span>
            </div>

            <p className="admin-promo-helper-note">
              Chặng này mình tách riêng kho voucher CRM trước cho dễ quản lý. Ở chặng sau em sẽ nối thêm rule lọc nhóm khách và campaign tự động.
            </p>
          </section>
        ) : null}

        {activeGroupPresets.length ? (
          <section className="admin-promo-context-card mb-3">
            <div className="admin-promo-context-card__head">
              <div>
                <span>Tạo nhanh theo mục đích</span>
                <strong>Chọn mẫu phù hợp rồi chỉ cần chỉnh lại giá trị nếu cần</strong>
              </div>
              <b>{activeGroupPresets.length} mẫu</b>
            </div>

            <div className="admin-promo-preset-list">
              {activeGroupPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="admin-promo-preset-card"
                  onClick={() => addCouponFromPreset(preset.value)}
                >
                  <span>{preset.label}</span>
                  <strong>{preset.code}</strong>
                  <small>{preset.note}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const isSelected = selectedCoupon?.id === coupon.id;
            const audienceLabel = coupon.managementGroup === "loyalty_crm"
              ? getVoucherAudienceDefinition(coupon.campaignAudience).label
              : "";

            return (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedCouponId(coupon.id)}
                className={`admin-promo-list-card ${isSelected ? "is-active" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-black tracking-wide text-slate-900">{coupon.code || "---"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{coupon.name || "Chưa đặt tên hiển thị"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-xl font-black text-orange-600">{formatDiscountValue(coupon)}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{Number(coupon.minOrder || 0) ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ` : "Mọi đơn"}</span>
                  <span>{coupon.voucherType === "loyalty" ? describeCouponExpiry(coupon, 7) : formatDateShort(coupon.endAt)}</span>
                </div>
                {audienceLabel ? (
                  <p className="admin-promo-list-meta">{coupon.campaignLabel || audienceLabel} · {audienceLabel}</p>
                ) : null}
              </button>
            );
          })}

          {!filteredCoupons.length ? (
            <p className="admin-promo-empty-note">Chưa có voucher phù hợp trong nhóm {activeGroup.label.toLowerCase()}.</p>
          ) : null}
        </div>
      </aside>

      <div className="admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
        {!selectedCoupon ? (
          <p className="admin-promo-empty-note">Chọn voucher để chỉnh sửa.</p>
        ) : (
          <>
            <div className="admin-promo-preview-card">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{preview?.title}</p>
              <p className="text-2xl font-black leading-tight text-orange-600">{preview?.main}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{preview?.condition}</p>
              <p className="mt-1 text-xs text-slate-500">{preview?.expiry}</p>
              <div className="admin-promo-preview-meta">
                <span>Nhóm: {getCouponManagementGroupDefinition(selectedCoupon.managementGroup).label}</span>
                <span>
                  {selectedCoupon.managementGroup === "loyalty_crm"
                    ? `Tệp khách: ${getVoucherAudienceDefinition(selectedCoupon.campaignAudience).label}`
                    : `Giới hạn: ${Number(selectedCoupon.usageLimit || 0) > 0 ? `${selectedCoupon.totalUsed}/${selectedCoupon.usageLimit} lượt` : "Không giới hạn"}`}
                </span>
                <span>
                  {selectedCoupon.managementGroup === "loyalty_crm"
                    ? `Nhãn: ${selectedCoupon.campaignLabel || "Chưa đặt nhãn"}`
                    : `Mỗi khách: ${Number(selectedCoupon.perUserLimit || 1)} lượt`}
                </span>
              </div>
            </div>

            <div className="admin-promo-form-flow">
              <PromotionSummaryPills items={couponSummary} />
              <PromotionSetupWarnings warnings={couponWarnings} />

              <div className="admin-promo-mode-strip" aria-hidden="true">
                <div className="is-active">
                  <strong>Cơ bản</strong>
                  <span>Mã, tên, giảm giá, hạn dùng, kênh áp dụng.</span>
                </div>
                <div>
                  <strong>Nâng cao</strong>
                  <span>Giới hạn lượt và số đã dùng nếu cần quản lý sâu hơn.</span>
                </div>
              </div>

              <PromotionFormSection
                step="1"
                title="Cơ bản: khách thấy gì?"
                note="Nhập mã, tên hiển thị, hạn dùng và kênh áp dụng."
              >
                <div className="admin-promo-form-grid">
                  <FieldLabel label="Mã voucher">
                    <input className={inputClassName(true)} value={selectedCoupon.code} onChange={(event) => patchCoupon(selectedCoupon.id, { code: String(event.target.value || "").toUpperCase().replace(/\s+/g, "") })} />
                  </FieldLabel>

                  <FieldLabel label="Tên hiển thị">
                    <input
                      className={inputClassName()}
                      autoComplete="off"
                      value={selectedCoupon.name || ""}
                      onChange={(event) => patchCoupon(selectedCoupon.id, { name: event.target.value })}
                    />
                  </FieldLabel>

                  {selectedCoupon.voucherType === "loyalty" ? (
                    <FieldLabel label="Nhóm quản trị">
                      <select
                        className={inputClassName()}
                        value={selectedCoupon.managementGroup}
                        onChange={(event) => patchCoupon(selectedCoupon.id, { managementGroup: event.target.value })}
                      >
                        {listCouponManagementGroupsForVoucherType(selectedCoupon.voucherType).map((group) => (
                          <option key={group.value} value={group.value}>{group.label}</option>
                        ))}
                      </select>
                    </FieldLabel>
                  ) : null}

                  {selectedCoupon.voucherType === "loyalty" ? (
                    <FieldLabel label="Số ngày sử dụng sau khi nhận">
                      <input
                        className={inputClassName()}
                        type="number"
                        min="1"
                        max="60"
                        value={selectedCoupon.validDaysAfterGrant || 7}
                        onChange={(event) => patchCoupon(selectedCoupon.id, {
                          validDaysAfterGrant: normalizeValidDaysAfterGrant(event.target.value, 7),
                          endAt: "",
                          expiry: ""
                        })}
                      />
                    </FieldLabel>
                  ) : (
                    <FieldLabel label="Ngày hết hạn">
                      <input className={inputClassName()} type="date" value={selectedCoupon.endAt} onChange={(event) => patchCoupon(selectedCoupon.id, { endAt: event.target.value, expiry: event.target.value })} />
                    </FieldLabel>
                  )}

                  {selectedCoupon.managementGroup === "loyalty_crm" ? (
                    <FieldLabel label="Nhóm khách mục tiêu">
                      <select
                        className={inputClassName()}
                        value={selectedCoupon.campaignAudience || "all"}
                        onChange={(event) => patchCoupon(selectedCoupon.id, { campaignAudience: event.target.value })}
                      >
                        {VOUCHER_CAMPAIGN_AUDIENCES.map((audience) => (
                          <option key={audience.value} value={audience.value}>{audience.label}</option>
                        ))}
                      </select>
                    </FieldLabel>
                  ) : null}

                  {selectedCoupon.managementGroup === "loyalty_crm" ? (
                    <FieldLabel label="Nhãn chiến dịch">
                      <input
                        className={inputClassName()}
                        autoComplete="off"
                        value={selectedCoupon.campaignLabel || ""}
                        onChange={(event) => patchCoupon(selectedCoupon.id, { campaignLabel: event.target.value })}
                        placeholder="Ví dụ: Kéo lại khách 7 ngày"
                      />
                    </FieldLabel>
                  ) : null}

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
                title="Cơ bản: giảm bao nhiêu?"
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

              <details className="admin-promo-form-card">
                <summary className="admin-promo-details-summary">Nâng cao: giới hạn và thống kê sử dụng</summary>
                <div className="mt-4 space-y-4">
                  <p className="admin-promo-advanced-note">
                    Chỉ cần mở phần này khi anh muốn giới hạn tổng lượt dùng, giới hạn theo từng khách hoặc chỉnh dữ liệu đã dùng.
                  </p>
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
