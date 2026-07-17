import { useState } from "react";
import GoongAddressPicker from "../../../components/GoongAddressPicker.jsx";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import useAddressModalState, {
  ADDRESS_FORM_ID,
  isCurrentAddress,
  normalizePhoneInput
} from "../hooks/useAddressModalState.js";

export default function AddressModal({
  value,
  addresses = [],
  deliveryBranches = [],
  selectedDeliveryBranchId = "",
  onSelectDeliveryBranch,
  deliveryOrigin,
  shippingConfig,
  canSaveToAccount = false,
  onSelectAddress,
  onSave,
  onClose
}) {
  const [showSaved, setShowSaved] = useState(false);
  const {
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
  } = useAddressModalState({
    value,
    canSaveToAccount,
    onSelectAddress,
    onSave,
    onClose
  });
  const savedPreview = addresses[0];
  const selectedDeliveryBranch = deliveryBranches.find((branch) => branch.id === selectedDeliveryBranchId) || null;
  const hasMultipleDeliveryBranches = deliveryBranches.length > 1;

  return (
    <CustomerBottomSheet
      title="Thông tin giao hàng"
      subtitle="Cập nhật người nhận và địa chỉ giao món"
      ariaLabel="Thay đổi địa chỉ giao hàng"
      onClose={onClose}
      closeOnBackdrop={false}
      backdropClassName="checkout-address-sheet-backdrop"
      className="promo-sheet checkout-address-sheet"
      footer={(
        <CustomerButton
          full
          type="submit"
          form={ADDRESS_FORM_ID}
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? "Đang cập nhật…" : "Dùng địa chỉ này"}
        </CustomerButton>
      )}
    >
      <form
        id={ADDRESS_FORM_ID}
        className="checkout-address-form space-y-3"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isSaving}
      >
        {savedPreview ? (
          <section className="checkout-saved-addresses space-y-2" aria-labelledby="checkout-saved-addresses-title">
            <div className="flex items-center justify-between gap-3">
              <p id="checkout-saved-addresses-title" className="text-xs font-black uppercase text-brown/50">
                Địa chỉ đã lưu
              </p>
              {addresses.length > 1 ? (
                <CustomerButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaved((current) => !current)}
                  aria-expanded={showSaved}
                >
                  {showSaved ? "Thu gọn" : "Xem thêm địa chỉ"}
                </CustomerButton>
              ) : null}
            </div>
            {(showSaved ? addresses : [savedPreview]).map((address) => {
              const selected = isCurrentAddress(address, draft);
              return (
                <CustomerCard
                  as="button"
                  type="button"
                  key={address.id}
                  onClick={() => handleSelectSavedAddress(address)}
                  disabled={isSaving}
                  aria-pressed={selected}
                  padding="sm"
                  className={`checkout-saved-address-card text-left text-xs ${selected ? "is-selected" : ""}`.trim()}
                >
                  <span className="checkout-saved-address-card__copy">
                    <strong className="block text-brown">{address.label || "Địa chỉ giao hàng"}</strong>
                    <span className="mt-1 block text-brown/55">{address.address}</span>
                  </span>
                  {selected ? (
                    <span className="checkout-saved-address-card__status">
                      <Icon name="check" size={14} />
                      Đang dùng
                    </span>
                  ) : null}
                </CustomerCard>
              );
            })}
          </section>
        ) : null}

        <div className="checkout-address-contact-grid grid grid-cols-2 gap-2">
          <label className={`address-field ${formErrors.name ? "has-error" : ""}`.trim()}>
            <span>Tên người nhận</span>
            <input
              ref={nameInputRef}
              id="checkout-delivery-name"
              name="deliveryName"
              type="text"
              autoComplete="name"
              value={draft.name}
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={formErrors.name ? "checkout-delivery-name-error" : undefined}
              onChange={(event) => updateField("name", event.target.value)}
            />
            {formErrors.name ? (
              <small id="checkout-delivery-name-error" className="checkout-address-field-error" role="alert">
                {formErrors.name}
              </small>
            ) : null}
          </label>
          <label className={`address-field ${formErrors.phone ? "has-error" : ""}`.trim()}>
            <span>Số điện thoại</span>
            <input
              ref={phoneInputRef}
              id="checkout-delivery-phone"
              name="deliveryPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              aria-invalid={Boolean(formErrors.phone)}
              aria-describedby={formErrors.phone ? "checkout-delivery-phone-error" : undefined}
              onChange={(event) => updateField("phone", normalizePhoneInput(event.target.value))}
            />
            {formErrors.phone ? (
              <small id="checkout-delivery-phone-error" className="checkout-address-field-error" role="alert">
                {formErrors.phone}
              </small>
            ) : null}
          </label>
        </div>

        <GoongAddressPicker
          key={selectedDeliveryBranchId || "default-delivery-origin"}
          origin={deliveryOrigin}
          shippingConfig={shippingConfig}
          inputId="checkout-delivery-address"
          inputName="deliveryAddress"
          inputRef={addressInputRef}
          inputError={formErrors.address}
          value={{
            addressText: draft.address,
            placeId: draft.placeId,
            lat: draft.lat,
            lng: draft.lng,
            distanceKm: draft.distanceKm,
            durationText: draft.durationText
          }}
          onChange={(nextAddress) => {
            clearFieldError("address");
            setDraft((current) => ({
              ...current,
              address: nextAddress.addressText,
              placeId: nextAddress.placeId,
              lat: nextAddress.lat,
              lng: nextAddress.lng,
              distanceKm: nextAddress.distanceKm,
              durationText: nextAddress.durationText,
              deliveryFee: nextAddress.deliveryFee,
              shippingStatus: nextAddress.shippingStatus
            }));
          }}
        />

        {selectedDeliveryBranch ? (
          <section className="checkout-address-branch-card" aria-label="Chi nhánh giao hàng">
            <span className="checkout-address-branch-card__icon" aria-hidden="true">
              <Icon name="store" size={17} />
            </span>
            <div className="checkout-address-branch-card__copy">
              <span>Gánh giao từ</span>
              {hasMultipleDeliveryBranches ? (
                <label className="address-field checkout-address-branch-select">
                  <span className="sr-only">Chọn chi nhánh giao hàng</span>
                  <select
                    name="deliveryBranch"
                    value={selectedDeliveryBranchId}
                    onChange={(event) => onSelectDeliveryBranch?.(event.target.value)}
                  >
                    {deliveryBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <strong>{selectedDeliveryBranch.name}</strong>
              )}
              <small>{selectedDeliveryBranch.address}</small>
            </div>
          </section>
        ) : null}

        {canSaveToAccount ? (
          <CustomerCard as="label" padding="sm" className="checkout-address-save-toggle flex items-center justify-between">
            <span className="text-sm font-bold text-brown/70">Lưu địa chỉ này cho lần sau</span>
            <input
              type="checkbox"
              name="saveDeliveryAddress"
              checked={Boolean(draft.saveToAccount)}
              onChange={(event) => updateField("saveToAccount", event.target.checked)}
              className="toggle-input"
            />
          </CustomerCard>
        ) : null}

        {formErrors.submit ? (
          <p className="checkout-address-submit-error" role="alert">
            <Icon name="warning" size={16} />
            <span>{formErrors.submit}</span>
          </p>
        ) : null}
      </form>
    </CustomerBottomSheet>
  );
}
