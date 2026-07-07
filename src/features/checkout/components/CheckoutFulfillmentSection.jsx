import { Fragment } from "react";
import Icon from "../../../components/Icon.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import InfoLine from "./InfoLine.jsx";
import { checkoutText } from "../../../data/uiText.js";

export default function CheckoutFulfillmentSection({
  fulfillmentType,
  setFulfillmentType,
  forcePickupOnly = false,
  isQrCounterOrder = false,
  deliveryAvailable = true,
  onUnavailableDelivery,
  hidePickupSchedule = false,
  lockPickupBranch = false,
  setIsAddressModalOpen,
  deliveryInfo,
  deliverySourceBranch,
  pickupContact,
  setPickupContact,
  selectedBranchInfo,
  isChangingBranch,
  pickupBranches,
  selectedBranch,
  setSelectedBranch,
  setIsChangingBranch,
  pickupMode,
  setPickupMode,
  pickupDate,
  setPickupDate,
  pickupClock,
  setPickupClock
}) {
  const deliveryLocked = forcePickupOnly || !deliveryAvailable;

  const handleSelectDelivery = () => {
    if (!deliveryAvailable && !forcePickupOnly) {
      onUnavailableDelivery?.();
      return;
    }

    if (forcePickupOnly) return;
    setFulfillmentType("delivery");
  };

  return (
    <>
      {!isQrCounterOrder ? (
        <div className="fulfillment-tabs">
          <button
            type="button"
            onClick={handleSelectDelivery}
            disabled={deliveryLocked}
            className={`${fulfillmentType === "delivery" ? "active" : ""} ${deliveryLocked ? "is-unavailable" : ""}`}
          >
            Giao tận nơi
          </button>
          <button type="button" onClick={() => setFulfillmentType("pickup")} className={fulfillmentType === "pickup" ? "active" : ""}>Đến lấy</button>
        </div>
      ) : null}

      {fulfillmentType === "delivery" ? (
        <CheckoutCard title={checkoutText.deliveryTo} action="Đổi" onAction={() => setIsAddressModalOpen(true)}>
          <div className="delivery-info-box">
            <InfoLine icon="user" label={checkoutText.customerName} value={deliveryInfo.name} />
            <InfoLine icon="home" label={checkoutText.address} value={deliveryInfo.address} />
            <InfoLine icon="phone" label={checkoutText.phone} value={deliveryInfo.phone} />
          </div>
          {deliverySourceBranch?.name ? (
            <div className="checkout-inline-note">
              <strong>Chi nhánh giao:</strong> <span>{deliverySourceBranch.name}</span>
            </div>
          ) : null}
        </CheckoutCard>
      ) : (
        <Fragment>
          <CheckoutCard title="Nhận món tại quán" className="checkout-pickup-card">
            <div className="checkout-pickup-section">
              <div className="checkout-subsection-head">
                <span className="checkout-subsection-icon" aria-hidden="true">
                  <Icon name="user" size={16} />
                </span>
                <div>
                  <strong>{isQrCounterOrder ? "Thông tin nhận món" : "Thông tin người nhận"}</strong>
                  <small>{isQrCounterOrder ? "Quán dùng để gọi khi cần và tích điểm thành viên" : "Quán dùng để xác nhận và tích điểm"}</small>
                </div>
              </div>

              <div className="checkout-pickup-contact-grid grid gap-3">
                <label className="pickup-field">
                  <span>Tên của bạn</span>
                  <input
                    type="text"
                    name="pickupName"
                    autoComplete="name"
                    value={pickupContact.name}
                    onChange={(event) => setPickupContact((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ví dụ: Anh Minh…"
                  />
                </label>
                <label className="pickup-field">
                  <span>Số điện thoại</span>
                  <input
                    type="tel"
                    name="pickupPhone"
                    autoComplete="tel"
                    value={pickupContact.phone}
                    onChange={(event) => setPickupContact((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))}
                    inputMode="tel"
                    placeholder="Ví dụ: 0901 234 567…"
                  />
                </label>
              </div>
            </div>

            {!lockPickupBranch ? (
              <div className="checkout-pickup-section">
                <div className="checkout-subsection-head">
                  <span className="checkout-subsection-icon" aria-hidden="true">
                    <Icon name="home" size={16} />
                  </span>
                  <div>
                    <strong>Chi nhánh lấy món</strong>
                    <small>Chọn nơi thuận tiện để đến nhận</small>
                  </div>
                </div>

                <div className="space-y-3">
                {(selectedBranchInfo && !isChangingBranch ? [selectedBranchInfo].filter(Boolean) : pickupBranches).map((branch) => (
                  <button
                    type="button"
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranch(branch.id);
                      setIsChangingBranch(false);
                    }}
                    className={`branch-card ${selectedBranch === branch.id ? "branch-card-active" : ""}`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                      <Icon name="home" size={18} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{branch.name}</strong>
                      <small>{branch.address}</small>
                      <em>{branch.time}</em>
                    </span>
                    <span className="branch-radio">{selectedBranch === branch.id ? "✓" : ""}</span>
                  </button>
                ))}
                {selectedBranchInfo && !isChangingBranch ? (
                  <button
                    type="button"
                    onClick={() => setIsChangingBranch(true)}
                    className="checkout-inline-action"
                  >
                    Đổi chi nhánh lấy món
                  </button>
                ) : null}
                </div>
              </div>
            ) : null}

            {!hidePickupSchedule ? (
              <div className="checkout-pickup-section">
                <div className="checkout-subsection-head">
                  <span className="checkout-subsection-icon" aria-hidden="true">
                    <Icon name="clock" size={16} />
                  </span>
                  <div>
                    <strong>Thời gian nhận món</strong>
                    <small>Chọn nhận sớm nhất hoặc hẹn giờ</small>
                  </div>
                </div>

                <div className="pickup-time-card">
                  <div className="pickup-mode-tabs">
                    <button type="button" onClick={() => setPickupMode("soon")} className={pickupMode === "soon" ? "active" : ""}>Sớm nhất</button>
                    <button type="button" onClick={() => setPickupMode("schedule")} className={pickupMode === "schedule" ? "active" : ""}>Chọn giờ</button>
                  </div>
                  {pickupMode === "soon" ? (
                    <div className="pickup-soon">
                      <strong>Sẵn sàng sau khoảng 20 phút</strong>
                      <span>Quán sẽ nhắn khi món đã chuẩn bị xong.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="pickup-field">
                        <span>Ngày lấy</span>
                        <input name="pickupDate" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
                      </label>
                      <label className="pickup-field">
                        <span>Giờ lấy</span>
                        <input name="pickupTime" type="time" value={pickupClock} onChange={(event) => setPickupClock(event.target.value)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </CheckoutCard>
        </Fragment>
      )}
    </>
  );
}
