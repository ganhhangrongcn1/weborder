import useLoyaltyViewModel from "./hooks/useLoyaltyViewModel.js";
import SimpleRewardsView from "./components/SimpleRewardsView.js";
import GuestLoyaltyView from "./components/GuestLoyaltyView.js";
import MemberLoyaltyView from "./components/MemberLoyaltyView.js";
import { getLoyaltyBonusDisplay } from "../../services/loyaltyConfigService.js";
import { jsx as _jsx } from "react/jsx-runtime";
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
    return /*#__PURE__*/_jsx(SimpleRewardsView, {
      navigate: navigate,
      isRegisteredCustomer: isRegisteredCustomer,
      currencyPerPoint: vm.currencyPerPoint,
      pointPerUnit: vm.pointPerUnit,
      demoLoyalty: demoLoyalty,
      userProfile: userProfile
    });
  }
  if (!canUseMemberLoyalty) {
    return /*#__PURE__*/_jsx(GuestLoyaltyView, {
      navigate: navigate,
      loyaltyBonusDisplay: getLoyaltyBonusDisplay()
    });
  }
  return /*#__PURE__*/_jsx(MemberLoyaltyView, {
    loyalty: vm.loyalty,
    userProfile: userProfile,
    luckyVoucher: vm.luckyVoucher,
    setLuckyVoucher: vm.setLuckyVoucher,
    today: vm.today,
    checkedInToday: vm.checkedInToday,
    comebackStreak: vm.comebackStreak,
    comebackActive: vm.comebackActive,
    checkinReward: vm.checkinReward,
    nextMilestone: vm.nextMilestone,
    progressPercent: vm.progressPercent,
    recentDays: vm.recentDays,
    handleCheckin: vm.handleCheckin
  });
}