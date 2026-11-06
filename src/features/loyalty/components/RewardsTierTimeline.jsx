import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";

function milestoneLabel(amount) {
  const value = Math.max(0, Number(amount || 0));
  if (value >= 1000000) return `${(value / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (value >= 1000) return `${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return `${value}đ`;
}

export default function RewardsTierTimeline({ journey, isGuest = false }) {
  const tiers = (journey?.tiers || []).filter((tier) => tier.enabled !== false);
  if (!tiers.length) return null;
  const currentIndex = Math.max(0, tiers.findIndex((tier) => tier.id === journey?.currentTier?.id));
  const segmentProgress = Math.min(100, Math.max(0, Number(journey?.progressPercent || 0))) / 100;
  const progress = isGuest ? 0 : tiers.length > 1 ? Math.min(100, (currentIndex + (currentIndex < tiers.length - 1 ? segmentProgress : 0)) / (tiers.length - 1) * 100) : 100;
  return <div className="rewards-tier-timeline" style={{ "--tier-fill": `${progress}%`, "--tier-count": tiers.length }}>
    <div className="rewards-tier-timeline__track" role="progressbar" aria-label="Tiến độ qua các mốc hạng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={isGuest ? "Đăng nhập để xem tiến độ của bạn" : `Hạng hiện tại: ${journey?.currentTier?.name || "Thành viên"}`}><span /></div>
    <ol aria-label="Các mốc chi tiêu tích hạng">{tiers.map((tier, index) => {
      const state = isGuest ? "upcoming" : index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming";
      return <li key={tier.id} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
        <span className="rewards-tier-timeline__dot" aria-hidden="true">{state === "completed" ? <Icon name="check" size={10} /> : state === "current" ? <Icon name="crown" size={12} weight="regular" /> : null}</span>
        <span className="rewards-tier-timeline__amount" title={`${tier.name}: từ ${formatMoney(tier.minAnnualSpend)} chi tiêu / năm`}>{milestoneLabel(tier.minAnnualSpend)}</span>
        <span className="rewards-tier-timeline__name">{tier.name}</span>
      </li>;
    })}</ol>
    <span className="rewards-tier-timeline__caption">Chi tiêu tích hạng / năm</span>
  </div>;
}
