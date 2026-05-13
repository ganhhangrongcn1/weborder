export default function HomeFulfillmentCard({
  homeFulfillment,
  onDelivery,
  onPickup,
  selectedDeliveryBranchInfo
}) {
  return (
    <div className="pickup-time-card">
      <div className="pickup-mode-tabs service-tabs">
        <button onClick={onDelivery} className={homeFulfillment === "delivery" ? "active" : ""}>Giao hàng</button>
        <button onClick={onPickup} className={homeFulfillment === "pickup" ? "active" : ""}>Tự đến lấy</button>
      </div>
      <span className="text-xs font-bold text-brown/60">
        {homeFulfillment === "pickup"
          ? "Chọn chi nhánh và giờ lấy trước khi vào menu."
          : `Giao từ ${selectedDeliveryBranchInfo?.name || "chi nhánh gần bạn"} để tính phí ship chính xác.`}
      </span>
    </div>
  );
}
