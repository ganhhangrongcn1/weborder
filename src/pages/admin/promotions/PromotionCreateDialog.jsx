import { useMemo, useState } from "react";
import { promoDefaults } from "./promotionConfig.js";
import PromotionSalesChannelField from "./PromotionSalesChannelField.jsx";

const PROMOTION_TYPES = [
  { value: "strike_price", label: "Giảm giá món" },
  { value: "flash_sale", label: "Flash sale" },
  { value: "gift_threshold", label: "Tặng món" },
  { value: "free_shipping", label: "Hỗ trợ ship" }
];

function localDateText(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateText(date);
}

function buildDraft(type = "strike_price", preserved = {}) {
  const safeType = promoDefaults[type] ? type : "strike_price";
  const defaults = promoDefaults[safeType];
  const startAt = preserved.startAt || localDateText();

  return {
    type: safeType,
    title: defaults.title || defaults.name || "",
    name: defaults.name || defaults.title || "",
    text: defaults.text || "",
    active: false,
    startAt,
    endAt: preserved.endAt || addDays(startAt, 30),
    salesChannels: [...(defaults.salesChannels || [])],
    condition: { ...(defaults.condition || {}) },
    reward: { ...(defaults.reward || {}) }
  };
}

function validateDraft(draft) {
  const errors = {};
  const isDiscount = draft.type === "strike_price" || draft.type === "flash_sale";

  if (!String(draft.title || "").trim()) errors.title = "Nhập tên chương trình.";
  if (!draft.startAt) errors.startAt = "Chọn ngày bắt đầu.";
  if (!draft.endAt) errors.endAt = "Chọn ngày kết thúc.";
  else if (draft.startAt && draft.endAt < draft.startAt) errors.endAt = "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  if (!Array.isArray(draft.salesChannels) || draft.salesChannels.length === 0) errors.salesChannels = "Chọn ít nhất một kênh áp dụng.";

  if (isDiscount) {
    const rewardValue = Number(draft.reward?.value || 0);
    if (rewardValue <= 0) errors.rewardValue = "Giá trị ưu đãi phải lớn hơn 0.";
    if (draft.reward?.type === "percent_discount" && rewardValue > 100) errors.rewardValue = "Mức giảm không được vượt quá 100%.";
  }
  if (draft.type === "gift_threshold" && !draft.reward?.productId) errors.productId = "Chọn món tặng.";
  if ((draft.type === "gift_threshold" || draft.type === "free_shipping") && Number(draft.condition?.minSubtotal || 0) <= 0) {
    errors.minSubtotal = "Mốc đơn phải lớn hơn 0.";
  }
  if (draft.type === "flash_sale" && Number(draft.condition?.totalSlots || 0) <= 0) errors.totalSlots = "Số suất phải lớn hơn 0.";

  return errors;
}

