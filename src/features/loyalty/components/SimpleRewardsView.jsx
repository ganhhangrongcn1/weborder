import AppSectionTitle from "../../../components/app/SectionTitle.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import LoyaltySummary from "../../../pages/customer/loyalty/LoyaltySummary.jsx";
import PointsCard from "../../../pages/customer/loyalty/PointsCard.jsx";
import { getLoyaltySimpleGuestRows, getLoyaltyText } from "../../../services/loyaltyConfigService.js";

export default function SimpleRewardsView({
  navigate,
  isRegisteredCustomer,
  currencyPerPoint,
  pointPerUnit,
  demoLoyalty,
  userProfile
}) {
  const loyaltyText = getLoyaltyText();
  const pointHistory = Array.isArray(userProfile?.pointHistory) ? userProfile.pointHistory : [];

  if (!isRegisteredCustomer) {
    return (
      <section className="pb-6">
        <div className="reward-hero">
          <h1>{loyaltyText.rewardHeroTitle}</h1>
          <strong>--</strong>
          <p>{loyaltyText.signedOutRewardMessage}</p>
          <span>{currencyPerPoint.toLocaleString("vi-VN")}đ = {pointPerUnit} điểm</span>
          <button onClick={() => navigate("account", "account")} className="mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft">
            {loyaltyText.authCta}
          </button>
        </div>
        <div className="space-y-4 px-4 pt-4">
          <AppEmptyState icon={null} message={loyaltyText.signedOutPointHistoryMessage} />
        </div>
      </section>
    );
  }

  return (
    <section className="pb-6">
      <LoyaltySummary
        title={loyaltyText.memberPointsTitle}
        pointsValue={(demoLoyalty?.totalPoints || userProfile?.points || 0).toLocaleString("vi-VN")}
        subtitle={loyaltyText.memberPointsSubtitle}
        ratioText={`${currencyPerPoint.toLocaleString("vi-VN")}đ = ${pointPerUnit} điểm`}
      />
      <div className="space-y-4 px-4 pt-4">
        <PointsCard rows={getLoyaltySimpleGuestRows(currencyPerPoint, pointPerUnit)} />
        <AppSectionTitle title={loyaltyText.pointsHistoryTitle} />
        <div className="space-y-2">
          {pointHistory.slice(0, 10).map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">
              <span className="block text-brown">{entry.title}</span>
              <strong className="text-orange-600">+{entry.points} điểm</strong>
            </div>
          ))}
          {!pointHistory.length && <AppEmptyState icon={null} message={loyaltyText.noPointHistory} />}
        </div>
      </div>
    </section>
  );
}
