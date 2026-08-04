export function parseWorkerTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function resolveWorkerStartupSchedule(nextRunAt, now = Date.now()) {
  const currentTime = Number(now);
  const nextRunAtMs = parseWorkerTimestamp(nextRunAt);
  if (!nextRunAtMs) {
    return { shouldRun: true, nextRunAtMs: currentTime, reason: "missing_schedule" };
  }
  if (nextRunAtMs <= currentTime) {
    return { shouldRun: true, nextRunAtMs, reason: "due" };
  }
  return { shouldRun: false, nextRunAtMs, reason: "waiting" };
}

export function calculateNextWorkerRun(lastCompletedAt, intervalMs) {
  const completedAt = Number(lastCompletedAt);
  const safeIntervalMs = Math.max(1, Number(intervalMs) || 0);
  return (Number.isFinite(completedAt) ? completedAt : Date.now()) + safeIntervalMs;
}
