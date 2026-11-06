import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";

export default function HomeDeliveryOptions({ open,onClose,onOrderViaApp,appsEnabled=true }) {
  if (!open) return null;
  return <CustomerBottomSheet title="Giao hàng" onClose={onClose} className="home-delivery-options">
    <div className="home-delivery-choices">
      <CustomerControl type="button" disabled className="home-delivery-choice">
        <Icon name="store" size={24} /><span><strong>Giao hàng</strong><small>Tính năng đang phát triển</small></span><em>Sắp có</em>
      </CustomerControl>
      <CustomerControl type="button" className="home-delivery-choice" onClick={onOrderViaApp} disabled={!appsEnabled}>
        <Icon name="bike" size={24} /><span><strong>Đặt qua app</strong><small>{appsEnabled ? "Chọn quán và ứng dụng giao món" : "Đang cập nhật kênh đặt giao"}</small></span><Icon name="back" className="home-delivery-arrow" size={18} />
      </CustomerControl>
    </div>
  </CustomerBottomSheet>;
}
