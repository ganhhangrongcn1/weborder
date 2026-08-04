import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNextWorkerRun,
  parseWorkerTimestamp,
  resolveWorkerStartupSchedule
} from "./partner-review-schedule-policy.mjs";

const NOW = Date.parse("2026-08-04T08:20:00.000Z");

test("khởi động giữa chu kỳ thì tiếp tục chờ lịch", () => {
  const result = resolveWorkerStartupSchedule("2026-08-04T09:00:00.000Z", NOW);
  assert.equal(result.shouldRun, false);
  assert.equal(result.reason, "waiting");
  assert.equal(result.nextRunAtMs, Date.parse("2026-08-04T09:00:00.000Z"));
});

test("khởi động khi đã quá giờ thì đồng bộ một lần", () => {
  const result = resolveWorkerStartupSchedule("2026-08-04T08:00:00.000Z", NOW);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "due");
});

test("thiếu lịch thì dùng phương án an toàn là đồng bộ một lần", () => {
  const result = resolveWorkerStartupSchedule("", NOW);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "missing_schedule");
});

test("tính lần chạy kế tiếp từ lần hoàn tất gần nhất", () => {
  assert.equal(calculateNextWorkerRun(NOW, 60 * 60_000), Date.parse("2026-08-04T09:20:00.000Z"));
});

test("đọc mốc thời gian không hợp lệ thành không có lịch", () => {
  assert.equal(parseWorkerTimestamp("không hợp lệ"), 0);
});

test("giữ nguyên mốc thời gian dạng số", () => {
  assert.equal(parseWorkerTimestamp(NOW), NOW);
});
