import useLoyaltyViewModel from "./hooks/useLoyaltyViewModel.js";
import SimpleRewardsView from "./components/SimpleRewardsView.jsx";
import GuestLoyaltyView from "./components/GuestLoyaltyView.jsx";
import MemberLoyaltyView from "./components/MemberLoyaltyView.jsx";
import { getLoyaltyBonusDisplay } from "../../services/loyaltyConfigService.js";

export default function Loyalty(props) {
  const {
    navigate,
    userProfile,
    setUserProfile,
    demoLoyalty,
    setDemoLoyalty,
    isRegisteredCustomer,
    hasCustomerAuthSession,
    requiresCustomerAuthSession,
    currentPhone
  } = props;

  const vm = useLoyaltyViewModel({
    userProfile,
    setUserProfile,
    demoLoyalty,
    setDemoLoyalty,
    currentPhone,
    isRegisteredCustomer,
    hasCustomerAuthSession,
    requiresCustomerAuthSession
  });
  const canUseMemberLoyalty = Boolean(currentPhone || isRegisteredCustomer);
  const canUseProtectedLoyaltyAction = requiresCustomerAuthSession
    ? Boolean(currentPhone && hasCustomerAuthSession)
    : canUseMemberLoyalty;

  if (vm.simpleRewardsMode) {
    return (
      <SimpleRewardsView
        navigate={navigate}
        isRegisteredCustomer={isRegisteredCustomer}
        currencyPerPoint={vm.currencyPerPoint}
        pointPerUnit={vm.pointPerUnit}
        demoLoyalty={demoLoyalty}
        userProfile={userProfile}
      />
    );
  }

  if (!canUseMemberLoyalty) {
    return (
      <GuestLoyaltyView
        navigate={navigate}
        loyaltyBonusDisplay={getLoyaltyBonusDisplay()}
        loyaltyRule={vm.loyaltyRule}
      />
    );
  }

  return (
    <MemberLoyaltyView
      navigate={navigate}
      loyaltyRule={vm.loyaltyRule}
      loyalty={vm.loyalty}
      isLoyaltyReady={vm.isLoyaltyReady}
      tierJourney={vm.tierJourney}
      currentPhone={currentPhone}
      userProfile={userProfile}
      luckyVoucher={vm.luckyVoucher}
      setLuckyVoucher={vm.setLuckyVoucher}
      today={vm.today}
      checkedInToday={vm.checkedInToday}
      comebackStreak={vm.comebackStreak}
      comebackActive={vm.comebackActive}
      checkinReward={vm.checkinReward}
      nextMilestone={vm.nextMilestone}
      progressPercent={vm.progressPercent}
      recentDays={vm.recentDays}
      handleCheckin={vm.handleCheckin}
      canCheckin={canUseProtectedLoyaltyAction}
      checkinAuthNotice={
        requiresCustomerAuthSession && !canUseProtectedLoyaltyAction
          ? "Phiên đăng nhập thành viên đã hết. Anh đăng nhập lại để điểm danh và dùng các thao tác tích điểm nhé."
          : ""
      }
    />
  );
}
