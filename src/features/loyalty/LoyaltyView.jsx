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
    currentPhone
  } = props;

  const vm = useLoyaltyViewModel({
    userProfile,
    setUserProfile,
    demoLoyalty,
    setDemoLoyalty,
    currentPhone,
    isRegisteredCustomer
  });
  const canUseMemberLoyalty = Boolean(currentPhone || isRegisteredCustomer);

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
    return <GuestLoyaltyView navigate={navigate} loyaltyBonusDisplay={getLoyaltyBonusDisplay()} />;
  }

  return (
    <MemberLoyaltyView
      loyalty={vm.loyalty}
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
    />
  );
}
