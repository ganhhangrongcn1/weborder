export const LOGIN_RETRY_DELAYS_MS = [30_000, 90_000, 180_000];
export const LOGIN_MIN_INTERVAL_MS = 20_000;
export const LOGIN_JITTER_MS = 10_000;

export function classifyGrabLoginFailure(message, status = 0) {
  const text = String(message || "");
  const httpStatus = Number(status || 0);
  if (httpStatus === 429 || /rate.?limit|too many(?: requests)?/i.test(text)) {
    return "GRAB_RATE_LIMITED";
  }
  if (
    httpStatus === 408
    || httpStatus === 425
    || httpStatus >= 500
    || /email loading strategy .* not supported|temporar(?:y|ily)|try again|service unavailable|internal server error|bad gateway|gateway timeout|upstream|timed? ?out|execution context was destroyed|detached frame|same javascript world|target closed/i.test(text)
  ) {
    return "GRAB_LOGIN_TRANSIENT";
  }
  if (/captcha|otp|mã xác minh|xác minh bổ sung|verification code|one[- ]time password|kiểm tra bảo mật/i.test(text)) {
    return "GRAB_INTERACTIVE_AUTH_REQUIRED";
  }
  return "GRAB_LOGIN_FAILED";
}

export function isRetryableGrabLoginFailure(code) {
  return code === "GRAB_RATE_LIMITED" || code === "GRAB_LOGIN_TRANSIENT";
}

export function loginSpacingMs(randomValue = Math.random()) {
  const normalized = Math.min(Math.max(Number(randomValue) || 0, 0), 0.999999999);
  return LOGIN_MIN_INTERVAL_MS + Math.floor(normalized * (LOGIN_JITTER_MS + 1));
}

export function isTransientBrowserFailure(message) {
  return /detached frame|same javascript world|execution context was destroyed|target closed|navigation failed because browser has disconnected/i.test(String(message || ""));
}
