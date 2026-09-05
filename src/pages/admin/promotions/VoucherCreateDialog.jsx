import { useMemo, useState } from "react";
import { adminFeatureFlags } from "../../../constants/featureFlags.js";
import { ALL_PROMOTION_SALES_CHANNELS, normalizeSalesChannels } from "../../../services/promotionChannelService.js";
import {
  COUPON_MANAGEMENT_GROUPS,
  getCouponManagementGroupDefinition
} from "../../../services/voucherManagementGroupService.js";
import { VOUCHER_CAMPAIGN_AUDIENCES } from "../../../services/voucherCampaignPresetService.js";
import { normalizeVoucherBranchUuids } from "../../../services/voucherBranchScopeService.js";
import VoucherBranchScopeField from "./VoucherBranchScopeField.jsx";
import PromotionSalesChannelField from "./PromotionSalesChannelField.jsx";

const CODE_PATTERN = /^[A-Z0-9_-]+$/;

function todayText() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function buildInitialDraft(initialValue = {}) {
  const requestedGroup = String(initialValue.managementGroup || "checkout_sales");
  const managementGroup = !adminFeatureFlags.showLoyaltyVoucherSettings && requestedGroup === "loyalty_auto"
    ? "checkout_sales"
    : requestedGroup;
  const group = getCouponManagementGroupDefinition(managementGroup);

  return {
    ...initialValue,
    code: String(initialValue.code || "").trim().toUpperCase(),
    name: String(initialValue.name || "").trim(),
    managementGroup,
    voucherType: group.voucherType,
    discountType: initialValue.discountType === "percent" ? "percent" : "fixed",
    value: Number(initialValue.value || 0),
    maxDiscount: Number(initialValue.maxDiscount || 0),
    minOrder: Number(initialValue.minOrder || 0),
    startAt: String(initialValue.startAt || todayText()),
    endAt: String(initialValue.endAt || initialValue.expiry || ""),
    validDaysAfterGrant: Number(initialValue.validDaysAfterGrant || 7),
    salesChannels: normalizeSalesChannels(initialValue.salesChannels, ALL_PROMOTION_SALES_CHANNELS),
    branchUuids: normalizeVoucherBranchUuids(initialValue.branchUuids || initialValue.branch_uuids),
    campaignAudience: String(initialValue.campaignAudience || "all"),
    campaignLabel: String(initialValue.campaignLabel || initialValue.name || ""),
    usageLimit: Number(initialValue.usageLimit || 0),
    perUserLimit: Math.max(1, Number(initialValue.perUserLimit || 1)),
    totalUsed: 0,
    active: initialValue.active !== false
  };
}

