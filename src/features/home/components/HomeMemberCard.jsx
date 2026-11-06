import { useState } from "react";
import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";
import HomeBrandTexture from "./HomeBrandTexture.jsx";

export default function HomeMemberCard({ membership, navigate, brand }) {
  const [failedAvatar,setFailedAvatar] = useState("");
  const brandName = String(brand?.title || "Gánh Hàng Rong").trim();
  const brandParts = brandName.split(/\s+[-–|]\s+/);
  const hasBrandSuffix = brandParts.length > 1 && /gánh/i.test(brandParts.at(-1));
  const displayBrandName = hasBrandSuffix ? brandParts.at(-1) : brandName;
  return <section className="home-brand-member">
    <HomeBrandTexture />
    {brand?.logo && <img className="home-brand-watermark" src={brand.logo} alt="" aria-hidden="true" width="200" height="200" />}
    <header className="home-brand-masthead">
      {brand?.logo ? <img src={brand.logo} alt="" width="36" height="36" /> : <span className="home-brand-mark" aria-hidden="true">G</span>}
      <span><strong>{displayBrandName}</strong>{hasBrandSuffix && <small>{brandParts.slice(0,-1).join(" · ")}</small>}</span>
    </header>
    <section className="home-member-card" aria-label="Thông tin thành viên">
    <CustomerControl type="button" className="home-member-profile" onClick={()=>navigate("account","account")}>
      {membership.avatar && failedAvatar !== membership.avatar ? <img src={membership.avatar} onError={()=>setFailedAvatar(membership.avatar)} alt="" width="48" height="48" /> : <span className="home-member-avatar"><Icon name="user" size={28} /></span>}
      <span>{membership.signedIn && <small>Xin chào</small>}<strong>{membership.name}</strong><span className="home-member-tier">{membership.signedIn && <Icon name="crown" size={14} />}{membership.signedIn ? membership.tier : "Nhận ưu đãi"}</span></span>
    </CustomerControl>
    {membership.signedIn ? <CustomerControl type="button" className="home-member-points" onClick={()=>navigate("loyalty","rewards")} aria-label="Xem điểm và hạng thành viên">
      <span className="home-member-points-value"><Icon name="coins" size={18} /><strong>{membership.points.toLocaleString("vi-VN")}</strong></span><small>điểm Gánh <Icon name="back" size={12} /></small>
    </CustomerControl> : <CustomerControl type="button" appearance="primary" className="home-member-login" onClick={()=>navigate("account","account")}>Đăng nhập<Icon name="back" size={14} /></CustomerControl>}
    </section>
  </section>;
}
