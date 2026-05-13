import Icon from "../../../components/Icon.jsx";
import AppBanner from "../../../components/app/Banner.jsx";

export default function HomeHero({
  subtitle,
  searchText,
  bannerAria,
  navigate,
  onSearch,
  bannerRef,
  handleBannerScroll,
  banners,
  activeBanner,
  setActiveBanner,
  onBannerClick
}) {
  return (
    <>
      <div className="home2026-greeting">
        <div>
          <h1>Ưu đãi & Tích điểm</h1>
          <p>{subtitle}</p>
        </div>
        <button type="button" onClick={() => navigate("account", "account")} className="home2026-profile-btn" aria-label="Tài khoản">
          <span className="home2026-user-outline" />
        </button>
      </div>

      <button type="button" onClick={onSearch} className="home2026-search">
        <Icon name="search" size={17} />
        <span>{searchText}</span>
      </button>

      <div>
        <div ref={bannerRef} onScroll={handleBannerScroll} className="home2026-banner-track no-scrollbar">
          {banners.map((banner) => (
            <AppBanner key={banner.id} banner={banner} onClick={onBannerClick} />
          ))}
        </div>
        <div className="home2026-dots">
          {banners.map((banner, index) => (
            <button key={banner.id} onClick={() => setActiveBanner(index)} className={index === activeBanner ? "active" : ""} aria-label={`${bannerAria} ${index + 1}`} />
          ))}
        </div>
      </div>
    </>
  );
}
