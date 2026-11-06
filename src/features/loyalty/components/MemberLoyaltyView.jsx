import { useMemo, useState } from "react";
import LoyaltyVoucherPopup from "../../../components/customer/LoyaltyVoucherPopup.jsx";
import RewardsOverview from "./RewardsOverview.jsx";
import LoyaltyBenefitsPage from "./LoyaltyBenefitsPage.jsx";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";
import { saveCheckoutVoucherIntent } from "../../../services/checkoutVoucherIntentService.js";
import { buildCustomerVoucherLibrary } from "../../../services/customerVoucherLibraryService.js";
import useLoyaltyEntryPopup from "../hooks/useLoyaltyEntryPopup.js";
import useTierUpgradeCelebration from "../hooks/useTierUpgradeCelebration.js";
import LuckyVoucherModal from "./LuckyVoucherModal.jsx";
import CheckinCard from "./CheckinCard.jsx";
import LoyaltyDetailSheet from "./LoyaltyDetailSheet.jsx";
import LoyaltyPointsPopup from "./LoyaltyPointsPopup.jsx";
import TierUpgradeModal from "./TierUpgradeModal.jsx";

export default function MemberLoyaltyView({
  stampCard = null,
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
  checkinEnabled,
  comebackStreak,
  comebackActive,
  checkinReward,
  nextMilestone,
  progressPercent,
  recentDays,
  handleCheckin,
  checkinPending,
  checkinFeedback,
  canCheckin,
  canShowLoyaltyPopups,
  checkinAuthNotice,
  coupons,
  orders
}) {
  const safePointHistory =
    Array.isArray(loyalty?.pointHistory) && loyalty.pointHistory.length
      ? loyalty.pointHistory
      : (Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : []);
  const safeVoucherHistory = Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : [];
  const displayVouchers = useMemo(
    () => buildCustomerVoucherLibrary({
      walletVouchers: safeVoucherHistory,
      coupons,
      orders,
      channel: "web"
    }),
    [safeVoucherHistory, coupons, orders]
  );
  const pointRulesRows = [
    { label: "Quy đổi khi thanh toán", value: "1 điểm = 1đ" },
    { label: "Số điểm có thể dùng", value: "Hiển thị tại bước thanh toán" },
    { label: "Hạn điểm", value: "60 ngày" }
  ];
  const pointRulesExample = "Số điểm dùng được sẽ tự tính theo giá trị đơn và voucher đang áp dụng.";
  const [activeSheet, setActiveSheet] = useState("");
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
  const handleUseVoucher = (voucher) => {
    if (voucher) saveCheckoutVoucherIntent(voucher);
    setActiveSheet("");
    navigate("menu", "menu");
  };
  const handleEntryVoucherAction = () => {
    closeEntryPopup();
    handleUseVoucher(entryPopup?.voucher);
  };
  const handleEntryPointsAction = () => {
    closeEntryPopup();
    setActiveSheet("rules");
  };

  return (
    <section className="loyalty-page loyalty-page--member pb-6">
      <RewardsOverview points={loyalty.totalPoints} journey={tierJourney} stampCard={stampCard}
        onBenefits={() => setActiveSheet("tiers")} onHistory={() => setActiveSheet("history")}
        onVouchers={() => setActiveSheet("vouchers")} onPoints={() => setActiveSheet("rules")}>
        {checkinEnabled ? (
          <CheckinCard
            loyalty={loyalty}
            loyaltyRule={loyaltyRule}
            today={today}
            checkedInToday={checkedInToday}
            comebackStreak={comebackStreak}
            comebackActive={comebackActive}
            checkinReward={checkinReward}
            nextMilestone={nextMilestone}
            progressPercent={progressPercent}
            handleCheckin={handleCheckin}
            checkinPending={checkinPending}
            checkinFeedback={checkinFeedback}
            onOpenDetails={() => setActiveSheet("checkin")}
            canCheckin={canCheckin}
            checkinAuthNotice={checkinAuthNotice}
          />
        ) : null}

      </RewardsOverview>
      {activeSheet === "tiers" && <LoyaltyBenefitsPage journey={tierJourney} onClose={() => setActiveSheet("")} />}
      <LoyaltyDetailSheet
        activeSheet={activeSheet === "tiers" ? "" : activeSheet}
        onClose={() => setActiveSheet("")}
        journey={tierJourney}
        loyalty={loyalty}
        loyaltyRule={loyaltyRule}
        today={today}
        recentDays={recentDays}
        vouchers={displayVouchers}
        pointHistory={safePointHistory}
        pointRulesRows={pointRulesRows}
        pointRulesExample={pointRulesExample}
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
