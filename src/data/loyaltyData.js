export const loyaltyMilestoneDefaults = [
  { id: "milestone-79k", days: 7, points: 700 },
  { id: "milestone-freeship", freeshipBased: true, minDays: 8, divisor: 20000, points: 1500 },
  { id: "milestone-secret", days: 30, points: 3000 }
];

export const loyaltyBonusDisplay = [
  { days: 7, points: 700 },
  { days: 14, points: 1500 },
  { days: 30, points: 3000 }
];

export const loyaltyRulesRows = [
  { label: "Tích điểm đơn hàng", value: "100đ = 1 điểm" },
  { label: "Chu kỳ điểm danh", value: "100 / 200 / 500 điểm" },
  { label: "Comeback", value: "x2 điểm ngày trở lại" }
];

export const loyaltySimpleGuestRows = (currencyPerPoint, pointPerUnit) => [
  { label: "Tích điểm đơn hàng", value: `${currencyPerPoint.toLocaleString("vi-VN")}đ = ${pointPerUnit} điểm` },
  { label: "Cộng điểm", value: "Tự động sau đơn hoàn tất" },
  { label: "Admin", value: "Có thể cộng/trừ/reset" }
];

export const loyaltyText = {
  rewardHeroTitle: "Ưu đãi & Điểm thưởng",
  rewardHeroSignedOutTitle: "Ưu đãi & Tích điểm",
  authCta: "Đăng nhập / Tạo tài khoản",
  signedOutMessage: "Đăng nhập để xem điểm",
  signedOutCheckinHint: "Chưa đăng nhập",
  checkinTitle: "Điểm danh",
  checkinLoginHint: "Đăng nhập để điểm danh",
  luckyGiftTitle: "Quà may mắn",
  pointsHistoryTitle: "Lịch sử tích điểm",
  memberPointsTitle: "Điểm thưởng",
  memberPointsSubtitle: "điểm khả dụng",
  ratioPrefix: "Tỷ lệ quy đổi: ",
  ratioFixed: "100đ = 1 điểm",
  signedOutRewardMessage: "Đăng nhập để dùng điểm thưởng và mã giảm giá.",
  signedOutPointHistoryMessage: "Đăng nhập để xem điểm hiện có và lịch sử tích điểm từ đơn hàng.",
  signedOutCheckinDetail: "Đăng nhập để bắt đầu chuỗi điểm danh, nhận điểm mỗi ngày và lưu phần thưởng của bạn.",
  signedOutLuckyMessage: "Đăng nhập để mở quà may mắn và voucher dành riêng cho bạn.",
  signedOutHistoryMessage: "Lịch sử điểm sẽ được lưu sau khi bạn đăng nhập hoặc tạo tài khoản.",
  noPointHistory: "Chưa có lịch sử tích điểm",
  noLuckyGift: "Chưa có quà may mắn",
  streakPrefix: "Chuỗi:",
  streakUnit: "ngày",
  comebackAlert: (days) => `Bạn vừa mất chuỗi ${days} ngày. Hôm nay x2 điểm comeback!`,
  milestoneProgress: (days) => `Tiến trình đến mốc ${days} ngày`,
  milestoneDone: "Bạn đã đạt chuỗi 30 ngày",
  milestoneTop: "Đỉnh rồi!",
  checkedInToday: "Đã điểm danh hôm nay",
  checkinReward: (points) => `Điểm danh nhận +${points} điểm`,
  bonusOpenAfterLogin: "Mở sau đăng nhập",
  bonusReceived: "Đã nhận",
  bonusRemaining: (days) => `Còn ${days} ngày`,
  luckyCongrats: "Chúc mừng!",
  luckyReceive: "Nhận quà",
  luckyReceiveLabel: (title) => `Bạn nhận được ${title}`
};
