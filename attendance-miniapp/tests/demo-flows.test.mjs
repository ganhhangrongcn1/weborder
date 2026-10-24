import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPhoneLink, requireDemoPhoneLink } from "../src/services/demoPhoneService.js";
import { isZalo, locate, scanQr, linkPhone } from "../src/services/deviceService.js";

test("liên kết điện thoại mẫu bắt buộc đúng tài khoản, còn hạn và có sự đồng ý", () => {
  const now = 1792740000000; const email = "attendance.test.20261023@example.invalid";
  const link = createDemoPhoneLink(now);
  assert.equal(requireDemoPhoneLink(email, link, now + 10).simulated, true);
  for (const [account, value, time] of [[email, null, now], ["other@example.invalid", link, now],
    [email, { ...link, phone: "0900000002" }, now], [email, link, now + 300000], [email, link, now - 1]]) {
    assert.throws(() => requireDemoPhoneLink(account, value, time));
  }
});
test("bản demo không vào nhánh API Zalo dù host đang là Zalo", async () => {
  const oldWindow=globalThis.window; const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
  globalThis.window={location:{hostname:"h5.zdn.vn"},APP_ID:"2442731166050783503"};
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:{userAgent:"Zalo"}});
  try {
    assert.equal(isZalo(),false);
    assert.equal((await locate(true)).simulated,true);
    assert.match(await scanQr(true),/GHR-ATTENDANCE/);
    assert.equal((await linkPhone(true)).simulated,true);
  } finally { globalThis.window=oldWindow; if(oldNavigator)Object.defineProperty(globalThis,"navigator",oldNavigator);else delete globalThis.navigator; }
});
