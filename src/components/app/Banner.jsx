export default function Banner({ banner, onClick, priority = false }) {
  return (
    <article className="home2026-banner-card">
      {onClick ? (
        <button
          type="button"
          className="home2026-banner-action"
          onClick={() => onClick(banner)}
          aria-label={banner.cta || banner.title || "Xem ưu đãi"}
        />
      ) : null}

      <img
        src={banner.image}
        alt={banner.title || "Ưu đãi tại Gánh Hàng Rong"}
        width="1200"
        height="525"
        loading={priority ? "eager" : "lazy"}
      />

      {banner.title || banner.text ? (
        <div className="home2026-banner-content">
          {banner.title ? <h2>{banner.title}</h2> : null}
          {banner.text ? <p>{banner.text}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
