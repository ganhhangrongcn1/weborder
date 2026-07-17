import { useRef, useState } from "react";

export const ADDRESS_FORM_ID = "checkout-delivery-address-form";

export function normalizePhoneInput(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits.slice(0, 10);
}

export function isCurrentAddress(address, draft) {
  const savedAddress = String(address?.address || "").trim().toLowerCase();
  const currentAddress = String(draft?.address || "").trim().toLowerCase();
  return Boolean(savedAddress && savedAddress === currentAddress);
}

function validateAddressDraft(draft = {}) {
  const errors = {};
  const name = String(draft.name || "").trim();
  const phone = normalizePhoneInput(draft.phone);
  const address = String(draft.address || "").trim();

  if (name.length < 2) errors.name = "Nhập tên người nhận món.";
  if (!/^0\d{9}$/.test(phone)) errors.phone = "Số điện thoại gồm 10 số và bắt đầu bằng 0.";
  if (address.length < 8 || !address.includes(" ")) {
    errors.address = "Nhập thêm số nhà, tên đường hoặc phường/xã.";
  }

  return errors;
}

export default function useAddressModalState({
  value,
  canSaveToAccount,
  onSelectAddress,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    address: "",
    placeId: "",
    lat: null,
    lng: null,
    distanceKm: null,
    durationText: "",
    saveToAccount: false,
    ...value
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const addressInputRef = useRef(null);

  function clearFieldError(field) {
    setFormErrors((current) => {
      if (!current[field] && !current.submit) return current;
      const next = { ...current };
      delete next[field];
      delete next.submit;
      return next;
    });
  }

  function updateField(field, nextValue) {
    clearFieldError(field);
    setDraft((current) => ({
      ...current,
      [field]: nextValue
    }));
  }

  function focusFirstError(errors) {
    const target = errors.name
      ? nameInputRef.current
      : errors.phone
        ? phoneInputRef.current
        : addressInputRef.current;
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const normalizedDraft = {
      ...draft,
      name: String(draft.name || "").trim(),
      phone: normalizePhoneInput(draft.phone),
      address: String(draft.address || "").trim(),
      saveToAccount: canSaveToAccount && Boolean(draft.saveToAccount)
    };
    const nextErrors = validateAddressDraft(normalizedDraft);

    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setIsSaving(true);
    setFormErrors({});
    try {
      await onSave(normalizedDraft);
    } catch (error) {
      console.warn("[checkout-address] save failed", error);
      setFormErrors({ submit: "Chưa cập nhật được địa chỉ. Bạn thử lại giúp Gánh nha." });
      setIsSaving(false);
    }
  }

  async function handleSelectSavedAddress(address) {
    if (isSaving) return;
    setIsSaving(true);
    setFormErrors({});
    try {
      await onSelectAddress(address);
      setIsSaving(false);
      onClose();
    } catch (error) {
      console.warn("[checkout-address] select saved address failed", error);
      setFormErrors({ submit: "Chưa dùng được địa chỉ này. Bạn thử lại giúp Gánh nha." });
      setIsSaving(false);
    }
  }

  return {
    draft,
    setDraft,
    formErrors,
    isSaving,
    nameInputRef,
    phoneInputRef,
    addressInputRef,
    clearFieldError,
    updateField,
    handleSubmit,
    handleSelectSavedAddress
  };
}
