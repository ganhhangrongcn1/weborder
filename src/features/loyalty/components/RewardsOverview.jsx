import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";
import RewardsTierTimeline from "./RewardsTierTimeline.jsx";

export default function RewardsOverview({ points = 0, journey, isGuest = false, stampCard, onBenefits, onHistory, onVouchers, onPoints, onLogin, children }) {
  const tier = journey?.currentTier;
  return <section className="rewards-overview">
    <header className="rewards-hero">
      <div className="rewards-hero__heading"><h1><Icon name="sparkle" weight="regular" size={25} /> Ưu đãi</h1><CustomerControl onClick={onHistory} type="button">Lịch sử <Icon name="back" size={14} /></CustomerControl></div>
      <div className="rewards-hero__balance">
        <div><small>ĐIỂM CỦA BẠN</small><strong>{isGuest ? "—" : Number(points || 0).toLocaleString("vi-VN")}</strong></div>
        <CustomerControl className="rewards-tier-link" type="button" onClick={onBenefits}><Icon name="crown" weight="regular" size={27} /><span><b>{isGuest ? "Thành viên Gánh" : tier?.name || "Thành viên"}</b><small>Xem quyền lợi</small></span><Icon name="back" size={17} /></CustomerControl>
      </div>
      {isGuest ? <CustomerControl className="rewards-login" type="button" onClick={onLogin}>Đăng nhập để xem điểm và quà <Icon name="back" size={16} /></CustomerControl> : <>
        <div className="rewards-hero__progress-copy"><span>{tier?.name || "Thành viên"}</span><b>{journey?.nextTier ? `Còn ${formatMoney(journey.amountToNextTier)} → ${journey.nextTier.name}` : "Hạng cao nhất"}</b></div>
      </>}
      <RewardsTierTimeline journey={journey} isGuest={isGuest} />
    </header>
    <div className="rewards-overview__body">
      {stampCard}
      <div className="rewards-shortcuts">
        <CustomerControl type="button" onClick={onVouchers}><span><Icon name="wallet" weight="regular" size={27} /></span><strong>Ví voucher</strong><small>Ưu đãi của tôi</small></CustomerControl>
        <CustomerControl type="button" onClick={onPoints}><span><Icon name="coins" weight="regular" size={27} /></span><strong>Dùng điểm</strong><small>Giảm tiền đơn hàng</small></CustomerControl>
      </div>
      {children}
    </div>
  </section>;
}
