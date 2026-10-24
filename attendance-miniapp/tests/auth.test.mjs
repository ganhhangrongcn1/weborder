import test from "node:test";
import assert from "node:assert/strict";
import { actorFromAccount, resolveLoginEmail } from "../src/services/attendanceAuthService.js";
import { validateRemoteState } from "../src/services/attendanceRepository.js";

test("bí danh test chỉ đổi đầu vào đăng nhập, vẫn dùng Supabase Auth", () => {
  assert.equal(resolveLoginEmail(" TEST "), "attendance.test.20261023@example.invalid");
  assert.equal(resolveLoginEmail(" A@Example.com "), "a@example.com");
});

test("quyền thử nghiệm chỉ đến từ dòng được cấp, không từ user metadata", () => {
  const row = { user_id: "test-1", display_name: "An", employee_code: "TN-1", role: "employee", is_active: true };
  assert.equal(actorFromAccount(row, { id: "test-1", email: "test@example.invalid", user_metadata: { role: "manager" } }).role, "employee");
  for (const changed of [null, { ...row, user_id: "other" }, { ...row, is_active: false }, { ...row, role: "manager" }]) {
    assert.throws(() => actorFromAccount(changed, { id: "test-1" }));
  }
});
test("kho dữ liệu từ chối bản ghi tài khoản khác và dữ liệu quá lớn", () => {
  const state = { version: 1, records: [{ employeeId: "test-1" }], requests: [], phones: {} };
  assert.equal(validateRemoteState(state, "test-1"), state);
  assert.throws(() => validateRemoteState(state, "test-2"));
  assert.throws(() => validateRemoteState({ ...state, requests: [{ employeeId: "other" }] }, "test-1"));
  assert.throws(() => validateRemoteState({ ...state, phones: { big: "x".repeat(1024 * 1024) } }, "test-1"));
});
