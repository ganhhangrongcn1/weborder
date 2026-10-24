import test from "node:test";
import assert from "node:assert/strict";
import { prepareDemoPhoneLink, applyDemoPhoneLink } from "../src/services/demoPhoneService.js";
import { isZalo, locate, scanQr, linkPhone } from "../src/services/deviceService.js";

test("khớp mới lưu; không khớp và từ chối không đổi trạng thái", () => {
  const actor = { id: "test-id", username: "test" };
  const state = { records: [], phones: {} };
  for (const [scenario, consent, status] of [["mismatch", true, "mismatch"], ["declined", true, "declined"], ["match", false, "declined"]]) {
    const result = prepareDemoPhoneLink(actor, scenario, consent);
    assert.equal(result.status, status);
    assert.equal(applyDemoPhoneLink(state, actor, result), state);
    assert.equal(result.link, undefined);
  }
  const result = prepareDemoPhoneLink(actor, "match", true, 1000);
  const linked = applyDemoPhoneLink(state, actor, result);
  assert.equal(linked.phones[actor.id].linkedAt, 1000);
  assert.equal(linked.phones[actor.id].verified, false);
  assert.deepEqual(state.phones, {});
  assert.equal(applyDemoPhoneLink(linked, actor, result), linked);
  assert.throws(() => prepareDemoPhoneLink({ id: "other", username: "staff" }, "match", true));
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
