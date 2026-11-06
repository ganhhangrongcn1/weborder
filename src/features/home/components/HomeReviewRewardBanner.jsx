import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";

export default function HomeReviewRewardBanner({
  block,
  onOpen
}) {
  const title = "Đánh giá nhận điểm";
  const subtitle = String(
    block?.subtitle ||
    "GrabFood · ShopeeFood · Xanh Ngon · Google Maps"
  ).trim();
  const displayedSubtitle = /google\s*maps/i.test(subtitle)
    ? subtitle
    : `${subtitle} · Google Maps`;

  return (
    <section className="home-review-reward" aria-label={title}>
      <CustomerControl type="button" className="home-review-action" onClick={onOpen}>
        <span className="home-review-action__icon"><Icon name="star" size={24} weight="fill" /></span>
        <span className="home-review-action__copy"><small>Quà cảm ơn từ Gánh</small><strong>{title}</strong><span>{displayedSubtitle}</span></span>
        <Icon name="back" size={16} className="home-review-action__arrow" />
      </CustomerControl>
    </section>
  );
}
