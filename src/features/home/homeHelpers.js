export function isTopBannerItem(block) {
  const zone = String(block?.bannerZone || "").toLowerCase();
  const id = String(block?.id || "").toLowerCase();
  const placement = String(block?.placement || "").toLowerCase();
  return zone === "home-hero" || id === "hero" || placement.includes("banner lớn đầu trang");
}

export function parseTimeToMinutes(rawValue) {
  const value = String(rawValue || "").trim().toUpperCase();
  if (!value) return null;
  const matched = value.match(/(\d{1,2})[:h](\d{2})\s*(SA|AM|CH|PM)?/i);
  if (!matched) return null;
  let hour = Number(matched[1]);
  const minute = Number(matched[2]);
  const period = matched[3] || "";
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (period === "CH" || period === "PM") {
    if (hour < 12) hour += 12;
  } else if ((period === "SA" || period === "AM") && hour === 12) {
    hour = 0;
  }
  return hour * 60 + minute;
}

export function extractFirstTime(text) {
  const matched = String(text || "").match(/(\d{1,2}[:h]\d{2}\s*(?:SA|AM|CH|PM)?)/i);
  return matched ? matched[1] : "";
}

export function formatMinutesToLabel(totalMinutes) {
  if (totalMinutes === null || Number.isNaN(totalMinutes)) return "Chưa cập nhật";
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function getBranchHours(branch) {
  const openRaw = branch?.openTime || branch?.open || "";
  const closeRaw = branch?.closeTime || branch?.close || "";
  const openMinutes = parseTimeToMinutes(openRaw);
  const closeMinutes = parseTimeToMinutes(closeRaw);
  if (openMinutes !== null && closeMinutes !== null) {
    return {
      openMinutes,
      closeMinutes,
      label: `${formatMinutesToLabel(openMinutes)} - ${formatMinutesToLabel(closeMinutes)}`
    };
  }
  const rawTimeText = String(branch?.time || "");
  const splitByDash = rawTimeText.split("-");
  const fallbackOpen = parseTimeToMinutes(extractFirstTime(splitByDash[0] || rawTimeText));
  const fallbackClose = parseTimeToMinutes(extractFirstTime(splitByDash[1] || rawTimeText));
  if (fallbackOpen !== null && fallbackClose !== null) {
    return {
      openMinutes: fallbackOpen,
      closeMinutes: fallbackClose,
      label: `${formatMinutesToLabel(fallbackOpen)} - ${formatMinutesToLabel(fallbackClose)}`
    };
  }
  return {
    openMinutes: 540,
    closeMinutes: 1260,
    label: "09:00 - 21:00"
  };
}

export function getClosingSoonText(branch) {
  const { closeMinutes } = getBranchHours(branch);
  if (closeMinutes === null) return "";
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const remaining = closeMinutes - nowMinutes;
  if (remaining <= 0 || remaining > 60) return "";
  return `Sắp đóng cửa sau ${remaining} phút, bạn đặt sớm để quán kịp chuẩn bị nhé.`;
}

export function toIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseDateTime(dateValue, timeValue, fallbackTime = "00:00") {
  if (!dateValue) return null;
  const value = String(timeValue || fallbackTime);
  const date = new Date(`${dateValue}T${value}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function applyRoundMode(value, mode) {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

export function calculateSalePrice(price, promo) {
  const rewardType = promo?.reward?.type;
  const rewardValue = Number(promo?.reward?.value || 0);
  const discountAmount = rewardType === "percent_discount" ? (price * rewardValue) / 100 : rewardValue;
  const rawPrice = Math.max(price - discountAmount, 0);
  const rounded = Math.max(applyRoundMode(rawPrice, promo?.reward?.roundMode), 0);
  return rounded;
}
