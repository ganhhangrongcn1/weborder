// GrabMerchant sends its session JTI as X-Csrf-Token on POST/PUT requests.
// Resolve it from the current URL-scoped cookies each time (tokens can rotate).
export default function grabCsrfHeaders(cookie, method = "GET") {
  const entry = String(cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith("mexusers_authn_token_jti="));
  const token = entry?.slice("mexusers_authn_token_jti=".length) || "";
  if (!token && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    throw Object.assign(new Error("Phiên Grab thiếu mã CSRF; cần đăng nhập lại."), { code: "GRAB_SESSION_EXPIRED" });
  }
  return token ? { "x-csrf-token": token } : {};
}
