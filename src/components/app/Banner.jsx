export default function Banner({ banner, onClick }) {
  return (
    <article className="home2026-banner-card" onClick={() => onClick?.(banner)}>
      <img src={banner.image} alt={banner.title || "Banner"} />
      {banner.title || banner.text ? (
        <div className="home2026-banner-content">
          {banner.title ? <h2>{banner.title}</h2> : null}
          {banner.text ? <p>{banner.text}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
