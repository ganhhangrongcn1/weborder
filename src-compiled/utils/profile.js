import { defaultUserProfile } from "../data/defaultData.js";

export function getMemberRank(totalSpent) {
  if (totalSpent >= 3000000) return "VIP";
  if (totalSpent >= 1500000) return "Gold";
  if (totalSpent >= 500000) return "Silver";
  return "Member";
}

export function normalizeUserProfile(profile) {
  return {
    ...defaultUserProfile,
    ...profile,
    addresses: profile?.addresses?.length ? profile.addresses : defaultUserProfile.addresses,
    orderHistory: profile?.orderHistory || [],
    pointHistory: profile?.pointHistory || [],
    vouchers: profile?.vouchers?.length ? profile.vouchers : defaultUserProfile.vouchers,
    checkinStreak: profile?.checkinStreak ?? defaultUserProfile.checkinStreak,
    memberRank: getMemberRank(profile?.totalSpent || 0)
  };
}
