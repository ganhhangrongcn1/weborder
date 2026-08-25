import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultInventoryDocumentFilters,
  getInventoryDocumentDateRange,
  getInventoryDocumentDateTimeBounds,
  getInventoryDocumentPagination
} from "../src/services/inventoryDocumentFilters.js";

const referenceDate = new Date("2026-08-25T12:00:00+07:00");

test("mặc định tải 30 ngày gần nhất và 50 phiếu mỗi trang", () => {
  assert.deepEqual(createDefaultInventoryDocumentFilters(referenceDate), {
    datePreset: "30d",
    fromDate: "2026-07-27",
    toDate: "2026-08-25",
    status: "all",
    page: 1,
    pageSize: 50
  });
});

test("các mốc lọc nhanh trả đúng ngày", () => {
  assert.deepEqual(getInventoryDocumentDateRange("today", referenceDate), { fromDate: "2026-08-25", toDate: "2026-08-25" });
  assert.deepEqual(getInventoryDocumentDateRange("7d", referenceDate), { fromDate: "2026-08-19", toDate: "2026-08-25" });
});

test("khoảng ngày dùng múi giờ vận hành UTC+7", () => {
  assert.deepEqual(getInventoryDocumentDateTimeBounds("2026-08-01", "2026-08-25"), {
    fromDate: "2026-08-01",
    toDate: "2026-08-25",
    fromDateTime: "2026-08-01T00:00:00+07:00",
    toDateTime: "2026-08-25T23:59:59.999+07:00"
  });
});

test("phân trang giới hạn tối đa 100 phiếu", () => {
  assert.deepEqual(getInventoryDocumentPagination(3, 50), { page: 3, pageSize: 50, from: 100, to: 149 });
  assert.equal(getInventoryDocumentPagination(1, 500).pageSize, 100);
});
