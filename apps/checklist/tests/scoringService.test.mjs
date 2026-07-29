import assert from "node:assert/strict";
import test from "node:test";
import { calculateEmployeeCompliance, calculateInspectionScore } from "../src/services/scoringService.js";

test("tính điểm checklist theo trọng số và loại N/A khỏi mẫu số", () => {
  const result = calculateInspectionScore([
    { weight: 20, result: "pass" },
    { weight: 20, result: "improve" },
    { weight: 10, result: "fail" },
    { weight: 50, result: "not_applicable" }
  ]);
  assert.equal(result.score, 60);
  assert.equal(result.applicableWeight, 50);
  assert.equal(result.rating, "Không đạt");
});

test("lỗi nghiêm trọng buộc kết quả không đạt", () => {
  const result = calculateInspectionScore([
    { weight: 95, result: "pass" },
    { weight: 5, result: "fail", isCritical: true }
  ]);
  assert.equal(result.score, 95);
  assert.equal(result.hasCriticalFailure, true);
  assert.equal(result.rating, "Không đạt");
});

test("điểm nhân viên được chuẩn hóa theo số lượt có mặt", () => {
  assert.equal(calculateEmployeeCompliance({ penaltyPoints: 10, inspectedAppearances: 4 }), 87.5);
  assert.equal(calculateEmployeeCompliance({ penaltyPoints: 10, inspectedAppearances: 0 }), null);
});
