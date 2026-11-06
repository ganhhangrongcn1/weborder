import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";
export default function CheckoutFulfillmentTabs({ fulfillmentType, setFulfillmentType, forcePickupOnly = false, isQrCounterOrder = false, deliveryAvailable = true, onUnavailableDelivery, onClearFieldError }) {
  if (isQrCounterOrder) return null;
  const deliveryLocked = forcePickupOnly || !deliveryAvailable;
  return (
    <div className="fulfillment-tabs" role="group" aria-label="Hình thức nhận món">
      <CustomerControl type="button" aria-pressed={fulfillmentType === "pickup"} className={fulfillmentType === "pickup" ? "active" : ""} onClick={() => { onClearFieldError?.(); setFulfillmentType("pickup"); }}><Icon name="store" size={20} /><span>Đến lấy</span></CustomerControl>
      <CustomerControl type="button" aria-pressed={fulfillmentType === "delivery"} aria-disabled={deliveryLocked} disabled={forcePickupOnly} className={`${fulfillmentType === "delivery" ? "active" : ""} ${deliveryLocked ? "is-unavailable" : ""}`} onClick={() => {
        if (!deliveryAvailable && !forcePickupOnly) { onUnavailableDelivery?.(); return; }
        if (forcePickupOnly) return;
        onClearFieldError?.();
        setFulfillmentType("delivery");
      }}><Icon name="bike" size={20} /><span>Giao hàng</span></CustomerControl>
    </div>
  );
}
