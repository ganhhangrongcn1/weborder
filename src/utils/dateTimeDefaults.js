export function getTodayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNearestPickupClock(stepMinutes = 15) {
  const safeStep = Math.max(5, Number(stepMinutes || 15));
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMinutes / safeStep) * safeStep;
  const hour = Math.floor((rounded % (24 * 60)) / 60);
  const minute = rounded % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizePickupDate(value = "") {
  const today = getTodayInputDate();
  const dateText = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return today;
  return dateText < today ? today : dateText;
}

export function normalizePickupClock(value = "") {
  const clockText = String(value || "").trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(clockText)) return getNearestPickupClock();

  const [hour, minute] = clockText.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return getNearestPickupClock();

  return clockText;
}

export function getBranchOpenClose(branch = {}) {
  const defaultOpen = "09:00";
  const defaultClose = "21:00";
  if (branch?.openTime && branch?.closeTime) {
    return {
      open: normalizePickupClock(branch.openTime),
      close: normalizePickupClock(branch.closeTime)
    };
  }

  const matched = String(branch?.time || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!matched) return { open: defaultOpen, close: defaultClose };

  return {
    open: normalizePickupClock(matched[1]),
    close: normalizePickupClock(matched[2])
  };
}

export function getClockMinutes(value = "") {
  const clockText = normalizePickupClock(value);
  const [hour, minute] = clockText.split(":").map(Number);
  return hour * 60 + minute;
}

export function isPickupClockInBranchHours(clock = "", branch = {}) {
  const { open, close } = getBranchOpenClose(branch);
  const current = getClockMinutes(clock);
  return current >= getClockMinutes(open) && current <= getClockMinutes(close);
}

export function parsePickupTimeText(value = "") {
  const text = String(value || "").trim();
  const matched = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!matched) {
    return {
      scheduled: false,
      text
    };
  }

  const clock = normalizePickupClock(matched[1]);
  const date = matched[2];
  const dateTime = new Date(`${date}T${clock}:00`);

  return {
    scheduled: !Number.isNaN(dateTime.getTime()),
    clock,
    date,
    dateTime,
    text
  };
}

export function formatPickupCountdown(value = "", now = new Date()) {
  const pickup = parsePickupTimeText(value);
  if (!pickup.scheduled) return "";

  const diffMinutes = Math.ceil((pickup.dateTime.getTime() - now.getTime()) / 60000);
  if (diffMinutes > 0) return `Còn ${diffMinutes} phút`;
  if (diffMinutes === 0) return "Đã tới giờ lấy";
  return `Trễ ${Math.abs(diffMinutes)} phút`;
}

export function getScheduledPickupTone(value = "", now = new Date()) {
  const pickup = parsePickupTimeText(value);
  if (!pickup.scheduled) return "none";
  const diffMinutes = Math.ceil((pickup.dateTime.getTime() - now.getTime()) / 60000);
  if (diffMinutes > 25) return "waiting";
  if (diffMinutes > 0) return "soon";
  return "due";
}
