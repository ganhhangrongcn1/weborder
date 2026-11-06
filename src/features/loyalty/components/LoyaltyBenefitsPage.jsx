import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";
import RewardsTierTimeline from "./RewardsTierTimeline.jsx";

export default function LoyaltyBenefitsPage({ journey, onClose }) {
  const tiers = (journey?.tiers || []).filter((tier) => tier.enabled !== false);
  const current = journey?.currentTier || tiers[0];
  return <CustomerBottomSheet title="Quyền lợi thành viên" onClose={onClose} className="rewards-benefits-page" contentClassName="rewards-benefits-page__scroll">
    <div className="rewards-benefits-page__body">
      <section className="rewards-benefits-current"><span className="rewards-icon-box"><Icon name="crown" weight="regular" size={30} /></span><div><small>HẠNG HIỆN TẠI</small><h2>{current?.name || "Thành viên Gánh"}</h2></div>
        <div className="rewards-benefits-next"><Icon name="star" weight="regular" size={25} /><div><b>{journey?.nextTier ? `Hạng tiếp theo: ${journey.nextTier.name}` : "Bạn đã đạt hạng cao nhất"}</b>{journey?.nextTier && <small>Còn {formatMoney(journey.amountToNextTier)} chi tiêu tích hạng</small>}</div></div>
        <RewardsTierTimeline journey={journey} />
      </section>
      <section className="rewards-shared-benefits"><h2>Quyền lợi chung</h2><p>Dùng điểm giảm tiền khi thanh toán · Tích tem, đổi quà theo chương trình.</p></section>
      <h2 className="rewards-section-title"><Icon name="sparkle" weight="regular" size={21} /> Mức tích điểm theo hạng</h2>
      <div className="rewards-benefit-tiers">{tiers.map((tier) => <article key={tier.id} className={`rewards-benefit-tier is-${tier.state || "upcoming"}`} aria-current={tier.id === current?.id ? "step" : undefined}>
        <header><span className="rewards-icon-box"><Icon name={tier.state === "upcoming" ? "lock" : "crown"} weight="regular" size={25} /></span><div><h3>{tier.name}</h3><small>{Number(tier.minAnnualSpend) > 0 ? `Từ ${formatMoney(tier.minAnnualSpend)} chi tiêu / năm` : "Tham gia thành viên"}</small></div><em>{tier.id === current?.id ? "Hiện tại" : tier.state === "completed" ? "Đã đạt" : "Chưa mở"}</em></header>
        <div className="rewards-tier-earning"><Icon name="coins" size={23} /><div><strong>+{Math.floor(100000 / Math.max(1, Number(tier.currencyPerPoint || 100)) * Number(tier.pointPerUnit || 0)).toLocaleString("vi-VN")} điểm</strong><small>Cho mỗi 100.000đ đủ điều kiện tích điểm</small></div></div>
        {tier.milestoneVoucherId ? <p className="rewards-tier-voucher"><Icon name="ticket" size={18} /> Quà lên hạng theo chương trình đang áp dụng</p> : null}
      </article>)}</div>
    </div>
  </CustomerBottomSheet>;
}
