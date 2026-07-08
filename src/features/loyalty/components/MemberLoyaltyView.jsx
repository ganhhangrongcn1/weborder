import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import LoyaltyVoucherPopup from "../../../components/customer/LoyaltyVoucherPopup.jsx";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.jsx";
import CouponList from "../../../pages/customer/loyalty/CouponList.jsx";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";
import useLoyaltyEntryPopup from "../hooks/useLoyaltyEntryPopup.js";
import useTierUpgradeCelebration from "../hooks/useTierUpgradeCelebration.js";
import LuckyVoucherModal from "./LuckyVoucherModal.jsx";
import CheckinCard from "./CheckinCard.jsx";
import LoyaltyDetailSheet from "./LoyaltyDetailSheet.jsx";
import LoyaltyPointsPopup from "./LoyaltyPointsPopup.jsx";
import TierUpgradeModal from "./TierUpgradeModal.jsx";

function formatCustomerDate(value) {
  if (!value) return "sau lần mua đầu tiên";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "đang cập nhật";
  return date.toLocaleDateString("vi-VN");
}

function ActionRow({ icon, title, description, onClick, tone = "orange" }) {
  return (
    <button type="button" className="loyalty-action-row" onClick={onClick}>
      <span className={`loyalty-action-row__icon is-${tone}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="loyalty-action-row__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <Icon name="back" size={16} className="loyalty-action-row__arrow" />
    </button>
  );
}

export default function MemberLoyaltyView({
  navigate,
  currentPhone,
  loyaltyRule,
  loyalty,
  isLoyaltyReady,
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
  canShowLoyaltyPopups,
  checkinAuthNotice
}) {
  const currentTier = tierJourney?.currentTier || {};
  const currencyPerPoint = Math.max(
    1,
    Number(currentTier.currencyPerPoint || loyaltyRule?.currencyPerPoint || 100)
  );
  const pointPerUnit = Math.max(
    1,
    Number(currentTier.pointPerUnit || loyaltyRule?.pointPerUnit || 10)
  );
  const exampleSpend = 100000;
  const examplePoints = Math.round((exampleSpend / currencyPerPoint) * pointPerUnit);
  const safePointHistory =
    Array.isArray(loyalty?.pointHistory) && loyalty.pointHistory.length
      ? loyalty.pointHistory
      : (Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : []);
  const safeVoucherHistory = Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : [];
  const pointRulesRows = [
    { label: "Quy đổi khi thanh toán", value: "1 điểm = 1đ" },
    { label: "Mức dùng tối đa", value: `${tierJourney?.maxRedemptionPercent || 50}% giá trị đơn` },
    { label: "Hạn điểm", value: "12 tháng từ lần mua cuối" }
  ];
  const [activeSheet, setActiveSheet] = useState("");
  const usableVouchers = useMemo(
    () =>
      safeVoucherHistory.filter(
        (voucher) => !voucher?.canceled && !voucher?.used && !isVoucherExpired(voucher)
      ),
    [safeVoucherHistory]
  );
  const availableVouchers = usableVouchers.slice(0, 2);
  const voucherHeader = useMemo(() => {
    const total = usableVouchers.length;
    return total > 0 ? `Bạn có ${total} voucher` : "Chưa có voucher mới";
  }, [usableVouchers.length]);
  const progressMessage = tierJourney?.nextTier
    ? tierJourney?.estimatedOrdersToNext
      ? `Còn khoảng ${tierJourney.estimatedOrdersToNext} đơn để lên ${tierJourney.nextTier.name}`
      : `Thêm vài món nữa để lên ${tierJourney.nextTier.name}`
    : "Bạn đã chạm tới hạng cao nhất của Gánh rồi đó";
  const tierMessages = {
    new_customer: "Mới chớm thôi, nhưng Gánh thấy có tín hiệu ghiền rồi đó",
    returning_customer: "Bạn với Gánh bắt đầu thân nhau rồi nha",
    super_fan: "Bạn là fan chính hiệu của Gánh rồi đó!",
    inner_circle_fan: "Tên bạn đã có chỗ trong hội mê Gánh rồi nha",
    ganh_legend: "Bạn thuộc nhóm khách đặc biệt nhất của Gánh"
  };
  const { celebratedTier, closeTierCelebration } = useTierUpgradeCelebration({
    customerPhone: canShowLoyaltyPopups ? currentPhone : "",
    journey: tierJourney
  });
  const { popup: entryPopup, closePopup: closeEntryPopup } = useLoyaltyEntryPopup({
    customerPhone: currentPhone,
    isReady: isLoyaltyReady,
    vouchers: safeVoucherHistory,
    blocked: Boolean(!canShowLoyaltyPopups || celebratedTier || luckyVoucher || activeSheet)
  });
  const handleUseVoucher = () => navigate("menu", "menu");
  const handleEntryVoucherAction = () => {
    closeEntryPopup();
    handleUseVoucher();
  };
  const handleEntryPointsAction = () => {
    closeEntryPopup();
    setActiveSheet("rules");
  };

  return (
    <section className="loyalty-page loyalty-page--member pb-6">
      <LoyaltySummary
        title="Cấp hiện tại"
        pointsValue={loyalty.totalPoints.toLocaleString("vi-VN")}
        subtitle="điểm"
        ratioText={`${exampleSpend.toLocaleString("vi-VN")}đ = ${examplePoints.toLocaleString("vi-VN")} điểm`}
        tierName={currentTier.name || "Khách Mới"}
        tierIconKey={currentTier.iconKey}
        tierMessage={tierMessages[currentTier.id] || "Ăn ngon, tích điểm vui cùng Gánh"}
        tierRateText={`Tích ${Number(currentTier.earnPercent || 10).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`}
        expiryText={`Hạn điểm ${formatCustomerDate(tierJourney?.pointsExpiresAt)}`}
        progressPercent={tierJourney?.progressPercent}
        progressMessage={progressMessage}
        metaSecondaryNote={`Dùng tối đa ${tierJourney?.maxRedemptionPercent || 50}% giá trị đơn`}
        onOpenTierDetails={() => setActiveSheet("tiers")}
      />

      <div className="loyalty-page__content">
        <section className="loyalty-vouchers" aria-labelledby="loyalty-voucher-heading">
          <div className="loyalty-section-head">
            <div className="loyalty-section-head__title">
              <span><Icon name="gift" size={18} /></span>
              <div>
                <small>Quà ngon đang chờ</small>
                <h2 id="loyalty-voucher-heading">{voucherHeader}</h2>
              </div>
            </div>
            <button
              type="button"
              className="loyalty-section-head__action"
              onClick={() => setActiveSheet("vouchers")}
            >
              {usableVouchers.length === 0 && safeVoucherHistory.length > 0 ? "Xem lịch sử" : "Xem tất cả"}
              <Icon name="back" size={14} />
            </button>
          </div>

          <div className="loyalty-vouchers__list">
            <CouponList
              vouchers={availableVouchers}
              isVoucherExpired={isVoucherExpired}
              EmptyState={<AppEmptyState icon="gift" message="Chưa có voucher mới" center />}
              onUseVoucher={handleUseVoucher}
            />
          </div>
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

        <CustomerCard className="loyalty-action-list" padding="none">
          <ActionRow
            icon="clock"
            title={`Nhật ký điểm của bạn${safePointHistory.length ? ` (${safePointHistory.length})` : ""}`}
            description="Xem điểm đến từ đâu và đã dùng khi nào"
            onClick={() => setActiveSheet("history")}
          />
          <ActionRow
            icon="star"
            tone="green"
            title="Điểm dùng thế nào?"
            description="Cách đổi điểm, giới hạn và thời hạn"
            onClick={() => setActiveSheet("rules")}
          />
        </CustomerCard>
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

      <LoyaltyVoucherPopup
        open={entryPopup?.type === "voucher"}
        voucher={entryPopup?.voucher}
        voucherCount={entryPopup?.voucherCount}
        onClose={closeEntryPopup}
        onPrimaryAction={handleEntryVoucherAction}
      />

      <LoyaltyPointsPopup
        open={entryPopup?.type === "points"}
        points={loyalty.totalPoints}
        journey={tierJourney}
        onClose={closeEntryPopup}
        onPrimaryAction={handleEntryPointsAction}
      />

      {rewardFeatureFlags.enableLuckyDraw ? (
        <LuckyVoucherModal luckyVoucher={luckyVoucher} onClose={() => setLuckyVoucher(null)} />
      ) : null}
    </section>
  );
}
