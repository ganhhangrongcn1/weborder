import Icon from "../../../components/Icon.jsx";

function HomeVoucherCard({ voucher }) {
  return (
    <article className={`home-voucher-card is-${voucher.type}`}>
      <div className="home-voucher-icon" aria-hidden="true">
        <Icon name={voucher.icon} size={22} />
      </div>
      <div className="home-voucher-content">
        <div className="home-voucher-topline">
          <span>{voucher.badge}</span>
          <strong>{voucher.code}</strong>
        </div>
        <h3>{voucher.reward}</h3>
        <ul>
          {voucher.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function HomeVoucherCarousel({ vouchers = [] }) {
  if (!vouchers.length) return null;

  return (
    <section className="home2026-section home-voucher-section" aria-label="Khuyến mãi cho bạn">
      <div className="home-voucher-head">
        <div className="home-voucher-title">
          <span>
            <Icon name="tag" size={18} />
          </span>
          <h2>Khuyến mãi cho bạn</h2>
        </div>
        <em>{vouchers.length}</em>
      </div>
      <div className="home-voucher-scroll">
        {vouchers.map((voucher) => (
          <HomeVoucherCard key={voucher.id} voucher={voucher} />
        ))}
      </div>
    </section>
  );
}
