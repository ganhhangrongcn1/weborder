import Icon from "../../../components/Icon.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";

function getConfiguredCheckinRewards(loyaltyRule = {}) {
  return Object.entries(loyaltyRule?.streakRewards || {})
    .map(([days, points]) => ({
      days: Math.max(1, Math.floor(Number(days || 0))),
      points: Math.max(0, Math.floor(Number(points || 0)))
    }))
    .filter((reward) => reward.days > 0 && reward.points > 0)
    .sort((a, b) => a.days - b.days);
}

function formatCheckinDate(dateKey = "") {
  const [, month = "", day = ""] = String(dateKey || "").split("-");
  return day && month ? `${day}/${month}` : dateKey;
}

export default function CheckinCard({
  loyalty,
  today,
  checkedInToday,
  comebackStreak,
  comebackActive,
  checkinReward,
  nextMilestone,
  progressPercent,
  handleCheckin,
  onOpenDetails,
  canCheckin = true,
  checkinAuthNotice = ""
}) {
  const loyaltyText = getLoyaltyText();

  return (
    <CustomerCard className="checkin-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="reward-icon"><Icon name="gift" size={17} /></span>
          <h2>Ghé Gánh điểm danh</h2>
        </div>
        <span className="streak-pill">Chuỗi vui: {loyalty.checkinStreak} ngày</span>
      </div>

      {comebackActive ? (
        <div className="checkin-notice mt-3 text-xs font-bold leading-5 text-orange-700">
          {loyaltyText.comebackAlert(comebackStreak)}
        </div>
      ) : null}

      <div className="checkin-progress mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-brown/55">
              {nextMilestone
                ? `Còn ${Math.max(nextMilestone.days - loyalty.checkinStreak, 0)} ngày nhận +${nextMilestone.points} điểm`
                : "Bạn đã chinh phục chuỗi cao nhất"}
            </p>
            <strong className="mt-1 block text-lg text-brown">
              {loyalty.checkinStreak}/{nextMilestone?.days || 30} ngày
            </strong>
          </div>
          {!nextMilestone ? (
            <span className="text-sm font-black text-orange-600">{loyaltyText.milestoneTop}</span>
          ) : null}
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-label="Tiến độ chuỗi điểm danh"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(Number(progressPercent || 0))}
        >
          <div className="checkin-progress__bar h-full rounded-full bg-gradient-main" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <CustomerButton disabled={checkedInToday || !canCheckin} onClick={handleCheckin} full className="mt-4">
        {checkedInToday
          ? "Hôm nay bạn đã nhận điểm rồi"
          : !canCheckin
            ? "Đăng nhập lại để điểm danh"
            : `Điểm danh, nhận +${checkinReward} điểm`}
      </CustomerButton>

      {!checkedInToday && !canCheckin && checkinAuthNotice ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-brown/55">
          {checkinAuthNotice}
        </p>
      ) : null}

      {onOpenDetails ? (
        <button type="button" className="loyalty-text-action" onClick={onOpenDetails}>
          Xem lịch quà của bạn <Icon name="back" size={15} />
        </button>
      ) : null}
    </CustomerCard>
  );
}

export function CheckinDetails({ loyalty, loyaltyRule, today, recentDays }) {
  const loyaltyText = getLoyaltyText();
  const loyaltyBonusDisplay = getConfiguredCheckinRewards(loyaltyRule);
  const receivedRewards = Array.isArray(loyalty?.rewardHistory) ? loyalty.rewardHistory : [];

  return (
    <div className="loyalty-checkin-details">
      <section>
        <h3>Quà theo chuỗi điểm danh</h3>
        <div className="checkin-bonus-grid">
          {loyaltyBonusDisplay.map((reward) => {
            const received = receivedRewards.includes(`milestone-${reward.days}`);
            const missing = Math.max(reward.days - loyalty.checkinStreak, 0);

            return (
              <div key={reward.days}>
                <span>{reward.days} ngày</span>
                <strong>
                  {received
                    ? loyaltyText.bonusReceived
                    : missing
                      ? loyaltyText.bonusRemaining(missing)
                      : `+${reward.points}`}
                </strong>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3>7 ngày gần nhất</h3>
        <div className="loyalty-checkin-calendar">
          {recentDays.map((day) => {
            const checked = loyalty.checkinHistory.includes(day);
            const isToday = day === today;

            return (
              <div key={day} className={isToday ? "is-today" : ""}>
                <span>{formatCheckinDate(day)}</span>
                <strong className={checked ? "is-checked" : ""}>{checked ? "✓" : "•"}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
