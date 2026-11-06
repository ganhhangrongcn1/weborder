import CustomerControl from "../../../components/customer/CustomerControl.jsx";
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

export default function CheckinCard({ loyalty, loyaltyRule, checkedInToday, comebackStreak, comebackActive, checkinReward, nextMilestone, handleCheckin, onOpenDetails, canCheckin = true, checkinAuthNotice = "", checkinPending = false, checkinFeedback = null }) {
  const streak = Math.max(0, Number(loyalty?.checkinStreak || 0));
  const rewards = getConfiguredCheckinRewards(loyaltyRule);
  const milestones = [{ days: 0, points: 0 }, ...rewards];
  const history = Array.isArray(loyalty?.rewardHistory) ? loyalty.rewardHistory : [];
  const nextIndex = milestones.findIndex((milestone) => milestone.days > streak);
  const segment = nextIndex < 0 ? milestones.length - 1 : Math.max(0, nextIndex - 1);
  const start = milestones[segment]?.days || 0;
  const end = milestones[segment + 1]?.days;
  const fraction = end ? Math.min(1, (streak - start) / (end - start)) : 0;
  const progress = milestones.length > 1 ? Math.min(100, (segment + fraction) / (milestones.length - 1) * 100) : 0;
  return <CustomerCard className="checkin-card checkin-card--direct">
    <header className="checkin-direct-head"><span className="checkin-direct-icon"><Icon name="gift" size={20} weight="regular" /></span><div><h2>Điểm danh nhận quà</h2><p>Chuỗi hiện tại <strong>{streak} ngày</strong></p></div>{checkedInToday && <span className="checkin-done-label">Đã điểm danh</span>}</header>
    {comebackActive && <p className="checkin-direct-notice">{getLoyaltyText().comebackAlert(comebackStreak)}</p>}
    <div className="checkin-milestones" style={{ "--checkin-count": milestones.length, "--checkin-progress": progress + "%" }}>
      <div className="checkin-milestones__track" role="progressbar" aria-label="Tiến độ chuỗi điểm danh" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span /></div>
      <ol aria-label="Các mốc thưởng điểm danh">{milestones.map((milestone, index) => {
        const reached = streak >= milestone.days;
        const received = milestone.days > 0 && history.includes("milestone-" + milestone.days);
        return <li key={milestone.days} className={reached ? "is-reached" : ""} aria-current={index === segment ? "step" : undefined}><span className="checkin-milestones__dot" /><strong>{milestone.days ? milestone.days + " ngày" : "Bắt đầu"}</strong><small>{milestone.points ? "+" + milestone.points.toLocaleString("vi-VN") : "Tích mỗi ngày"}</small>{received && <em>Đã nhận</em>}</li>;
      })}</ol>
    </div>
    {nextMilestone && <p className="checkin-next-reward">Còn <strong>{Math.max(0, nextMilestone.days - streak)} ngày</strong> nhận thêm <strong>+{Number(nextMilestone.points).toLocaleString("vi-VN")} điểm</strong></p>}
    <CustomerButton disabled={checkedInToday || !canCheckin || checkinPending} aria-busy={checkinPending} onClick={handleCheckin} full className="checkin-direct-submit">{checkinPending ? "Đang ghi nhận…" : checkedInToday ? "Hôm nay đã nhận điểm" : !canCheckin ? "Đăng nhập lại để điểm danh" : "Điểm danh · +" + Number(checkinReward || 0).toLocaleString("vi-VN") + " điểm"}</CustomerButton>
    {checkinFeedback && <p className={`checkin-feedback checkin-feedback--${checkinFeedback.type}`} role={checkinFeedback.type === "error" ? "alert" : "status"}><Icon name={checkinFeedback.type === "error" ? "warning" : "check"} size={17} /><span>{checkinFeedback.message}</span></p>}
    {!checkedInToday && !canCheckin && checkinAuthNotice && <p className="checkin-direct-notice">{checkinAuthNotice}</p>}
    {onOpenDetails && <CustomerControl type="button" className="checkin-direct-details" onClick={onOpenDetails}>Lịch sử & phần thưởng <Icon name="back" size={14} /></CustomerControl>}
  </CustomerCard>;
}

export function CheckinDetails({ loyalty, loyaltyRule, today, recentDays }) {
  const loyaltyBonusDisplay = getConfiguredCheckinRewards(loyaltyRule);
  const receivedRewards = Array.isArray(loyalty?.rewardHistory) ? loyalty.rewardHistory : [];
  const streak = Math.max(0, Number(loyalty?.checkinStreak) || 0);
  const nextReward = loyaltyBonusDisplay.find(reward => reward.days > streak);

  return (
    <div className="loyalty-checkin-details">
      <section>
        <h3>Quà theo chuỗi điểm danh</h3>
        <p className="checkin-chain-summary">Chuỗi hiện tại <strong>{streak} ngày liên tiếp</strong></p>
        <ol className="checkin-reward-timeline">
          {loyaltyBonusDisplay.map((reward) => {
            const received = receivedRewards.includes(`milestone-${reward.days}`);
            return (
              <li key={reward.days} className={received || streak >= reward.days ? "is-reached" : ""} aria-current={nextReward?.days === reward.days ? "step" : undefined}>
                <span className="checkin-reward-timeline__dot">{received || streak >= reward.days ? <Icon name="check" size={14} /> : <Icon name="gift" size={14} />}</span>
                <span>Ngày {reward.days}</span>
                <strong>+{reward.points.toLocaleString("vi-VN")}</strong>
                <small>điểm</small>
                {(received || streak >= reward.days) && <em>{received ? "Đã nhận" : "Đã đủ mốc"}</em>}
              </li>
            );
          })}
        </ol>
        {nextReward ? <p className="checkin-chain-next">Điểm danh thêm <strong>{nextReward.days - streak} ngày liên tiếp</strong> để nhận <strong>+{nextReward.points.toLocaleString("vi-VN")} điểm</strong>.</p> : <p className="checkin-chain-next">Bạn đã đạt tất cả mốc quà trong chuỗi này.</p>}
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
