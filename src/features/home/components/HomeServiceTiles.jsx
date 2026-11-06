import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";
import HomeBrandTexture from "./HomeBrandTexture.jsx";

export default function HomeServiceTiles({ onPickup, onDelivery }) {
  return <section className="home-service-tiles" aria-label="Chọn cách nhận món">
    <CustomerControl type="button" className="home-service-tile home-service-tile--pickup" onClick={onPickup}>
      <HomeBrandTexture />
      <span className="home-service-icon" aria-hidden="true"><Icon name="bag" size={28} weight="regular" /></span>
      <strong>Đặt trước<br />ghé lấy</strong>
      <span className="home-service-action" aria-hidden="true"><Icon name="back" size={17} /></span>
    </CustomerControl>
    <CustomerControl type="button" className="home-service-tile home-service-tile--delivery" onClick={onDelivery}>
      <HomeBrandTexture />
      <span className="home-service-icon" aria-hidden="true"><Icon name="bike" size={28} weight="regular" /></span>
      <strong>Giao hàng</strong>
      <span className="home-service-action" aria-hidden="true"><Icon name="back" size={17} /></span>
    </CustomerControl>
  </section>;
}
