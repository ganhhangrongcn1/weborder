import Icon from "../../../components/Icon.jsx";
import { getLoyaltyBonusDisplay, getLoyaltyText } from "../../../services/loyaltyConfigService.js";

export default function CheckinCard({
  loyalty,
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
  const loyaltyBonusDisplay = getLoyaltyBonusDisplay();

  return (
    <div className="checkin-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="reward-icon"><Icon name="gift" size={17} /></span>
          <h2>{loyaltyText.checkinTitle}</h2>
        </div>
        <span className="streak-pill">{loyaltyText.streakPrefix} {loyalty.checkinStreak} {loyaltyText.streakUnit}</span>
      </div>

      {comebackActive && (
        <div className="mt-3 rounded-2xl bg-orange-50 px-3 py-3 text-xs font-bold leading-5 text-orange-700">
          {loyaltyText.comebackAlert(comebackStreak)}
        </div>
      )}

      <div className="mt-4 rounded-[22px] bg-cream/80 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-brown/55">
              {nextMilestone ? loyaltyText.milestoneProgress(nextMilestone.days) : loyaltyText.milestoneDone}
            </p>
            <strong className="mt-1 block text-lg text-brown">
              {loyalty.checkinStreak}/{nextMilestone?.days || 30} ngày
            </strong>
          </div>
          <span className="text-sm font-black text-orange-600">{nextMilestone ? `+${nextMilestone.points}` : loyaltyText.milestoneTop}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-gradient-main transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <button disabled={checkedInToday} onClick={handleCheckin} className="checkin-btn">
        {checkedInToday ? loyaltyText.checkedInToday : loyaltyText.checkinReward(checkinReward)}
      </button>

      <div className="checkin-bonus-grid">
        {loyaltyBonusDisplay.map((reward) => {
          const received = loyalty.rewardHistory.includes(`milestone-${reward.days}`);
          const missing = Math.max(reward.days - loyalty.checkinStreak, 0);
          return (
            <div key={reward.days}>
              <span>{reward.days} ngày</span>
              <strong>{received ? loyaltyText.bonusReceived : missing ? loyaltyText.bonusRemaining(missing) : `+${reward.points}`}</strong>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {recentDays.map((day) => {
          const checked = loyalty.checkinHistory.includes(day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`rounded-2xl border px-1 py-2 text-center text-[10px] font-black ${isToday ? "border-orange-400 bg-orange-50 text-orange-600" : "border-brown/5 bg-white text-brown/45"}`}
            >
              <span className="block">{day.slice(5).replace("-", "/")}</span>
              <span className={`mx-auto mt-1 grid h-5 w-5 place-items-center rounded-full ${checked ? "bg-green-500 text-white" : "bg-cream text-brown/30"}`}>
                {checked ? "✓" : "•"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
