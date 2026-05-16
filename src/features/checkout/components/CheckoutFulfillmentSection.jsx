import { Fragment } from "react";
import Icon from "../../../components/Icon.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import InfoLine from "./InfoLine.jsx";
import { checkoutText } from "../../../data/uiText.js";

export default function CheckoutFulfillmentSection({
  fulfillmentType,
  setFulfillmentType,
  setIsAddressModalOpen,
  deliveryInfo,
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
        <button onClick={() => setFulfillmentType("delivery")} className={fulfillmentType === "delivery" ? "active" : ""}>Giao tận nơi</button>
        <button onClick={() => setFulfillmentType("pickup")} className={fulfillmentType === "pickup" ? "active" : ""}>Đến lấy</button>
      </div>

      {fulfillmentType === "delivery" ? (
        <CheckoutCard title={checkoutText.deliveryTo} action={checkoutText.changeAddress} onAction={() => setIsAddressModalOpen(true)}>
          <div className="delivery-info-box">
            <InfoLine icon="user" label={checkoutText.customerName} value={deliveryInfo.name} />
            <InfoLine icon="home" label={checkoutText.address} value={deliveryInfo.address} />
            <InfoLine icon="phone" label={checkoutText.phone} value={deliveryInfo.phone} />
          </div>
        </CheckoutCard>
      ) : (
        <Fragment>
          <CheckoutCard title="Thông tin người nhận">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
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
              <p className="rounded-2xl bg-orange-50 px-3 py-2 text-xs font-semibold leading-5 text-orange-700">
                Quán dùng thông tin này để xác nhận người đến lấy và tích điểm cho bạn.
              </p>
            </div>
          </CheckoutCard>

          <CheckoutCard title="Chọn chi nhánh để lấy">
            <div className="space-y-3">
              {(selectedBranchInfo && !isChangingBranch ? [selectedBranchInfo] : pickupBranches).map((branch) => (
                <button
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
                  className="w-full text-left text-sm font-semibold text-orange-600"
                >
                  Bấm vào đổi chi nhánh lấy
                </button>
              ) : null}
            </div>
          </CheckoutCard>
        </Fragment>
      )}

      {fulfillmentType === "delivery" ? null : (
        <CheckoutCard title="Thời gian đến lấy">
          <div className="pickup-time-card">
            <div className="pickup-mode-tabs">
              <button onClick={() => setPickupMode("soon")} className={pickupMode === "soon" ? "active" : ""}>Sớm nhất</button>
              <button onClick={() => setPickupMode("schedule")} className={pickupMode === "schedule" ? "active" : ""}>Chọn giờ</button>
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
