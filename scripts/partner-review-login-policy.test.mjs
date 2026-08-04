import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGrabLoginFailure,
  isRetryableGrabLoginFailure,
  isTransientBrowserFailure,
  loginSpacingMs
} from "./partner-review-login-policy.mjs";

test("thử lại khi Grab giới hạn đăng nhập", () => {
  assert.equal(classifyGrabLoginFailure("Too many requests", 429), "GRAB_RATE_LIMITED");
  assert.equal(isRetryableGrabLoginFailure("GRAB_RATE_LIMITED"), true);
});

test("thử lại lỗi đăng nhập tạm thời của Grab", () => {
  const message = "email loading strategy FromMexProfileService not supported";
  assert.equal(classifyGrabLoginFailure(message, 200), "GRAB_LOGIN_TRANSIENT");
  assert.equal(isRetryableGrabLoginFailure("GRAB_LOGIN_TRANSIENT"), true);
});

test("không thử lại liên tục khi thông tin đăng nhập sai", () => {
  assert.equal(classifyGrabLoginFailure("Invalid username or password", 400), "GRAB_LOGIN_FAILED");
  assert.equal(isRetryableGrabLoginFailure("GRAB_LOGIN_FAILED"), false);
});

test("nhận diện trường hợp cần xác minh trực tiếp", () => {
  assert.equal(classifyGrabLoginFailure("Grab yêu cầu mã OTP"), "GRAB_INTERACTIVE_AUTH_REQUIRED");
});

test("khoảng giãn đăng nhập nằm trong 20 đến 30 giây", () => {
  assert.equal(loginSpacingMs(0), 20_000);
  assert.equal(loginSpacingMs(1), 30_000);
});

test("nhận diện lỗi trình duyệt đổi ngữ cảnh", () => {
  assert.equal(isTransientBrowserFailure("Execution context was destroyed"), true);
  assert.equal(isTransientBrowserFailure("Invalid username or password"), false);
});
