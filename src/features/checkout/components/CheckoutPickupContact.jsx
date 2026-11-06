export default function CheckoutPickupContact({ pickupContact, setPickupContact, fieldErrors = {}, onClearFieldError }) {
  return (
    <div className="checkout-pickup-contact-grid">
      <label className="pickup-field">
        <span>Tên người nhận</span>
        <input id="checkout-pickup-name" type="text" name="pickupName" autoComplete="name" value={pickupContact.name} aria-invalid={Boolean(fieldErrors.pickupName)} aria-describedby={fieldErrors.pickupName ? "checkout-pickup-name-error" : undefined} placeholder="Tên của bạn" onChange={(event) => { onClearFieldError?.("pickupName"); setPickupContact((current) => ({ ...current, name: event.target.value })); }} />
        {fieldErrors.pickupName && <small id="checkout-pickup-name-error" className="checkout-field-error" role="alert">{fieldErrors.pickupName}</small>}
      </label>
      <label className="pickup-field">
        <span>Số điện thoại</span>
        <input id="checkout-pickup-phone" type="tel" name="pickupPhone" autoComplete="tel" inputMode="tel" value={pickupContact.phone} aria-invalid={Boolean(fieldErrors.pickupPhone)} aria-describedby={fieldErrors.pickupPhone ? "checkout-pickup-phone-error" : undefined} placeholder="Số điện thoại" onChange={(event) => { onClearFieldError?.("pickupPhone"); setPickupContact((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") })); }} />
        {fieldErrors.pickupPhone && <small id="checkout-pickup-phone-error" className="checkout-field-error" role="alert">{fieldErrors.pickupPhone}</small>}
      </label>
    </div>
  );
}
