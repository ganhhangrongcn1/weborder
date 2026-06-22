import Icon from "../../../components/Icon.jsx";
import { getLoyaltyTierIconSymbol } from "../../../services/loyaltyProgramConfigService.js";
import { formatMoney } from "../../../utils/format.js";

function formatPercent(value = 0) {
  return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function buildProgressMessage(journey, nextTier) {
  if (!nextTier) return "Bạn đã chạm tới hạng cao nhất của Gánh";
  if (journey?.estimatedOrdersToNext) {
    return `Còn khoảng ${journey.estimatedOrdersToNext} đơn để lên ${nextTier.name}`;
  }
  return `Mỗi đơn hoàn tất sẽ đưa bạn gần hơn tới ${nextTier.name}`;
}

export default function TierJourneyCard({ journey }) {
  const tiers = Array.isArray(journey?.tiers) ? journey.tiers : [];
  const currentTier = journey?.currentTier || tiers[0] || {};
  const nextTier = journey?.nextTier || null;
  const progressPercent = Math.round(Number(journey?.progressPercent || 0));

  return (
    <section className="loyalty-tier-panel" aria-labelledby="loyalty-tier-title">
      <div className="loyalty-tier-panel__header">
        <div>
          <p>Hành trình năm {journey?.cycleYear}</p>
          <h2 id="loyalty-tier-title">Bạn đã đi được {progressPercent}%</h2>
          <span>{buildProgressMessage(journey, nextTier)}</span>
        </div>
        <div className="loyalty-tier-current-mark">
          <span className="loyalty-tier-symbol" aria-hidden="true">
            {getLoyaltyTierIconSymbol(currentTier.iconKey)}
          </span>
          <small>Hạng hiện tại</small>
          <strong>{currentTier.name}</strong>
        </div>
      </div>

      <div
        className="loyalty-tier-progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progressPercent}
        aria-label={nextTier ? `Tiến độ lên ${nextTier.name}` : "Đã đạt hạng cao nhất"}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="loyalty-tier-spend">
        <span>Chi tiêu tích hạng: <strong>{formatMoney(journey?.annualSpend)}</strong></span>
        {journey?.annualOrderCount > 0 ? (
          <span>{journey.annualOrderCount.toLocaleString("vi-VN")} đơn hoàn tất</span>
        ) : null}
      </div>

      <div className="loyalty-tier-focus">
        <article className="loyalty-tier-focus__item is-current">
          <small>Đang hưởng</small>
          <strong><span aria-hidden="true">{getLoyaltyTierIconSymbol(currentTier.iconKey)}</span>{currentTier.name}</strong>
          <span>Tích {formatPercent(currentTier.earnPercent)}% mỗi đơn</span>
        </article>
        {nextTier ? (
          <article className="loyalty-tier-focus__item is-next">
            <small>Tiếp theo</small>
            <strong><span aria-hidden="true">{getLoyaltyTierIconSymbol(nextTier.iconKey)}</span>{nextTier.name}</strong>
            <span>Tích {formatPercent(nextTier.earnPercent)}% mỗi đơn</span>
          </article>
        ) : (
          <article className="loyalty-tier-focus__item is-next">
            <small>Thành tựu</small>
            <strong>Đỉnh hành trình</strong>
            <span>Tiếp tục giữ hạng trong năm</span>
          </article>
        )}
      </div>

      <details className="loyalty-tier-all">
        <summary>Xem toàn bộ 5 hạng</summary>
        <div role="list" aria-label="Năm hạng thành viên">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              role="listitem"
              className={`loyalty-tier-all__row is-${tier.state}`}
              aria-current={tier.state === "current" ? "step" : undefined}
            >
              <span className="loyalty-tier-step__marker">
                {tier.state === "completed" ? <Icon name="check" size={13} /> : getLoyaltyTierIconSymbol(tier.iconKey)}
              </span>
              <strong>{tier.name}</strong>
              <small>Từ {formatMoney(tier.minAnnualSpend)}</small>
              <em>Tích {formatPercent(tier.earnPercent)}%</em>
            </div>
          ))}
        </div>
      </details>

      <div className="loyalty-tier-benefits">
        <span><Icon name="tag" size={16} />Dùng điểm tối đa {journey?.maxRedemptionPercent || 50}%</span>
        <span><Icon name="clock" size={16} />Giữ hạng đến hết {journey?.cycleYear}</span>
      </div>
    </section>
  );
}
