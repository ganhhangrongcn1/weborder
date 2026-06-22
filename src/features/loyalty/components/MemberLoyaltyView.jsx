import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.jsx";
import CouponList from "../../../pages/customer/loyalty/CouponList.jsx";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import LuckyVoucherModal from "./LuckyVoucherModal.jsx";
import CheckinCard from "./CheckinCard.jsx";
import LoyaltyDetailSheet from "./LoyaltyDetailSheet.jsx";
import TierUpgradeModal from "./TierUpgradeModal.jsx";
import useTierUpgradeCelebration from "../hooks/useTierUpgradeCelebration.js";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";

function formatCustomerDate(value) {
  if (!value) return "sau lần mua đầu tiên";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Đang cập nhật";
  return date.toLocaleDateString("vi-VN");
}

export default function MemberLoyaltyView({
  navigate,
  currentPhone,
  loyaltyRule,
  loyalty,
  tierJourney,
  userProfile,
  luckyVoucher,
  setLuckyVoucher,
  today,
  checkedInToday,
  comebackStreak,
  comebackActive,
  checkinReward,
  nextMilestone,
  progressPercent,
  recentDays,
  handleCheckin,
  canCheckin,
  checkinAuthNotice
}) {
  const loyaltyText = getLoyaltyText();
  const currentTier = tierJourney?.currentTier || {};
  const currencyPerPoint = Math.max(1, Number(currentTier.currencyPerPoint || loyaltyRule?.currencyPerPoint || 100));
  const pointPerUnit = Math.max(1, Number(currentTier.pointPerUnit || loyaltyRule?.pointPerUnit || 10));
  const safePointHistory = Array.isArray(loyalty?.pointHistory) && loyalty.pointHistory.length
    ? loyalty.pointHistory
    : (Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : []);
  const safeVoucherHistory = Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : [];
  const pointRulesRows = [
    { label: "Quy đổi khi thanh toán", value: "1 điểm = 1đ" },
    { label: "Mức dùng tối đa", value: `${tierJourney?.maxRedemptionPercent || 50}% giá trị món` },
    { label: "Hạn điểm", value: "12 tháng từ lần mua cuối" }
  ];
  const [activeSheet, setActiveSheet] = useState("");
  const usableVouchers = useMemo(() => (
    safeVoucherHistory.filter((voucher) => (
      !voucher?.canceled && !voucher?.used && !isVoucherExpired(voucher)
    ))
  ), [safeVoucherHistory]);
  const voucherHeader = useMemo(() => {
    const total = usableVouchers.length;
    return total > 0 ? `Bạn có ${total} voucher dùng được` : "Chưa có voucher dùng được";
  }, [usableVouchers.length]);
  const historyHeader = useMemo(() => {
    const total = safePointHistory.length;
    return total > 0 ? `Lịch sử tích điểm (${total})` : "Lịch sử tích điểm";
  }, [safePointHistory.length]);
  const availableVouchers = usableVouchers.slice(0, 2);
  const progressMessage = tierJourney?.nextTier
    ? tierJourney?.estimatedOrdersToNext
      ? `Còn khoảng ${tierJourney.estimatedOrdersToNext} đơn để lên ${tierJourney.nextTier.name}`
      : `Thêm vài món nữa để lên ${tierJourney.nextTier.name}`
    : "Bạn đã chạm nóc hội ghiền của Gánh rồi đó";
  const tierMessages = {
    new_customer: "Mới chớm thôi, nhưng Gánh thấy có tín hiệu ghiền rồi đó",
    returning_customer: "Bạn với Gánh bắt đầu thân nhau rồi nha",
    super_fan: "Tên bạn đã có chỗ trong hội mê Gánh rồi nha",
    inner_circle_fan: "Bạn là fan chính hiệu của Gánh rồi đó!",
    ganh_legend: "Bạn thuộc nhóm khách đặc biệt nhất của Gánh"
  };
  const { celebratedTier, closeTierCelebration } = useTierUpgradeCelebration({
    customerPhone: currentPhone,
    journey: tierJourney
  });
  const handleUseVoucher = () => navigate("menu", "menu");

  return (
    <section className="pb-6">
      <LoyaltySummary
        title="Cấp hiện tại"
        pointsValue={loyalty.totalPoints.toLocaleString("vi-VN")}
        subtitle="điểm"
        ratioText={`${loyaltyText.ratioPrefix}${currencyPerPoint.toLocaleString("vi-VN")}đ = ${pointPerUnit} điểm`}
        tierName={currentTier.name || "Khách Mới"}
        tierIconKey={currentTier.iconKey}
        tierMessage={tierMessages[currentTier.id] || "Ăn ngon, tích điểm vui cùng Gánh"}
        tierRateText={`Tích ${Number(currentTier.earnPercent || 10).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`}
        expiryText={`Hạn điểm ${formatCustomerDate(tierJourney?.pointsExpiresAt)}`}
        progressPercent={tierJourney?.progressPercent}
        progressMessage={progressMessage}
        onOpenTierDetails={() => setActiveSheet("tiers")}
      />
      <div className="loyalty-main-content">
        <section className="loyalty-voucher-preview" aria-labelledby="loyalty-voucher-title">
          <div className="loyalty-section-heading">
            <div className="loyalty-section-heading__title">
              <span className="loyalty-section-heading__icon"><Icon name="gift" size={19} /></span>
              <div>
                <h2 id="loyalty-voucher-title">{voucherHeader}</h2>
              </div>
            </div>
            <button type="button" onClick={() => setActiveSheet("vouchers")}>
              {usableVouchers.length === 0 && safeVoucherHistory.length > 0 ? "Xem lịch sử" : "Xem tất cả"}
            </button>
          </div>
          <CouponList
            vouchers={availableVouchers}
            isVoucherExpired={isVoucherExpired}
            EmptyState={<AppEmptyState icon="gift" message="Chưa có voucher mới" center />}
            onUseVoucher={handleUseVoucher}
          />
        </section>
        <CheckinCard
          loyalty={loyalty}
          today={today}
          checkedInToday={checkedInToday}
          comebackStreak={comebackStreak}
          comebackActive={comebackActive}
          checkinReward={checkinReward}
          nextMilestone={nextMilestone}
          progressPercent={progressPercent}
          handleCheckin={handleCheckin}
          onOpenDetails={() => setActiveSheet("checkin")}
          canCheckin={canCheckin}
          checkinAuthNotice={checkinAuthNotice}
        />
        <section className="loyalty-quick-actions" aria-label="Thông tin loyalty">
          <button type="button" onClick={() => setActiveSheet("history")}>
            <span><Icon name="clock" size={18} /></span>
            <div><strong>Nhật ký điểm của bạn</strong></div>
            <Icon name="back" size={16} />
          </button>
          <button type="button" onClick={() => setActiveSheet("rules")}>
            <span><Icon name="star" size={18} /></span>
            <div><strong>Điểm dùng thế nào?</strong></div>
            <Icon name="back" size={16} />
          </button>
        </section>
      </div>

      <LoyaltyDetailSheet
        activeSheet={activeSheet}
        onClose={() => setActiveSheet("")}
        journey={tierJourney}
        loyalty={loyalty}
        today={today}
        recentDays={recentDays}
        vouchers={safeVoucherHistory}
        pointHistory={safePointHistory}
        pointRulesRows={pointRulesRows}
        onUseVoucher={handleUseVoucher}
      />

      <TierUpgradeModal tier={celebratedTier} onClose={closeTierCelebration} />

      {rewardFeatureFlags.enableLuckyDraw ? (
        <LuckyVoucherModal luckyVoucher={luckyVoucher} onClose={() => setLuckyVoucher(null)} />
      ) : null}
    </section>
  );
}
