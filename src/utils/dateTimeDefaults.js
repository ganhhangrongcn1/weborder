export function getTodayInputDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowInputDate(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getTodayInputDate(tomorrow);
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
  const branchOpen = branch?.openTime || branch?.open;
  const branchClose = branch?.closeTime || branch?.close;
  if (branchOpen && branchClose) {
    return {
      open: normalizePickupClock(String(branchOpen).padStart(5, "0")),
      close: normalizePickupClock(String(branchClose).padStart(5, "0"))
    };
  }

  const matched = String(branch?.time || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!matched) return { open: defaultOpen, close: defaultClose };

  return {
    open: normalizePickupClock(matched[1].padStart(5, "0")),
    close: normalizePickupClock(matched[2].padStart(5, "0"))
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
  const start = getClockMinutes(open);
  const end = getClockMinutes(close);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function isValidPickupSchedule(date, clock, branch, now = new Date()) {
  if (!branch || branch.pickupEnabled === false || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock || "")) return false;
  if (date !== getTodayInputDate(now) && date !== getTomorrowInputDate(now)) return false;
  return new Date(`${date}T${clock}:00`) > now && isPickupClockInBranchHours(clock, branch);
}

export function getNextPickupSchedule(branch, now = new Date()) {
  const { open } = getBranchOpenClose(branch);
  const today = getTodayInputDate(now);
  return {
    pickupMode: "schedule",
    pickupDate: isValidPickupSchedule(today, open, branch, now) ? today : getTomorrowInputDate(now),
    pickupClock: open
  };
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
  if (diffMinutes > 20) return "waiting";
  if (diffMinutes > 0) return "soon";
  return "due";
}
