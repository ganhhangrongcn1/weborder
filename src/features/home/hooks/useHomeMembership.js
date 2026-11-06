import { useEffect, useMemo, useState } from "react";
import { loyaltyRepository } from "../../../services/repositories/loyaltyRepository.js";
import { buildLoyaltyTierJourney, DEFAULT_LOYALTY_PROGRAM_CONFIG } from "../../../services/loyaltyProgramConfigService.js";

export default function useHomeMembership(loyalty = {}, profile = {}, signedIn = false) {
  const [rule,setRule] = useState(()=>loyaltyRepository.getLoyaltyRule(DEFAULT_LOYALTY_PROGRAM_CONFIG));
  useEffect(()=>{
    let alive=true;
    loyaltyRepository.getLoyaltyRuleAsync(DEFAULT_LOYALTY_PROGRAM_CONFIG).then(value=>{if(alive && value)setRule(value);}).catch(()=>{});
    return ()=>{alive=false;};
  },[]);
  const journey = useMemo(()=>buildLoyaltyTierJourney(signedIn ? loyalty : {},rule),[loyalty,rule,signedIn]);
  return {
    signedIn,
    name:signedIn ? String(profile.name || profile.displayName || "Thành viên Gánh") : "Chào bạn",
    avatar:signedIn ? String(profile.avatarUrl || profile.avatar_url || "") : "",
    points:signedIn ? Math.max(0,Number(loyalty.totalPoints || 0)) : null,
    tier:signedIn ? journey.currentTier?.name || "Thành viên" : "Đăng nhập để tích điểm"
  };
}
