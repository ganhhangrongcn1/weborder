import Icon from "../../../components/Icon.jsx";
import AppBanner from "../../../components/app/Banner.jsx";

function getGreetingMeta(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return { text: "Chào buổi sáng", icon: "☀" };
  if (hour >= 11 && hour < 14) return { text: "Chào buổi trưa", icon: "◐" };
  if (hour >= 14 && hour < 18) return { text: "Chào buổi chiều", icon: "☼" };
  if (hour >= 18 && hour < 23) return { text: "Chào buổi tối", icon: "☾" };
  return { text: "Đêm rồi, ăn nhẹ thôi nè", icon: "☾" };
}

function getCustomerName(userProfile, demoUser) {
  const rawName = String(userProfile?.name || demoUser?.name || "").trim();
  const normalized = rawName.toLowerCase();
  if (!rawName || normalized === "khách hàng" || normalized === "khách" || normalized === "khach hang" || normalized === "khach") return "";
  return rawName.split(" ").filter(Boolean).slice(-2).join(" ");
}

function isVoucherAvailable(voucher) {
  if (!voucher || voucher.used || voucher.canceled) return false;
  const expiredAt = String(voucher?.expiredAt || voucher?.endAt || voucher?.expiry || "").trim();
  if (!expiredAt) return true;
  const endDate = new Date(`${expiredAt.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return true;
  return endDate.getTime() >= Date.now();
}

function getVoucherCount(demoLoyalty) {
  const vouchers = Array.isArray(demoLoyalty?.voucherHistory) ? demoLoyalty.voucherHistory : [];
  return vouchers.filter(isVoucherAvailable).length;
}

export default function HomeHero({
  subtitle,
  bannerAria,
  navigate,
  bannerRef,
  handleBannerScroll,
  banners,
  activeBanner,
  setActiveBanner,
  onBannerClick,
  userProfile,
  demoUser,
  demoLoyalty,
  siteBrand
}) {
  const customerName = getCustomerName(userProfile, demoUser);
  const greetingMeta = getGreetingMeta();
  const greeting = `${greetingMeta.text}${customerName ? `, ${customerName}` : ""}`;
  const voucherCount = getVoucherCount(demoLoyalty);
  const voucherBadge = voucherCount > 9 ? "9+" : String(voucherCount);
  const logoUrl = String(siteBrand?.logo || "").trim();
  const brandName = String(siteBrand?.title || "Gánh Hàng Rong").trim();

  return (
    <>
      <div className="home2026-app-header">
        <div className={`home2026-brand-logo ${logoUrl ? "has-image" : ""}`} aria-label={brandName}>
          {logoUrl ? <img src={logoUrl} alt={brandName} /> : <span>G</span>}
        </div>
        <div className="home2026-greeting-copy">
          <span>
            {greeting}
            <i aria-hidden="true">{greetingMeta.icon}</i>
          </span>
          <strong>{subtitle}</strong>
        </div>
        <div className="home2026-header-actions">
          <button type="button" onClick={() => navigate("loyalty", "rewards")} className="home2026-action-btn" aria-label="Ưu đãi">
            <Icon name="gift" size={17} />
            {voucherCount > 0 ? <span className="home2026-voucher-badge">{voucherBadge}</span> : null}
          </button>
          <button type="button" onClick={() => navigate("account", "account")} className="home2026-action-btn" aria-label="Tài khoản">
            <Icon name="user" size={17} />
          </button>
        </div>
      </div>

      {banners.length ? (
        <div className="home2026-banner-zone">
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
      ) : null}
    </>
  );
}
