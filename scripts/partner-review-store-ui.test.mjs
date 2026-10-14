import assert from "node:assert/strict";
import test from "node:test";
import { isStoreControlSelected } from "../src/pages/admin/partner-reviews/partnerReviewUi.js";

test("pending, running và lỗi không hiển thị như Grab đã xác nhận", () => {
  for (const store_control_status of ["pending", "running", "error", "idle"]) {
    assert.equal(isStoreControlSelected({ store_control_action: "busy", store_control_status }, "busy"), false);
  }
});

test("15 phút chuẩn bị không làm hết hiệu lực hiển thị lệnh đã xác nhận", () => {
  const source = { store_control_action: "busy", store_control_status: "success", store_control_finished_at: "2020-01-01T00:00:00Z" };
  assert.equal(isStoreControlSelected(source, "busy"), true);
  assert.equal(isStoreControlSelected(source, "normal"), false);
});
