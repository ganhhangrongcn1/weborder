import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.jsx";
import { buildLoyaltyTierJourney } from "../../../services/loyaltyProgramConfigService.js";
import RewardsOverview from "./RewardsOverview.jsx";
import LoyaltyBenefitsPage from "./LoyaltyBenefitsPage.jsx";

export default function GuestLoyaltyView({ navigate, loyaltyRule, stampCard = null }) {
  const [activePage, setActivePage] = useState("");
  const journey = useMemo(() => buildLoyaltyTierJourney({}, loyaltyRule), [loyaltyRule]);
  const openAccount = () => navigate("account", "account");
  return <section className="loyalty-page loyalty-page--guest pb-6">
    <RewardsOverview isGuest journey={journey} stampCard={stampCard} onBenefits={() => setActivePage("tiers")}
      onHistory={openAccount} onVouchers={openAccount} onPoints={() => setActivePage("rules")} onLogin={openAccount}>
      <div className="rewards-empty"><Icon name="gift" weight="regular" size={35} /><h2>Quà ngon đang chờ bạn</h2><p>Đăng nhập để xem voucher và điểm của bạn.</p><CustomerControl type="button" onClick={openAccount}>Đăng nhập</CustomerControl></div>
    </RewardsOverview>
    {activePage === "tiers" && <LoyaltyBenefitsPage journey={journey} onClose={() => setActivePage("")} />}
    {activePage === "rules" && <CustomerBottomSheet title="Dùng điểm Gánh" onClose={() => setActivePage("")} className="loyalty-detail-sheet rewards-detail-sheet"><PointsCard rows={[{ label: "Dùng điểm", value: "1 điểm = 1đ" }, { label: "Hạn điểm", value: "60 ngày" }]} example="Điểm dùng được sẽ tự tính tại bước thanh toán." /></CustomerBottomSheet>}
  </section>;
}
