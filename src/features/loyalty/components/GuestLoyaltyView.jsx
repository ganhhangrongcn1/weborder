import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.jsx";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import {
  getLoyaltyEarnPercent,
  getLoyaltyTierIconSymbol
} from "../../../services/loyaltyProgramConfigService.js";

export default function GuestLoyaltyView({ navigate, loyaltyRule }) {
  const loyaltyText = getLoyaltyText();
  const [showRules, setShowRules] = useState(false);
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
  const exampleSpend = 100000;
  const configuredMaxRedemption = Number(loyaltyRule?.maxRedemptionPercent || 50);
  const maxRedemptionPercent = Number.isFinite(configuredMaxRedemption)
    ? Math.min(100, Math.max(0, configuredMaxRedemption))
    : 50;
  const minExamplePoints = Math.round((exampleSpend * minTierRate) / 100);
  const maxExamplePoints = Math.round((exampleSpend * maxTierRate) / 100);
  const maxExampleRedeem = Math.floor((exampleSpend * maxRedemptionPercent) / 100);
  const pointRulesExample = `Ví dụ: Đơn ${exampleSpend.toLocaleString("vi-VN")}đ có thể dùng tối đa ${maxExampleRedeem.toLocaleString("vi-VN")} điểm; phần còn lại thanh toán như bình thường.`;
  const loyaltyRulesRows = [
    { label: "Tích điểm theo hạng", value: `${minTierRate}% đến ${maxTierRate}%` },
    { label: "Dùng điểm", value: `1 điểm = 1đ, tối đa ${maxRedemptionPercent}%` },
    { label: "Hạn điểm", value: "12 tháng từ lần mua cuối" }
  ];
  const safeBonusDisplay = Object.entries(loyaltyRule?.streakRewards || {})
    .map(([days, points]) => ({
      days: Math.max(1, Math.floor(Number(days || 0))),
      points: Math.max(0, Math.floor(Number(points || 0)))
    }))
    .filter((reward) => reward.days > 0 && reward.points > 0)
    .sort((a, b) => a.days - b.days);
  const tiers = Array.isArray(loyaltyRule?.tiers) ? loyaltyRule.tiers.filter((tier) => tier.enabled !== false) : [];
  const firstMilestone = safeBonusDisplay[0];
  const checkinEnabled = loyaltyRule?.checkinEnabled !== false
    && Number(loyaltyRule?.checkinDailyPoints || 0) > 0;
  const openAccount = () => navigate("account", "account");

  return (
    <section className="loyalty-page loyalty-page--guest pb-6">
      <LoyaltySummary
        title="Hội mê Gánh"
        tierName="Quà ngon đang chờ bạn"
        pointsValue="Đăng nhập"
        subtitle="để xem điểm"
        tierMessage="Đăng nhập để Gánh giữ điểm sau mỗi lần ăn ngon"
        tierRateText={`Tích ${minTierRate}% đến ${maxTierRate}%`}
        ratioText={`${exampleSpend.toLocaleString("vi-VN")}đ = ${minExamplePoints.toLocaleString("vi-VN")} đến ${maxExamplePoints.toLocaleString("vi-VN")} điểm`}
        expiryText="1 điểm = 1đ"
        metaSecondaryNote={`Dùng tối đa ${maxRedemptionPercent}% giá trị đơn`}
        ctaLabel="Đăng nhập để bắt đầu tích điểm"
        onCta={openAccount}
        isGuest
      />

      <div className="loyalty-page__content">
        <CustomerCard className="loyalty-guest-benefits" padding="md">
          <div className="loyalty-section-head">
            <div className="loyalty-section-head__title">
              <span><Icon name="dish" size={18} /></span>
              <div>
                <small>Ăn là có quà</small>
                <h2>Tham gia có gì vui?</h2>
              </div>
            </div>
          </div>

          <div className="loyalty-guest-benefits__list">
            <div>
              <span className="is-orange"><Icon name="star" size={17} /></span>
              <p><strong>Tích điểm từ đơn đầu</strong><small>Mỗi hạng được cộng từ {minTierRate}% đến {maxTierRate}%</small></p>
            </div>
            <div>
              <span className="is-green"><Icon name="gift" size={17} /></span>
              <p><strong>Quà tự đến khi lên hạng</strong><small>Voucher được tặng đúng mốc, không cần săn mã</small></p>
            </div>
            {checkinEnabled ? (
              <div>
                <span className="is-yellow"><Icon name="clock" size={17} /></span>
                <p><strong>Ghé mỗi ngày, nhận thêm điểm</strong><small>{firstMilestone ? `${firstMilestone.days} ngày liên tiếp nhận +${firstMilestone.points} điểm` : "Điểm danh để giữ chuỗi vui"}</small></p>
              </div>
            ) : null}
          </div>
        </CustomerCard>

        {tiers.length ? (
          <CustomerCard className="loyalty-guest-journey" padding="md">
            <div className="loyalty-section-head">
              <div className="loyalty-section-head__title">
                <span><Icon name="gift" size={18} /></span>
                <div>
                  <small>{tiers.length} hạng thành viên</small>
                  <h2>Đi từ Chớm Ghiền tới Huyền Thoại</h2>
                </div>
              </div>
            </div>
            <div className="loyalty-guest-journey__track" aria-label="Các hạng thành viên">
              {tiers.map((tier, index) => (
                <div key={tier.id || tier.name} className={index === 0 ? "is-first" : ""}>
                  <span aria-hidden="true">{getLoyaltyTierIconSymbol(tier.iconKey)}</span>
                  <small>{tier.name}</small>
                </div>
              ))}
            </div>
          </CustomerCard>
        ) : null}

        <CustomerCard className="loyalty-action-list" padding="none">
          <button type="button" className="loyalty-action-row" onClick={() => setShowRules(true)}>
            <span className="loyalty-action-row__icon is-green"><Icon name="star" size={17} /></span>
            <span className="loyalty-action-row__copy">
              <strong>Điểm dùng thế nào?</strong>
              <small>Xem cách đổi điểm, giới hạn và thời hạn</small>
            </span>
            <Icon name="back" size={16} className="loyalty-action-row__arrow" />
          </button>
          <div className="loyalty-action-row loyalty-action-row--locked">
            <span className="loyalty-action-row__icon is-orange"><Icon name="clock" size={17} /></span>
            <span className="loyalty-action-row__copy">
              <strong>Voucher và nhật ký điểm</strong>
              <small>Mở sau khi đăng nhập để xem quà và điểm của riêng bạn</small>
            </span>
            <span className="loyalty-action-row__status">Khóa</span>
          </div>
        </CustomerCard>

        <CustomerButton full variant="secondary" onClick={openAccount}>
          {loyaltyText.authCta}
        </CustomerButton>
      </div>

      {showRules ? (
        <CustomerBottomSheet
          title="Điểm dùng thế nào?"
          onClose={() => setShowRules(false)}
          className="loyalty-detail-sheet"
        >
          <PointsCard rows={loyaltyRulesRows} example={pointRulesExample} />
        </CustomerBottomSheet>
      ) : null}
    </section>
  );
}
