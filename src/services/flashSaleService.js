function parseFlashTimeToMinutes(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const matched = rawValue.match(/^(\d{1,2})[:h](\d{2})(?:\s*(SA|AM|CH|PM))?$/i);
  if (!matched) return null;

  let hour = Number(matched[1]);
  const minute = Number(matched[2]);
  const period = String(matched[3] || "").toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  if (period === "CH" || period === "PM") {
    if (hour < 12) hour += 12;
  }
  if ((period === "SA" || period === "AM") && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function formatMinutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseFlashDateOnly(dateValue, endOfDay = false) {
  if (!dateValue) return null;
  const time = endOfDay ? "23:59:59" : "00:00:00";
  const date = new Date(`${dateValue}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFlashDateTime(dateValue, timeValue, fallbackTime = "00:00") {
  if (!dateValue) return null;
  const timeMinutes = parseFlashTimeToMinutes(timeValue || fallbackTime);
  if (timeMinutes === null) return null;

  const date = new Date(`${dateValue}T${formatMinutesToTime(timeMinutes)}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasFlashSaleSlots(promo = {}) {
  const sold = Number(promo?.condition?.soldCount || 0);
  const total = Number(promo?.condition?.totalSlots || 0);
  return total <= 0 || sold < total;
}

export function isFlashSaleDateActive(promo = {}, now = new Date()) {
  const startDate = parseFlashDateOnly(promo?.startAt);
  const endDate = parseFlashDateOnly(promo?.endAt, true);
  const nowTime = now.getTime();

  if (startDate && nowTime < startDate.getTime()) return false;
  if (endDate && nowTime > endDate.getTime()) return false;
  return true;
}

export function isFlashSaleTimeActive(promo = {}, now = new Date()) {
  const startMinutes = parseFlashTimeToMinutes(promo?.condition?.startTime || "00:00");
  const endMinutes = parseFlashTimeToMinutes(promo?.condition?.endTime || "23:59");
  if (startMinutes === null || endMinutes === null) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function isFlashSaleActiveNow(promo = {}, now = new Date()) {
  if (promo?.type !== "flash_sale") return false;
  if (promo?.active === false) return false;
  if (!hasFlashSaleSlots(promo)) return false;
  if (!isFlashSaleDateActive(promo, now)) return false;
  return isFlashSaleTimeActive(promo, now);
}

export function getActiveFlashSalePromotions(promotions = [], now = new Date()) {
  return [...(promotions || [])]
    .filter((promo) => isFlashSaleActiveNow(promo, now))
    .sort((first, second) => Number(first?.priority || 99) - Number(second?.priority || 99));
}

export function getFlashSaleEndDate(promo = {}, now = new Date()) {
  const startMinutes = parseFlashTimeToMinutes(promo?.condition?.startTime || "00:00");
  const endMinutes = parseFlashTimeToMinutes(promo?.condition?.endTime || "23:59");
  if (startMinutes === null || endMinutes === null) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endDateKey = startMinutes > endMinutes && currentMinutes >= startMinutes
    ? getDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    : getDateKey(now);

  return parseFlashDateTime(endDateKey, formatMinutesToTime(endMinutes), "23:59");
}
