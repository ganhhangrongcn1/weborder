import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";

const STEPS = [
  { id: 1, label: "Mục tiêu & khách" },
  { id: 2, label: "Voucher" },
  { id: 3, label: "Kiểm tra & lịch" }
];

function getVoucherValue(voucher = {}) {
  if (voucher.discountType === "percent" || voucher.type === "percent") {
    return `Giảm ${Number(voucher.discountValue || voucher.value || 0).toLocaleString("vi-VN")}%`;
  }
  return `Giảm ${formatMoney(Number(voucher.discountValue || voucher.value || 0))}`;
}

function toLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeDateTimeInput(value = "") {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 16) : toLocalDateTimeValue(date);
}

function getEditedStatus(initialCampaign, plannedAt) {
  if (["paused", "completed"].includes(initialCampaign?.status)) return initialCampaign.status;
  return plannedAt ? "scheduled" : "draft";
}

export default function CampaignCreateDialog({
  presets = [],
  vouchers = [],
  branchOptions = [],
  initialPresetId = "",
  initialCampaign = null,
  onClose,
  onCreate
}) {
  const isEditing = Boolean(initialCampaign?.id);
  const initialPreset = presets.find((preset) => preset.id === (initialCampaign?.objective || initialPresetId)) || presets[0] || null;
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: initialCampaign?.name || initialPreset?.label || "",
    description: initialCampaign?.description || initialPreset?.description || "",
    presetId: initialCampaign?.objective || initialPreset?.id || "",
    branchScope: initialCampaign?.branchScope || "all",
    voucherId: String(initialCampaign?.voucherId || initialCampaign?.voucherCode || ""),
    plannedAt: normalizeDateTimeInput(initialCampaign?.plannedAt),
    expiresAt: String(initialCampaign?.expiresAt || "").slice(0, 10)
  }));

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === draft.presetId) || null,
    [draft.presetId, presets]
  );
  const selectedVoucher = useMemo(
    () => vouchers.find((voucher) => String(voucher.id || voucher.code) === draft.voucherId) || null,
    [draft.voucherId, vouchers]
  );

  const patchDraft = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  };

  const selectPreset = (preset) => {
    patchDraft({
      presetId: preset.id,
      name: draft.name || preset.label,
      description: draft.description || preset.description
    });
  };

  const goNext = () => {
    if (step === 1 && (!draft.name.trim() || !selectedPreset)) {
      setError("Anh nhập tên và chọn một nhóm khách trước khi tiếp tục.");
      return;
    }
    if (step === 2 && !selectedVoucher) {
      setError("Anh chọn voucher sẽ dùng cho chiến dịch.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
    setError("");
  };

  const handleCreate = async () => {
    if (!selectedPreset || !selectedVoucher || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await onCreate({
        ...initialCampaign,
        id: initialCampaign?.id || `crm-campaign-${Date.now()}`,
        name: draft.name.trim(),
        description: draft.description.trim(),
        objective: selectedPreset.id,
        filterValue: selectedPreset.filterValue,
        audience: selectedPreset.audience,
        tone: selectedPreset.tone,
        branchScope: draft.branchScope,
        voucherId: String(selectedVoucher.id || selectedVoucher.code || ""),
        voucherCode: String(selectedVoucher.code || ""),
        voucherName: String(selectedVoucher.name || "Voucher CRM"),
        plannedAt: draft.plannedAt,
        expiresAt: draft.expiresAt,
        status: getEditedStatus(initialCampaign, draft.plannedAt)
      });
    } catch (saveError) {
      console.error("[crm-campaign] save failed", saveError);
      setError("Chưa lưu được chiến dịch. Anh kiểm tra kết nối Supabase rồi thử lại.");
      setIsSaving(false);
    }
  };

  return (
    <div className="crm-campaign-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="crm-campaign-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Chỉnh sửa chiến dịch voucher" : "Tạo chiến dịch voucher"}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="crm-campaign-dialog__head">
          <div>
            <span>Chiến dịch voucher</span>
            <h3>{isEditing ? "Xem và chỉnh sửa" : "Tạo chiến dịch mới"}</h3>
            <p>{isEditing
              ? "Các số liệu đã chạy được giữ nguyên. Thay đổi chỉ áp dụng sau khi anh bấm lưu."
              : "Lưu thành bản nháp trước, chỉ tặng voucher sau khi anh kiểm tra và xác nhận."}</p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </header>

        <nav className="crm-campaign-stepper" aria-label="Các bước tạo chiến dịch">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={step === item.id ? "is-active" : step > item.id ? "is-done" : ""}
              onClick={() => item.id < step && setStep(item.id)}
            >
              <b>{step > item.id ? "✓" : item.id}</b>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="crm-campaign-dialog__body">
          {step === 1 ? (
            <div className="crm-campaign-form-flow">
              <div className="crm-campaign-field-grid">
                <label>
                  Tên chiến dịch
                  <input
                    value={draft.name}
                    placeholder="Ví dụ: Kéo khách quay lại tuần này"
                    onChange={(event) => patchDraft({ name: event.target.value })}
                  />
                </label>
                <label>
                  Chi nhánh áp dụng
                  <select value={draft.branchScope} onChange={(event) => patchDraft({ branchScope: event.target.value })}>
                    <option value="all">Tất cả chi nhánh</option>
                    {draft.branchScope !== "all" && !branchOptions.includes(draft.branchScope) ? (
                      <option value={draft.branchScope}>{draft.branchScope}</option>
                    ) : null}
                    {branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Mô tả nội bộ
                <textarea
                  rows="2"
                  value={draft.description}
                  placeholder="Mục tiêu và ghi chú để theo dõi chiến dịch"
                  onChange={(event) => patchDraft({ description: event.target.value })}
                />
              </label>
              <div>
                <strong className="crm-campaign-form-title">Chọn mục tiêu và nhóm khách</strong>
                <div className="crm-campaign-template-grid">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={draft.presetId === preset.id ? "is-active" : ""}
                      onClick={() => selectPreset(preset)}
                    >
                      <span>{preset.label}</span>
                      <small>{preset.description}</small>
                      <b>{Number(preset.count || 0).toLocaleString("vi-VN")} khách phù hợp</b>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="crm-campaign-form-flow">
              <div className="crm-campaign-inline-note">
                <Icon name="gift" size={20} />
                <div>
                  <strong>Chỉ dùng voucher CRM đang bật</strong>
                  <span>Voucher loyalty tự động không xuất hiện để tránh tặng nhầm.</span>
                </div>
              </div>
              <div className="crm-campaign-voucher-list">
                {vouchers.map((voucher) => {
                  const voucherId = String(voucher.id || voucher.code || "");
                  return (
                    <button
                      key={voucherId}
                      type="button"
                      className={draft.voucherId === voucherId ? "is-active" : ""}
                      onClick={() => patchDraft({ voucherId })}
                    >
                      <span>
                        <strong>{voucher.code || "VOUCHER"}</strong>
                        <small>{voucher.name || "Voucher CRM"}</small>
                      </span>
                      <b>{getVoucherValue(voucher)}</b>
                    </button>
                  );
                })}
                {!vouchers.length ? (
                  <div className="crm-campaign-form-empty">
                    Chưa có voucher CRM đang bật. Anh tạo voucher trong Kho voucher trước nhé.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="crm-campaign-form-flow">
              <div className="crm-campaign-review">
                <article><span>Chiến dịch</span><strong>{draft.name}</strong></article>
                <article><span>Nhóm khách</span><strong>{selectedPreset?.label || "--"}</strong><small>{Number(selectedPreset?.count || 0).toLocaleString("vi-VN")} khách hiện tại</small></article>
                <article><span>Voucher</span><strong>{selectedVoucher?.code || "--"}</strong><small>{selectedVoucher?.name || "Voucher CRM"}</small></article>
                <article><span>Chi nhánh</span><strong>{draft.branchScope === "all" ? "Tất cả chi nhánh" : draft.branchScope}</strong></article>
              </div>
              <div className="crm-campaign-field-grid">
                <label>
                  Thời gian dự kiến chạy
                  <input
                    type="datetime-local"
                    min={toLocalDateTimeValue()}
                    value={draft.plannedAt}
                    onChange={(event) => patchDraft({ plannedAt: event.target.value })}
                  />
                  <small>Đây là lịch nhắc. Giai đoạn 1 chưa tự động tặng voucher.</small>
                </label>
                <label>
                  Hạn theo dõi chiến dịch
                  <input type="date" value={draft.expiresAt} onChange={(event) => patchDraft({ expiresAt: event.target.value })} />
                  <small>Có thể để trống nếu chưa xác định ngày kết thúc.</small>
                </label>
              </div>
              <div className="crm-campaign-inline-note crm-campaign-inline-note--safe">
                <Icon name="check" size={20} />
                <div>
                  <strong>{isEditing ? "Chưa gửi gì khi chỉnh sửa" : "Chưa gửi gì khi tạo"}</strong>
                  <span>Thay đổi chỉ được lưu. Anh vẫn phải bấm “Chuẩn bị gửi” và xác nhận voucher.</span>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="crm-campaign-form-error" role="alert">{error}</p> : null}
        </div>

        <footer className="crm-campaign-dialog__footer">
          <button type="button" className="is-secondary" onClick={step === 1 ? onClose : () => setStep((current) => current - 1)}>
            {step === 1 ? "Hủy" : "Quay lại"}
          </button>
          {step < 3 ? (
            <button type="button" className="is-primary" onClick={goNext}>Tiếp theo</button>
          ) : (
            <button type="button" className="is-primary" disabled={isSaving} onClick={handleCreate}>
              {isSaving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Lưu chiến dịch"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