function Field({ label, error = "", className = "", children }) {
  return (
    <label className={`admin-voucher-create-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}

export default function PromotionCreateDialog({
  initialType = "strike_price",
  activeProducts = [],
  onClose,
  onCreate
}) {
  const [draft, setDraft] = useState(() => buildDraft(initialType));
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const isDiscount = draft.type === "strike_price" || draft.type === "flash_sale";

  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const patchCondition = (patch) => setDraft((current) => ({
    ...current,
    condition: { ...current.condition, ...patch }
  }));
  const patchReward = (patch) => setDraft((current) => ({
    ...current,
    reward: { ...current.reward, ...patch }
  }));

  const handleTypeChange = (type) => {
    setSubmitted(false);
    setDraft(buildDraft(type, { startAt: draft.startAt, endAt: draft.endAt }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    onCreate({
      ...draft,
      title: String(draft.title || "").trim(),
      name: String(draft.name || draft.title || "").trim(),
      salesChannels: draft.type === "free_shipping" ? ["web"] : draft.salesChannels
    });
  };

  return (
    <div className="admin-voucher-create-backdrop" role="presentation">
      <section className="admin-voucher-create-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-create-title">
        <header className="admin-voucher-create-head">
          <div>
            <h2 id="promotion-create-title">Tạo chương trình mới</h2>
            <p>Chỉ nhập thông tin cần thiết. Các thiết lập chi tiết chỉnh tiếp ở cột bên phải.</p>
          </div>
          <button type="button" className="admin-voucher-create-close" onClick={onClose} aria-label="Đóng form tạo chương trình">×</button>
        </header>

        <form className="admin-voucher-create-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-voucher-create-grid">
            <Field label="Loại chương trình">
              <select className="admin-input" value={draft.type} onChange={(event) => handleTypeChange(event.target.value)}>
                {PROMOTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Tên chương trình *" error={submitted ? errors.title : ""}>
              <input
                className="admin-input"
                autoFocus
                autoComplete="off"
                value={draft.title}
                onChange={(event) => patchDraft({ title: event.target.value, name: event.target.value })}
              />
            </Field>

            {isDiscount ? (
              <>
                <Field label="Kiểu giảm">
                  <select className="admin-input" value={draft.reward.type} onChange={(event) => patchReward({ type: event.target.value })}>
                    <option value="percent_discount">Giảm theo %</option>
                    <option value="fixed_discount">Giảm số tiền</option>
                    <option value="fixed_price">Đồng giá</option>
                  </select>
                </Field>
                <Field label={draft.reward.type === "fixed_price" ? "Giá bán mới *" : "Giá trị giảm *"} error={submitted ? errors.rewardValue : ""}>
                  <input className="admin-input" type="number" min="0" value={Number(draft.reward.value || 0)} onChange={(event) => patchReward({ value: Number(event.target.value || 0) })} />
                </Field>
              </>
            ) : null}

            {draft.type === "flash_sale" ? (
              <Field label="Tổng số suất *" error={submitted ? errors.totalSlots : ""}>
                <input className="admin-input" type="number" min="1" value={Number(draft.condition.totalSlots || 0)} onChange={(event) => patchCondition({ totalSlots: Number(event.target.value || 0) })} />
              </Field>
            ) : null}

            {draft.type === "gift_threshold" ? (
              <>
                <Field label="Mốc đơn tối thiểu *" error={submitted ? errors.minSubtotal : ""}>
                  <input className="admin-input" type="number" min="0" value={Number(draft.condition.minSubtotal || 0)} onChange={(event) => patchCondition({ minSubtotal: Number(event.target.value || 0) })} />
                </Field>
                <Field label="Món tặng *" error={submitted ? errors.productId : ""}>
                  <select className="admin-input" value={draft.reward.productId || ""} onChange={(event) => patchReward({ productId: event.target.value, value: event.target.value })}>
                    <option value="">Chọn món tặng</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}

            {draft.type === "free_shipping" ? (
              <>
                <Field label="Mốc đơn tối thiểu *" error={submitted ? errors.minSubtotal : ""}>
                  <input className="admin-input" type="number" min="0" value={Number(draft.condition.minSubtotal || 0)} onChange={(event) => patchCondition({ minSubtotal: Number(event.target.value || 0) })} />
                </Field>
                <Field label="Hỗ trợ tối đa (0 = toàn bộ)">
                  <input className="admin-input" type="number" min="0" value={Number(draft.condition.maxSupportShipFee || 0)} onChange={(event) => patchCondition({ maxSupportShipFee: Number(event.target.value || 0) })} />
                </Field>
              </>
            ) : null}

            <Field label="Ngày bắt đầu *" error={submitted ? errors.startAt : ""}>
              <input className="admin-input" type="date" value={draft.startAt} onChange={(event) => patchDraft({ startAt: event.target.value })} />
            </Field>
            <Field label="Ngày kết thúc *" error={submitted ? errors.endAt : ""}>
              <input className="admin-input" type="date" value={draft.endAt} onChange={(event) => patchDraft({ endAt: event.target.value })} />
            </Field>
          </div>

          <div className="admin-voucher-create-channels">
            <span>Kênh áp dụng *</span>
            {draft.type === "free_shipping" ? (
              <p className="admin-promo-create-fixed-channel">Chỉ áp dụng trên Website · Không áp dụng tại POS.</p>
            ) : (
              <PromotionSalesChannelField type={draft.type} value={draft.salesChannels} onChange={(salesChannels) => patchDraft({ salesChannels })} />
            )}
            {submitted && errors.salesChannels ? <small role="alert">{errors.salesChannels}</small> : null}
          </div>

          <div className="admin-promo-create-status-row">
            <div>
              <strong>Bật chương trình sau khi lưu</strong>
              <span>Tắt mặc định để anh kiểm tra lại setting trước khi áp dụng.</span>
            </div>
            <label className="admin-switch">
              <input type="checkbox" checked={Boolean(draft.active)} onChange={(event) => patchDraft({ active: event.target.checked })} />
              <span />
            </label>
          </div>

          <footer className="admin-voucher-create-actions">
            <span>Chương trình mới chỉ được thêm vào bản nháp.</span>
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
