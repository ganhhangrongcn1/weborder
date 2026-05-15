import { useMemo, useState } from "react";
import AppSectionTitle from "../../../components/app/SectionTitle.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.jsx";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.jsx";
import CouponList from "../../../pages/customer/loyalty/CouponList.jsx";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";
import { getLoyaltyRule, getLoyaltyRulesRows, getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import LuckyVoucherModal from "./LuckyVoucherModal.jsx";
import CheckinCard from "./CheckinCard.jsx";
import PointHistoryList from "./PointHistoryList.jsx";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";

export default function MemberLoyaltyView({
  loyalty,
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
  handleCheckin
}) {
  const loyaltyText = getLoyaltyText();
  const loyaltyRule = getLoyaltyRule();
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || 1000));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 1));
  const loyaltyRulesRows = Array.isArray(getLoyaltyRulesRows()) ? getLoyaltyRulesRows() : [];
  const safePointHistory = Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : [];
  const safeVoucherHistory = Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : [];
  const shouldShowVoucherSection = rewardFeatureFlags.enableLuckyDraw || safeVoucherHistory.length > 0;
  const [voucherExpanded, setVoucherExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const voucherHeader = useMemo(() => {
    const total = safeVoucherHistory.length;
    return total > 0 ? `Voucher của bạn (${total})` : "Voucher của bạn";
  }, [safeVoucherHistory.length]);
  const historyHeader = useMemo(() => {
    const total = safePointHistory.length;
    return total > 0 ? `Lịch sử tích điểm (${total})` : "Lịch sử tích điểm";
  }, [safePointHistory.length]);

  return (
    <section className="pb-6">
      <LoyaltySummary
        title={loyaltyText.memberPointsTitle}
        pointsValue={loyalty.totalPoints.toLocaleString("vi-VN")}
        subtitle={loyaltyText.memberPointsSubtitle}
        ratioText={`${loyaltyText.ratioPrefix}${currencyPerPoint.toLocaleString("vi-VN")}đ = ${pointPerUnit} điểm`}
      />
      <div className="space-y-4 px-4 pt-4">
        <CheckinCard
          loyalty={loyalty}
          today={today}
          checkedInToday={checkedInToday}
          comebackStreak={comebackStreak}
          comebackActive={comebackActive}
          checkinReward={checkinReward}
          nextMilestone={nextMilestone}
          progressPercent={progressPercent}
          recentDays={recentDays}
          handleCheckin={handleCheckin}
        />

        <PointsCard rows={loyaltyRulesRows} />
        {shouldShowVoucherSection ? (
          <>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-soft">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setVoucherExpanded((prev) => !prev)}
              >
                <span className="text-sm font-black text-brown">{voucherHeader}</span>
                <span className="text-xs font-bold text-orange-600">
                  {voucherExpanded ? "Thu gọn" : "Xem"}
                </span>
              </button>
              {voucherExpanded ? (
                <div className="mt-3">
                  <CouponList
                    vouchers={safeVoucherHistory}
                    isVoucherExpired={isVoucherExpired}
                    EmptyState={<AppEmptyState icon={null} message="Chưa có voucher" />}
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        <div className="rounded-2xl bg-white px-4 py-3 shadow-soft">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setHistoryExpanded((prev) => !prev)}
          >
            <span className="text-sm font-black text-brown">{historyHeader}</span>
            <span className="text-xs font-bold text-orange-600">
              {historyExpanded ? "Thu gọn" : "Xem"}
            </span>
          </button>
          {historyExpanded ? (
            <div className="mt-3">
              <PointHistoryList entries={safePointHistory} />
            </div>
          ) : null}
        </div>
      </div>

        {rewardFeatureFlags.enableLuckyDraw ? (
        <LuckyVoucherModal luckyVoucher={luckyVoucher} onClose={() => setLuckyVoucher(null)} />
      ) : null}
    </section>
  );
}
