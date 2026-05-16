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

