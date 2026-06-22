import { useEffect, useMemo, useRef, useState } from "react";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";
import { loyaltyByPhoneStorage, loyaltyStorage, normalizeLoyaltyData } from "../../../services/loyaltyService.js";
import { buildCheckinIdempotencyKey } from "../../../services/loyaltyRuntimeService.js";
import { loyaltyRepository } from "../../../services/repositories/loyaltyRepository.js";
import { buildLoyaltyTierJourney } from "../../../services/loyaltyProgramConfigService.js";
import {
  getDateKey,
  getTodayKey,
  isYesterday,
  generateLuckyVoucher
} from "../../../utils/pureHelpers.js";

const DEFAULT_LOYALTY_RULE = {
  currencyPerPoint: 100,
  pointPerUnit: 10,
  checkinDailyPoints: 100,
  streakRewards: {
    7: 700,
    14: 1500,
    30: 3000
  },
  redeemPointUnit: 1,
  redeemValue: 1,
  maxRedemptionPercent: 50
};

function getStreakRewards(loyaltyRule) {
  const source = loyaltyRule?.streakRewards || {};
  const rows = [7, 14, 30]
    .map((days) => ({
      id: `milestone-${days}`,
      days,
      points: Math.max(1, Number(source?.[days] || source?.[String(days)] || 0))
    }))
    .filter((item) => item.points > 0)
    .sort((a, b) => a.days - b.days);
  return rows.length ? rows : [
    { id: "milestone-7", days: 7, points: 700 },
    { id: "milestone-14", days: 14, points: 1500 },
    { id: "milestone-30", days: 30, points: 3000 }
  ];
}

function getDailyRewardByRule(loyaltyRule) {
  return Math.max(1, Number(loyaltyRule?.checkinDailyPoints || 100));
}

function getNextMilestoneByRule(streak, loyaltyRule) {
  const rewards = getStreakRewards(loyaltyRule);
  return rewards.find((item) => streak < item.days) || null;
}

function checkMilestoneReward(streak, rewardHistory, loyaltyRule) {
  return getStreakRewards(loyaltyRule).filter((milestone) => streak >= milestone.days && !rewardHistory.includes(milestone.id));
}

