export const DEMO_PHONE = "0900000001";
const TEST_EMAIL = "attendance.test.20261023@example.invalid";
export function createDemoPhoneLink(now = Date.now()) {
  return { phone: DEMO_PHONE, masked: "*** 0001", linkedAt: now, expiresAt: now + 5 * 60000, simulated: true };
}
export function requireDemoPhoneLink(email, link, now = Date.now()) {
  if (email !== TEST_EMAIL || !link?.simulated || link.phone !== DEMO_PHONE
    || !Number.isFinite(link.linkedAt) || link.linkedAt > now || !Number.isFinite(link.expiresAt)
    || link.expiresAt <= now || link.expiresAt - link.linkedAt !== 5 * 60000) {
    throw new Error("Vui lòng liên kết lại số điện thoại trước khi đăng nhập.");
  }
  return { masked: "SĐT liên kết · *** 0001", simulated: true };
}
