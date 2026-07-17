import { useRef, useState } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { normalizeCustomerAddressForEditing } from "../../../utils/customerAddress.js";

const ADDRESS_FORM_ID = "account-address-form";

function validateAddress(draft) {
  const phoneDigits = String(draft.phone || "").replace(/\D/g, "");

  return {
    label: !String(draft.label || "").trim() ? "Vui lòng nhập nhãn địa chỉ." : "",
    receiverName: !String(draft.receiverName || "").trim() ? "Vui lòng nhập tên người nhận." : "",
    phone: phoneDigits.length < 9 || phoneDigits.length > 11
      ? "Vui lòng nhập số điện thoại hợp lệ."
      : "",
    address: !String(draft.address || "").trim() ? "Vui lòng nhập địa chỉ giao hàng." : ""
  };
}

function AddressField({
  id,
  label,
  error = "",
  children
}) {
  const errorId = `${id}-error`;

  return (
    <label className="address-field" htmlFor={id}>
      <span>{label}</span>
      {children}
      {error ? <small id={errorId} className="account-field-error" role="alert">{error}</small> : null}
    </label>
  );
}

export default function AccountAddressModal({
  address,
  fallbackReceiverName = "",
  onSave,
  onClose
}) {
  const normalizedAddress = normalizeCustomerAddressForEditing(address || {}, fallbackReceiverName);
  const [draft, setDraft] = useState({
    phone: "",
    address: "",
    note: "",
    isDefault: false,
    ...normalizedAddress,
    label: address?.label ? normalizedAddress.label : "Giao gần nhất",
    receiverName: normalizedAddress.receiverName || fallbackReceiverName
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const fieldRefs = useRef({});

  const update = (field, value) => {
    setErrors((current) => current[field] ? { ...current, [field]: "" } : current);
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateAddress(draft);
    const firstInvalidField = Object.keys(nextErrors).find((field) => nextErrors[field]);
    if (firstInvalidField) {
      setErrors(nextErrors);
      fieldRefs.current[firstInvalidField]?.focus();
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await Promise.resolve(onSave({
        ...draft,
        label: String(draft.label || "").trim(),
        receiverName: String(draft.receiverName || "").trim(),
        phone: String(draft.phone || "").trim(),
        address: String(draft.address || "").trim(),
        note: String(draft.note || "").trim()
      }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <CustomerBottomSheet
      title={draft.id ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
      subtitle="Địa chỉ sẽ được dùng để tự điền ở trang thanh toán."
      ariaLabel="Quản lý địa chỉ"
      onClose={onClose}
      className="promo-sheet"
      footer={(
        <CustomerButton
          full
          type="submit"
          form={ADDRESS_FORM_ID}
          disabled={isSaving}
          aria-busy={isSaving ? "true" : undefined}
        >
          {isSaving ? "Đang lưu…" : "Lưu địa chỉ"}
        </CustomerButton>
      )}
    >
      <form id={ADDRESS_FORM_ID} className="space-y-3" noValidate onSubmit={handleSubmit}>
        <AddressField id="account-address-label" label="Nhãn địa chỉ" error={errors.label}>
          <input
            ref={(node) => { fieldRefs.current.label = node; }}
            id="account-address-label"
            name="address-label"
            autoComplete="off"
            required
            value={draft.label}
            aria-invalid={errors.label ? "true" : undefined}
            aria-describedby={errors.label ? "account-address-label-error" : undefined}
            onChange={(event) => update("label", event.target.value)}
          />
        </AddressField>
        <AddressField id="account-address-receiver" label="Tên người nhận" error={errors.receiverName}>
          <input
            ref={(node) => { fieldRefs.current.receiverName = node; }}
            id="account-address-receiver"
            name="name"
            autoComplete="name"
            required
            value={draft.receiverName}
            aria-invalid={errors.receiverName ? "true" : undefined}
            aria-describedby={errors.receiverName ? "account-address-receiver-error" : undefined}
            onChange={(event) => update("receiverName", event.target.value)}
          />
        </AddressField>
        <AddressField id="account-address-phone" label="Số điện thoại" error={errors.phone}>
          <input
            ref={(node) => { fieldRefs.current.phone = node; }}
            id="account-address-phone"
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            spellCheck={false}
            required
            value={draft.phone}
            aria-invalid={errors.phone ? "true" : undefined}
            aria-describedby={errors.phone ? "account-address-phone-error" : undefined}
            onChange={(event) => update("phone", event.target.value)}
          />
        </AddressField>
        <AddressField id="account-address-street" label="Địa chỉ" error={errors.address}>
          <textarea
            ref={(node) => { fieldRefs.current.address = node; }}
            id="account-address-street"
            name="street-address"
            rows="3"
            autoComplete="street-address"
            required
            value={draft.address}
            aria-invalid={errors.address ? "true" : undefined}
            aria-describedby={errors.address ? "account-address-street-error" : undefined}
            onChange={(event) => update("address", event.target.value)}
          />
        </AddressField>
        <AddressField id="account-address-note" label="Ghi chú">
          <input
            id="account-address-note"
            name="address-note"
            autoComplete="off"
            value={draft.note}
            onChange={(event) => update("note", event.target.value)}
          />
        </AddressField>
        <CustomerCard as="label" padding="sm" className="flex items-center justify-between">
          <span className="text-sm font-bold text-brown/70">Đặt làm địa chỉ mặc định</span>
          <input
            type="checkbox"
            name="is-default-address"
            checked={Boolean(draft.isDefault)}
            onChange={(event) => update("isDefault", event.target.checked)}
            className="toggle-input"
          />
        </CustomerCard>
      </form>
    </CustomerBottomSheet>
  );
}