export default function useLoyaltyViewModel({
  userProfile,
  setUserProfile,
  demoLoyalty,
  setDemoLoyalty,
  currentPhone,
  isRegisteredCustomer,
  hasCustomerAuthSession,
  requiresCustomerAuthSession
}) {
  const setDemoLoyaltyRef = useRef(setDemoLoyalty);
  const setUserProfileRef = useRef(setUserProfile);
  const hydrateRequestIdRef = useRef(0);

  useEffect(() => {
    setDemoLoyaltyRef.current = setDemoLoyalty;
  }, [setDemoLoyalty]);

  useEffect(() => {
    setUserProfileRef.current = setUserProfile;
  }, [setUserProfile]);

  const simpleRewardsMode = !rewardFeatureFlags.enableCheckIn && !rewardFeatureFlags.enableLuckyDraw && !rewardFeatureFlags.enableComebackReward && !rewardFeatureFlags.enableMilestoneReward;
  const [loyaltyRule, setLoyaltyRule] = useState(() => loyaltyRepository.getLoyaltyRule(DEFAULT_LOYALTY_RULE));
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || DEFAULT_LOYALTY_RULE.currencyPerPoint));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 10));

  const [loyalty, setLoyalty] = useState(() => {
    const saved = normalizeLoyaltyData(
      currentPhone
        ? (demoLoyalty || defaultResetLoyalty())
        : (demoLoyalty || loyaltyStorage.get())
    );
    if (saved.totalPoints > 0 || saved.checkinHistory.length) return saved;
    return loyaltyStorage.save({
      ...saved,
      totalPoints: userProfile.points || 0,
      checkinStreak: userProfile.checkinStreak || 0
    });
  });
  const [luckyVoucher, setLuckyVoucher] = useState(null);

  useEffect(() => {
    let active = true;

    async function hydrateLoyaltyRule() {
      try {
        const remoteRule = await loyaltyRepository.getLoyaltyRuleAsync(DEFAULT_LOYALTY_RULE);
        if (!active || !remoteRule) return;
        setLoyaltyRule({
          ...DEFAULT_LOYALTY_RULE,
          ...remoteRule,
          streakRewards: {
            ...DEFAULT_LOYALTY_RULE.streakRewards,
            ...(remoteRule.streakRewards || {})
          }
        });
      } catch {
      }
    }

    hydrateLoyaltyRule();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = ++hydrateRequestIdRef.current;

    async function hydrateLoyaltyFromSource() {
      if (!currentPhone) return;
      const remoteFirst = await loyaltyRepository.getByPhoneAsync(currentPhone, {
        ...normalizeLoyaltyData(defaultResetLoyalty()),
        totalPoints: Number(userProfile?.points || 0),
        checkinStreak: Number(userProfile?.checkinStreak || 0)
      });
      if (!active || requestId !== hydrateRequestIdRef.current) return;
      const normalized = normalizeLoyaltyData(remoteFirst);
      setLoyalty(normalized);
      if (setDemoLoyaltyRef.current) setDemoLoyaltyRef.current(normalized);
      if (setUserProfileRef.current) {
        setUserProfileRef.current((profile) => ({
          ...profile,
          points: Number(normalized.totalPoints || 0),
          checkinStreak: Number(normalized.checkinStreak || 0),
          pointHistory: Array.isArray(normalized.pointHistory) ? normalized.pointHistory : profile.pointHistory
        }));
      }
    }

    hydrateLoyaltyFromSource();
    return () => {
      active = false;
    };
  }, [currentPhone, userProfile?.checkinStreak, userProfile?.points]);

  const today = getTodayKey();
  const checkedInToday = loyalty.lastCheckinDate === today;
  const streakWillBreak = loyalty.lastCheckinDate && loyalty.lastCheckinDate !== today && !isYesterday(loyalty.lastCheckinDate);
  const comebackStreak = streakWillBreak ? loyalty.checkinStreak : loyalty.lastMissedStreak;
  const comebackActive = !checkedInToday && comebackStreak >= 3 && loyalty.comebackUsedDate !== today;
  const dailyReward = getDailyRewardByRule(loyaltyRule);
  const checkinReward = comebackActive ? dailyReward * 2 : dailyReward;
  const nextMilestone = getNextMilestoneByRule(loyalty.checkinStreak, loyaltyRule);
  const topMilestone = getStreakRewards(loyaltyRule).slice(-1)[0];
  const progressBaseDays = nextMilestone?.days || topMilestone?.days || 30;
  const progressPercent = progressBaseDays ? Math.min(loyalty.checkinStreak / progressBaseDays * 100, 100) : 100;
  const recentDays = Array.from({
    length: 7
  }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return getDateKey(date);
  });
  const tierJourney = useMemo(
    () => buildLoyaltyTierJourney(loyalty, loyaltyRule),
    [loyalty, loyaltyRule]
  );

  function saveLoyalty(nextData) {
    const normalized = normalizeLoyaltyData(nextData);
    const saved = currentPhone
      ? loyaltyByPhoneStorage.saveByPhone(currentPhone, normalized)
      : loyaltyStorage.save(normalized);
    setLoyalty(saved);
    if (setDemoLoyalty) setDemoLoyalty(saved);
    return saved;
  }

  async function handleCheckin() {
    if (checkedInToday) return;
    const canUseLocalMemberCheckin = Boolean(currentPhone || isRegisteredCustomer);
    const shouldUseProtectedCheckin = Boolean(currentPhone) && requiresCustomerAuthSession;
    if (shouldUseProtectedCheckin && !hasCustomerAuthSession) {
      alert("Phiên đăng nhập thành viên đã hết. Anh đăng xuất rồi đăng nhập lại giúp em 1 lần để điểm danh nhé.");
      return;
    }
    if (!canUseLocalMemberCheckin && !shouldUseProtectedCheckin) return;
    const brokeChain = loyalty.lastCheckinDate && !isYesterday(loyalty.lastCheckinDate);
    const baseRewardHistory = brokeChain ? [] : loyalty.rewardHistory;
    const missedStreak = brokeChain ? loyalty.checkinStreak : loyalty.lastMissedStreak;
    const newStreak = brokeChain ? 1 : isYesterday(loyalty.lastCheckinDate) ? loyalty.checkinStreak + 1 : 1;
    const basePoints = getDailyRewardByRule(loyaltyRule);
    const useComeback = missedStreak >= 3 && loyalty.comebackUsedDate !== today;
    const checkinPoints = useComeback ? basePoints * 2 : basePoints;
    const milestoneRewards = checkMilestoneReward(newStreak, baseRewardHistory, loyaltyRule);
    const milestonePoints = milestoneRewards.reduce((sum, reward) => sum + reward.points, 0);
    const voucher = rewardFeatureFlags.enableLuckyDraw ? generateLuckyVoucher() : null;
    const totalEarned = checkinPoints + milestonePoints;
    const pointEntries = [{
      id: `checkin-${Date.now()}`,
      type: "CHECKIN",
      title: useComeback ? "Điểm danh comeback x2" : "Điểm danh hằng ngày",
      points: checkinPoints,
      createdAt: new Date().toISOString()
    }, ...milestoneRewards.map((reward) => ({
      id: `reward-${reward.id}-${Date.now()}`,
      type: "MILESTONE",
      title: `Thưởng chuỗi ${reward.days} ngày`,
      points: reward.points,
      createdAt: new Date().toISOString()
    }))];
    const nextData = {
      ...loyalty,
      totalPoints: loyalty.totalPoints + totalEarned,
      lastCheckinDate: today,
      checkinStreak: newStreak,
      checkinHistory: Array.from(new Set([...loyalty.checkinHistory, today])),
      rewardHistory: [...baseRewardHistory, ...milestoneRewards.map((reward) => reward.id)],
      pointHistory: [...pointEntries, ...(loyalty.pointHistory || [])],
      voucherHistory: voucher ? [voucher, ...loyalty.voucherHistory] : loyalty.voucherHistory,
      lastMissedStreak: missedStreak,
      comebackUsedDate: useComeback ? today : loyalty.comebackUsedDate
    };

    if (shouldUseProtectedCheckin) {
      try {
        const normalizedRemote = normalizeLoyaltyData(
          await loyaltyRepository.processCheckinByPhoneAsync(
            currentPhone,
            { idempotencyKey: buildCheckinIdempotencyKey(today) },
            defaultResetLoyalty(),
            { throwOnError: true }
          )
        );
        setLoyalty(normalizedRemote);
        if (setDemoLoyalty) setDemoLoyalty(normalizedRemote);
        if (setUserProfile) {
          setUserProfile((profile) => ({
            ...profile,
            points: Number(normalizedRemote.totalPoints || 0),
            checkinStreak: Number(normalizedRemote.checkinStreak || 0),
            pointHistory: Array.isArray(normalizedRemote.pointHistory) ? normalizedRemote.pointHistory : profile.pointHistory
          }));
        }
        if (voucher) setLuckyVoucher(voucher);
        return;
      } catch (error) {
        console.error("[loyalty] processCheckinByPhoneAsync failed", error);
        alert(error?.message || "Điểm danh chưa thành công. Anh đăng xuất rồi đăng nhập lại giúp em 1 lần nhé.");
        return;
      }
    }

    saveLoyalty(nextData);
    setUserProfile((profile) => ({
      ...profile,
      points: Number(profile?.points || 0) + totalEarned,
      checkinStreak: newStreak,
      pointHistory: [...pointEntries, ...(Array.isArray(profile?.pointHistory) ? profile.pointHistory : [])]
    }));
    if (voucher) setLuckyVoucher(voucher);
  }

  function resetDemo() {
    const reset = currentPhone
      ? loyaltyByPhoneStorage.saveByPhone(currentPhone, defaultResetLoyalty())
      : loyaltyStorage.reset();
    setLoyalty(reset);
    if (setDemoLoyalty) setDemoLoyalty(reset);
    setLuckyVoucher(null);
  }

  function defaultResetLoyalty() {
    return normalizeLoyaltyData({
      totalPoints: 0,
      lastCheckinDate: null,
      checkinStreak: 0,
      checkinHistory: [],
      pointHistory: [],
      rewardHistory: [],
      voucherHistory: [],
      lastMissedStreak: 0,
      comebackUsedDate: null
    });
  }

  return {
    simpleRewardsMode,
    loyaltyRule,
    currencyPerPoint,
    pointPerUnit,
    loyalty,
    tierJourney,
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
    resetDemo
  };
}
