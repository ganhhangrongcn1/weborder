export default function HomeFulfillmentCard({
  homeFulfillment,
  onDelivery,
  onPickup,
  selectedDeliveryBranchInfo
}) {
  const branchName = selectedDeliveryBranchInfo?.name || "chi nhánh gần bạn";

  return (
    <div className="pickup-time-card">
      <div className="pickup-mode-tabs service-tabs" aria-label="Chọn hình thức nhận món">
        <button type="button" onClick={onDelivery} className={homeFulfillment === "delivery" ? "active" : ""}>
          <span>Giao hàng</span>
        </button>
        <button type="button" onClick={onPickup} className={homeFulfillment === "pickup" ? "active" : ""}>
          <span>Tự lấy</span>
        </button>
      </div>
      <div className="home2026-fulfillment-note">
        {homeFulfillment === "pickup"
          ? "Chọn chi nhánh và giờ lấy trước khi xem menu."
          : `Giao từ ${branchName}.`}
      </div>
    </div>
  );
}