function validateDraft(draft, existingCodes) {
  const errors = {};
  const normalizedCode = String(draft.code || "").trim().toUpperCase();
  const isLoyalty = draft.voucherType === "loyalty";

  if (!normalizedCode) errors.code = "Nhập mã voucher.";
  else if (!CODE_PATTERN.test(normalizedCode)) errors.code = "Chỉ dùng chữ in hoa, số, dấu - hoặc _.";
  else if (existingCodes.has(normalizedCode)) errors.code = "Mã voucher này đã tồn tại.";

  if (!String(draft.name || "").trim()) errors.name = "Nhập tên hiển thị.";
  if (Number(draft.value || 0) <= 0) errors.value = "Giá trị giảm phải lớn hơn 0.";
  if (draft.discountType === "percent" && Number(draft.value || 0) > 100) {
    errors.value = "Mức giảm phần trăm không được vượt quá 100%.";
  }

  if (isLoyalty) {
    if (Number(draft.validDaysAfterGrant || 0) <= 0) errors.expiry = "Nhập số ngày sử dụng sau khi nhận.";
  } else {
    if (!draft.endAt) errors.expiry = "Chọn ngày kết thúc.";
    else if (draft.startAt && draft.endAt < draft.startAt) errors.expiry = "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  }

  if (!Array.isArray(draft.salesChannels) || draft.salesChannels.length === 0) {
    errors.salesChannels = "Chọn ít nhất một kênh áp dụng.";
  }

  return errors;
}

function Field({ label, error, children, className = "" }) {
  return (
    <label className={`admin-voucher-create-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}

export default function VoucherCreateDialog({
  initialValue,
  existingCodes = [],
  branches = [],
  onClose,
  onCreate
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(initialValue));
  const [submitted, setSubmitted] = useState(false);
  const existingCodeSet = useMemo(
    () => new Set(existingCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)),
    [existingCodes]
  );
  const errors = useMemo(() => validateDraft(draft, existingCodeSet), [draft, existingCodeSet]);
  const isLoyalty = draft.voucherType === "loyalty";

  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const handleGroupChange = (managementGroup) => {
    const group = getCouponManagementGroupDefinition(managementGroup);
    patchDraft({
      managementGroup,
      voucherType: group.voucherType,
      endAt: group.voucherType === "loyalty" ? "" : draft.endAt,
      validDaysAfterGrant: group.voucherType === "loyalty" ? Math.max(1, Number(draft.validDaysAfterGrant || 7)) : 0
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    onCreate({
      ...draft,
      code: String(draft.code || "").trim().toUpperCase(),
      name: String(draft.name || "").trim(),
      campaignLabel: String(draft.campaignLabel || draft.name || "").trim(),
      expiry: isLoyalty ? "" : draft.endAt
    });
  };

  return (
    <div className="admin-voucher-create-backdrop" role="presentation">
      <section className="admin-voucher-create-dialog" role="dialog" aria-modal="true" aria-labelledby="voucher-create-title">
        <header className="admin-voucher-create-head">
          <div>
            <h2 id="voucher-create-title">Tạo voucher mới</h2>
            <p>Voucher chỉ được thêm vào bản nháp, chưa áp dụng cho khách.</p>
          </div>
          <button type="button" className="admin-voucher-create-close" onClick={onClose} aria-label="Đóng form tạo voucher">×</button>
        </header>

        <form className="admin-voucher-create-form" onSubmit={handleSubmit} noValidate>
          <Field label="Nhóm voucher">
            <select
              className="admin-input"
              value={draft.managementGroup}
              onChange={(event) => handleGroupChange(event.target.value)}
            >
              {COUPON_MANAGEMENT_GROUPS
                .filter((group) => adminFeatureFlags.showLoyaltyVoucherSettings || group.value !== "loyalty_auto")
                .map((group) => (
                <option key={group.value} value={group.value}>{group.label}</option>
              ))}
            </select>
          </Field>

          <div className="admin-voucher-create-grid">
            <Field label="Mã voucher *" error={submitted ? errors.code : ""}>
              <input
                className="admin-input"
                autoFocus
                autoComplete="off"
                value={draft.code}
                placeholder="Ví dụ: SALE20"
                onChange={(event) => patchDraft({ code: String(event.target.value || "").toUpperCase().replace(/\s+/g, "") })}
              />
            </Field>

            <Field label="Tên hiển thị *" error={submitted ? errors.name : ""}>
              <input
                className="admin-input"
                autoComplete="off"
                value={draft.name}
                placeholder="Ví dụ: Giảm 20% đơn hàng"
                onChange={(event) => patchDraft({ name: event.target.value })}
              />
            </Field>

            <Field label="Loại giảm">
              <select
                className="admin-input"
                value={draft.discountType}
                onChange={(event) => patchDraft({
                  discountType: event.target.value,
                  maxDiscount: event.target.value === "percent" ? draft.maxDiscount : 0
                })}
              >
                <option value="fixed">Giảm số tiền</option>
                <option value="percent">Giảm theo %</option>
              </select>
            </Field>

            <Field label={`Giá trị giảm (${draft.discountType === "percent" ? "%" : "đ"}) *`} error={submitted ? errors.value : ""}>
              <input
                className="admin-input"
                type="number"
                min="0"
                value={draft.value}
                onChange={(event) => patchDraft({ value: Number(event.target.value || 0) })}
              />
            </Field>

            {draft.discountType === "percent" ? (
              <Field label="Giảm tối đa (đ)">
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={draft.maxDiscount}
                  onChange={(event) => patchDraft({ maxDiscount: Number(event.target.value || 0) })}
                />
              </Field>
            ) : null}

            <Field label="Đơn tối thiểu (đ)">
              <input
                className="admin-input"
                type="number"
                min="0"
                value={draft.minOrder}
                onChange={(event) => patchDraft({ minOrder: Number(event.target.value || 0) })}
              />
            </Field>

            {isLoyalty ? (
              <Field label="Số ngày dùng sau khi nhận *" error={submitted ? errors.expiry : ""}>
                <input
                  className="admin-input"
                  type="number"
                  min="1"
                  max="60"
                  value={draft.validDaysAfterGrant}
                  onChange={(event) => patchDraft({ validDaysAfterGrant: Number(event.target.value || 0) })}
                />
              </Field>
            ) : (
              <>
                <Field label="Ngày bắt đầu">
                  <input
                    className="admin-input"
                    type="date"
                    value={draft.startAt}
                    onChange={(event) => patchDraft({ startAt: event.target.value })}
                  />
                </Field>
                <Field label="Ngày kết thúc *" error={submitted ? errors.expiry : ""}>
                  <input
                    className="admin-input"
                    type="date"
                    value={draft.endAt}
                    onChange={(event) => patchDraft({ endAt: event.target.value })}
                  />
                </Field>
              </>
            )}

            {draft.managementGroup === "loyalty_crm" ? (
              <>
                <Field label="Nhóm khách mục tiêu">
                  <select
                    className="admin-input"
                    value={draft.campaignAudience}
                    onChange={(event) => patchDraft({ campaignAudience: event.target.value })}
                  >
                    {VOUCHER_CAMPAIGN_AUDIENCES.map((audience) => (
                      <option key={audience.value} value={audience.value}>{audience.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nhãn chiến dịch">
                  <input
                    className="admin-input"
                    value={draft.campaignLabel}
                    placeholder="Ví dụ: Kéo lại khách 15 ngày"
                    onChange={(event) => patchDraft({ campaignLabel: event.target.value })}
                  />
                </Field>
              </>
            ) : null}
          </div>

          <div className="admin-voucher-create-channels">
            <span>Kênh áp dụng *</span>
            <PromotionSalesChannelField
              value={draft.salesChannels}
              onChange={(salesChannels) => patchDraft({ salesChannels })}
            />
            {submitted && errors.salesChannels ? <small role="alert">{errors.salesChannels}</small> : null}
          </div>

          <div className="admin-voucher-create-branches">
            <span>Áp dụng chi nhánh</span>
            <VoucherBranchScopeField
              branches={branches}
              value={draft.branchUuids}
              onChange={(branchUuids) => patchDraft({ branchUuids })}
            />
          </div>

          <details className="admin-voucher-create-advanced">
            <summary>Thiết lập nâng cao</summary>
            <div className="admin-voucher-create-grid">
              <Field label="Giới hạn dùng toàn bộ">
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={draft.usageLimit}
                  onChange={(event) => patchDraft({ usageLimit: Number(event.target.value || 0) })}
                />
              </Field>
              <Field label="Tối đa mỗi khách">
                <input
                  className="admin-input"
                  type="number"
                  min="1"
                  value={draft.perUserLimit}
                  onChange={(event) => patchDraft({ perUserLimit: Math.max(1, Number(event.target.value || 1)) })}
                />
              </Field>
            </div>
          </details>

          <footer className="admin-voucher-create-actions">
            <span>Chưa có thay đổi nào được áp dụng cho khách.</span>
            <div>
              <button type="button" className="admin-secondary" onClick={onClose}>Hủy</button>
              <button type="submit" className="admin-cta">Thêm vào bản nháp</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
