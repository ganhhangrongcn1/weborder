import Icon from "../../../components/Icon.jsx";
import AppSectionTitle from "../../../components/app/SectionTitle.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { getLoyaltyEarnPercent } from "../../../services/loyaltyProgramConfigService.js";

export default function GuestLoyaltyView({ navigate, loyaltyBonusDisplay, loyaltyRule }) {
  const loyaltyText = getLoyaltyText();
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || 100));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 10));
  const configuredTierRates = Array.isArray(loyaltyRule?.tiers)
    ? loyaltyRule.tiers.map((tier) => getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit))
    : [];
  const tierRates = configuredTierRates.length
    ? configuredTierRates
    : [getLoyaltyEarnPercent(currencyPerPoint, pointPerUnit)];
  const minTierRate = Math.min(...tierRates);
  const maxTierRate = Math.max(...tierRates);
  const loyaltyRulesRows = [
    { label: "Tích điểm theo hạng", value: `${minTierRate}% đến ${maxTierRate}%` },
    { label: "Dùng điểm", value: `1 điểm = 1đ, tối đa ${loyaltyRule?.maxRedemptionPercent || 50}%` },
    { label: "Hạn điểm", value: "12 tháng từ lần mua cuối" }
  ];
  const safeBonusDisplay = Array.isArray(loyaltyBonusDisplay) ? loyaltyBonusDisplay : [];

  return (
    <section className="pb-6">
      <div className="reward-hero">
        <div className="flex items-center justify-between">
          <h1>{loyaltyText.rewardHeroSignedOutTitle}</h1>
        </div>
        <strong>--</strong>
        <p><Icon name="star" size={14} /> {loyaltyText.signedOutMessage}</p>
        <span>{loyaltyText.ratioPrefix}{currencyPerPoint.toLocaleString("vi-VN")}đ = {pointPerUnit} điểm</span>
        <CustomerButton full variant="secondary" className="mt-5" onClick={() => navigate("account", "account")}>
          {loyaltyText.authCta}
        </CustomerButton>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <CustomerCard className="checkin-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="reward-icon"><Icon name="gift" size={17} /></span>
              <h2>{loyaltyText.checkinTitle}</h2>
            </div>
            <span className="streak-pill">{loyaltyText.signedOutCheckinHint}</span>
          </div>
          <div className="checkin-notice mt-4">
            <p className="text-sm font-bold leading-6 text-brown/65">{loyaltyText.signedOutCheckinDetail}</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full w-0 rounded-full bg-gradient-main" />
            </div>
          </div>
          <CustomerButton full className="mt-4" onClick={() => navigate("account", "account")}>
            {loyaltyText.checkinLoginHint}
          </CustomerButton>
          <div className="checkin-bonus-grid opacity-60">
            {safeBonusDisplay.map((reward) => (
              <div key={reward.days}>
                <span>{reward.days} ngày</span>
                <strong>{loyaltyText.bonusOpenAfterLogin}</strong>
              </div>
            ))}
          </div>
        </CustomerCard>

        <CustomerCard className="checkin-card">
          <div className="flex items-center gap-2">
            <span className="reward-icon green"><Icon name="star" size={17} /></span>
            <h2>Quy định điểm thưởng</h2>
          </div>
          <div className="reward-rules">
            {loyaltyRulesRows.map((row) => (
              <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>
            ))}
          </div>
        </CustomerCard>

        <AppSectionTitle title={loyaltyText.luckyGiftTitle} />
        <AppEmptyState icon={null} message={loyaltyText.signedOutLuckyMessage} />
        <AppSectionTitle title={loyaltyText.pointsHistoryTitle} />
        <AppEmptyState icon={null} message={loyaltyText.signedOutHistoryMessage} />
      </div>
    </section>
  );
}
