import Icon from "../../../components/Icon.jsx";

export default function HomeReviewRewardBanner({
  block,
  image,
  onOpen
}) {
  const configuredTitle = String(block?.title || "").trim();
  const title = !configuredTitle || configuredTitle === "Nhận 5.000đ từ đơn 5 sao"
    ? "Đánh giá 5 sao, nhận điểm từ Gánh"
    : configuredTitle;
  const subtitle = String(
    block?.subtitle ||
    "GrabFood · ShopeeFood · Xanh Ngon · Google Maps"
  ).trim();
  const displayedSubtitle = /google\s*maps/i.test(subtitle)
    ? subtitle
    : `${subtitle} · Google Maps`;

  return (
    <section className="home-review-reward" aria-labelledby="home-review-reward-title">
      <button type="button" className="home-review-reward__banner" onClick={onOpen}>
        <span className="home-review-reward__visual" aria-hidden="true">
          {image ? <img src={image} alt="" /> : <Icon name="star" size={24} />}
          <span><Icon name="star" size={11} /> 5</span>
        </span>

        <span className="home-review-reward__content">
          <span className="home-review-reward__eyebrow">Quà cảm ơn từ Gánh</span>
          <strong id="home-review-reward-title">{title}</strong>
          <span className="home-review-reward__subtitle">{displayedSubtitle}</span>
        </span>

        <span className="home-review-reward__cta">
          <span>Xem cách nhận</span>
          <Icon name="back" size={18} />
        </span>
      </button>
    </section>
  );
}
