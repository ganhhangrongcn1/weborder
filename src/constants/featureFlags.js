export const rewardFeatureFlags = {
  enableWelcomeVoucher: true,
  enableCheckIn: true,
  enableLuckyDraw: false,
  enableComebackReward: false,
  enableMilestoneReward: true,
  enableCustomerTier: false
};

export const orderingFeatureFlags = {
  enableQrCounterOrdering: false
};

// Only controls Admin settings visibility; existing voucher rules remain intact.
export const adminFeatureFlags = {
  showLoyaltyVoucherSettings: false
};
