import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import CheckoutFulfillmentTabs from "./CheckoutFulfillmentTabs.jsx";
import CheckoutPickupContact from "./CheckoutPickupContact.jsx";
import CustomerSelectionIndicator from "../../../components/customer/CustomerSelectionIndicator.jsx";

export default function CheckoutFulfillmentSection({
  fulfillmentType, setFulfillmentType, forcePickupOnly = false, isQrCounterOrder = false,
  deliveryAvailable = true, onUnavailableDelivery, showTabs = true,
  hidePickupSchedule = false, lockPickupBranch = false, setIsAddressModalOpen,
  deliveryInfo, deliverySourceBranch, pickupContact, setPickupContact,
  selectedBranchInfo, isChangingBranch, pickupBranches, selectedBranch,
  setSelectedBranch, setIsChangingBranch, pickupMode, setPickupMode,
  pickupDate, setPickupDate, pickupClock, setPickupClock,
  pickupDateLimit = "", pickupTimeMin = "", pickupTimeMax = "",
  fieldErrors = {}, onClearFieldError
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const hasScheduleError = Boolean(fieldErrors.pickupDate || fieldErrors.pickupTime);
  const branchChoices = isChangingBranch || !selectedBranchInfo ? pickupBranches : [selectedBranchInfo];
  return (
    <>
      {showTabs && <CheckoutFulfillmentTabs {...{ fulfillmentType, setFulfillmentType, forcePickupOnly, isQrCounterOrder, deliveryAvailable, onUnavailableDelivery, onClearFieldError }} />}
      {fulfillmentType === "delivery" ? (
        <CheckoutCard title="Giao tới" action={deliveryInfo.address ? "Đổi" : "Thêm địa chỉ"} onAction={() => setIsAddressModalOpen(true)} className={`checkout-delivery-card ${fieldErrors.delivery ? "checkout-card--error" : ""}`}>
          <CustomerControl type="button" className="checkout-address-summary" onClick={() => setIsAddressModalOpen(true)}>
            <Icon name="home" size={19} />
            <span><strong>{[deliveryInfo.name, deliveryInfo.phone].filter(Boolean).join(" · ") || "Chọn thông tin người nhận"}</strong><small>{deliveryInfo.address || "Thêm địa chỉ để tính phí giao hàng"}</small></span>
            <Icon name="back" size={15} />
          </CustomerControl>
          {deliverySourceBranch?.name && <p className="checkout-source-summary">Giao từ {deliverySourceBranch.name}</p>}
          {fieldErrors.delivery && <p id="checkout-delivery-error" className="checkout-field-error" role="alert" tabIndex="-1"><Icon name="warning" size={15} /><span>{fieldErrors.delivery}</span></p>}
        </CheckoutCard>
      ) : (
        <CheckoutCard title="Thông tin nhận món" className="checkout-pickup-card">
          <CheckoutPickupContact {...{ pickupContact, setPickupContact, fieldErrors, onClearFieldError }} />
          {!lockPickupBranch && (
            <section className="checkout-pickup-branch" aria-label="Chi nhánh lấy món">
              <div className="checkout-pickup-branch__heading"><span><Icon name="store" size={18} /></span><div><h3>Chi nhánh lấy món</h3><small>Chọn nơi thuận tiện để đến nhận</small></div></div>
              <div className="checkout-pickup-branch__options">
                {branchChoices.map((branch) => (
                  <CustomerControl type="button" key={branch.id} className={`branch-card ${selectedBranch === branch.id ? "branch-card-active" : ""}`} aria-pressed={selectedBranch === branch.id} onClick={() => {
                    if (selectedBranchInfo && !isChangingBranch) { setIsChangingBranch(true); return; }
                    onClearFieldError?.(); setSelectedBranch(branch.id); setIsChangingBranch(false);
                  }}>
                    <span className="checkout-pickup-branch__icon"><Icon name="store" size={18} /></span>
                    <span className="checkout-pickup-branch__copy"><strong>{branch.name}</strong><small>{branch.address}</small><em>{branch.time}</em></span>
                    <CustomerSelectionIndicator selected={selectedBranch === branch.id} className="branch-radio" />
                  </CustomerControl>
                ))}
              </div>
              {selectedBranchInfo && <CustomerControl type="button" className="checkout-pickup-branch__change" onClick={() => setIsChangingBranch(!isChangingBranch)}>{isChangingBranch ? "Đóng danh sách chi nhánh" : "Đổi chi nhánh lấy món"}</CustomerControl>}
            </section>
          )}
          {!hidePickupSchedule && (
            <details className="checkout-inline-disclosure" open={scheduleOpen || hasScheduleError} onToggle={(event) => { if (!hasScheduleError) setScheduleOpen(event.currentTarget.open); }}>
              <summary><Icon name="clock" size={18} /><span><small>Thời gian nhận</small><strong>{pickupMode === "soon" ? "Sớm nhất · Khoảng 20 phút" : `Hôm nay · ${pickupClock}`}</strong></span><em>Đổi</em></summary>
              <div className="checkout-inline-disclosure__body">
                <div className="pickup-mode-tabs">
                  <CustomerControl type="button" aria-pressed={pickupMode === "soon"} className={pickupMode === "soon" ? "active" : ""} onClick={() => { onClearFieldError?.("pickupDate"); onClearFieldError?.("pickupTime"); setPickupMode("soon"); }}>Sớm nhất</CustomerControl>
                  <CustomerControl type="button" aria-pressed={pickupMode === "schedule"} className={pickupMode === "schedule" ? "active" : ""} onClick={() => setPickupMode("schedule")}>Hẹn giờ</CustomerControl>
                </div>
                {pickupMode === "schedule" ? (
                  <div className="checkout-schedule-fields">
                    <label className="pickup-field"><span>Ngày lấy</span><input id="checkout-pickup-date" name="pickupDate" type="date" min={pickupDateLimit || undefined} max={pickupDateLimit || undefined} value={pickupDate} aria-invalid={Boolean(fieldErrors.pickupDate)} aria-describedby={fieldErrors.pickupDate ? "checkout-pickup-date-error" : undefined} onChange={(event) => { onClearFieldError?.("pickupDate"); setPickupDate(event.target.value); }} />{fieldErrors.pickupDate && <small id="checkout-pickup-date-error" className="checkout-field-error" role="alert">{fieldErrors.pickupDate}</small>}</label>
                    <label className="pickup-field"><span>Giờ lấy</span><input id="checkout-pickup-time" name="pickupTime" type="time" min={pickupTimeMin || undefined} max={pickupTimeMax || undefined} value={pickupClock} aria-invalid={Boolean(fieldErrors.pickupTime)} aria-describedby={fieldErrors.pickupTime ? "checkout-pickup-time-error" : undefined} onChange={(event) => { onClearFieldError?.("pickupTime"); setPickupClock(event.target.value); }} />{fieldErrors.pickupTime && <small id="checkout-pickup-time-error" className="checkout-field-error" role="alert">{fieldErrors.pickupTime}</small>}</label>
                  </div>
                ) : <p className="checkout-source-summary">Quán sẽ nhắn khi món đã sẵn sàng.</p>}
              </div>
            </details>
          )}
        </CheckoutCard>
      )}
    </>
  );
}
