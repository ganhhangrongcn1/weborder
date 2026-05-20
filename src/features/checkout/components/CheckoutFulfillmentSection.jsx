import { Fragment } from "react";
import Icon from "../../../components/Icon.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import InfoLine from "./InfoLine.jsx";
import { checkoutText } from "../../../data/uiText.js";

export default function CheckoutFulfillmentSection({
  fulfillmentType,
  setFulfillmentType,
  forcePickupOnly = false,
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
  return (
    <>
      <div className="fulfillment-tabs">
        <button onClick={() => setFulfillmentType("delivery")} disabled={forcePickupOnly} className={fulfillmentType === "delivery" ? "active" : ""}>Giao tận nơi</button>
        <button onClick={() => setFulfillmentType("pickup")} className={fulfillmentType === "pickup" ? "active" : ""}>Đến lấy</button>
      </div>

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
          <CheckoutCard title="Thông tin người nhận">
            <div className="grid gap-3">
              <div className="checkout-pickup-contact-grid grid grid-cols-2 gap-3">
                <label className="pickup-field">
                  <span>Tên của bạn</span>
                  <input
                    value={pickupContact.name}
                    onChange={(event) => setPickupContact((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ví dụ: Anh Minh"
                  />
                </label>
                <label className="pickup-field">
                  <span>Số điện thoại</span>
                  <input
                    value={pickupContact.phone}
                    onChange={(event) => setPickupContact((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))}
                    inputMode="tel"
                    placeholder="09..."
                  />
                </label>
              </div>
              <p className="checkout-inline-note">
                Quán dùng thông tin này để xác nhận người đến lấy và tích điểm cho bạn.
              </p>
            </div>
          </CheckoutCard>

          <CheckoutCard title="Chi nhánh lấy món">
            <div className="space-y-3">
              {(selectedBranchInfo && !isChangingBranch || lockPickupBranch ? [selectedBranchInfo].filter(Boolean) : pickupBranches).map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => {
                    if (lockPickupBranch) return;
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
              {selectedBranchInfo && !isChangingBranch && !lockPickupBranch ? (
                <button
                  type="button"
                  onClick={() => setIsChangingBranch(true)}
                  className="checkout-inline-action"
                >
                  Đổi chi nhánh lấy món
                </button>
              ) : null}
              {lockPickupBranch ? (
                <p className="checkout-inline-note">
                  Đơn này đang khóa theo chi nhánh từ mã QR tại quầy.
                </p>
              ) : null}
            </div>
          </CheckoutCard>
        </Fragment>
      )}

      {fulfillmentType === "delivery" ? null : (
        <CheckoutCard title="Thời gian nhận món">
          <div className="pickup-time-card">
            <div className="pickup-mode-tabs">
              <button onClick={() => setPickupMode("soon")} className={pickupMode === "soon" ? "active" : ""}>Sớm nhất</button>
              {!hidePickupSchedule ? <button onClick={() => setPickupMode("schedule")} className={pickupMode === "schedule" ? "active" : ""}>Chọn giờ</button> : null}
            </div>
            {pickupMode === "soon" || hidePickupSchedule ? (
              <div className="pickup-soon">
                <strong>{hidePickupSchedule ? "Đặt liền tại quầy" : "Sẵn sàng sau khoảng 20 phút"}</strong>
                <span>{hidePickupSchedule ? "Quán sẽ ưu tiên làm đơn ngay theo QR tại quầy." : "Quán sẽ nhắn khi món đã chuẩn bị xong."}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="pickup-field">
                  <span>Ngày lấy</span>
                  <input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
                </label>
                <label className="pickup-field">
                  <span>Giờ lấy</span>
                  <input type="time" value={pickupClock} onChange={(event) => setPickupClock(event.target.value)} />
                </label>
              </div>
            )}
          </div>
        </CheckoutCard>
      )}
    </>
  );
}
