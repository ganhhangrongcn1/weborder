import assert from "node:assert/strict";
import test from "node:test";
import setGrabStoreState from "./grab-store-control.mjs";

function fixture(payloads) {
  const calls = [];
  const cookieUrls = [];
  return {
    calls,
    cookieUrls,
    page: { cookies: async (...urls) => {
      cookieUrls.push(urls);
      return [{ name: "portal", value: "test", expires: -1 }, { name: "mexusers_authn_token_jti", value: "test-jti", expires: -1 }];
    } },
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      const next = payloads.shift();
      assert.ok(next, "Unexpected request");
      return new Response(JSON.stringify(next.body ?? next), {
        status: next.status || 200,
        headers: next.headers || {}
      });
    }
  };
}
const open = { isOpen: true, isMexInBusyMode: false };
const busy = { isOpen: true, isMexInBusyMode: true };
const source = { merchant_id: "store-A" };

test("thiếu CSRF không gửi PUT và yêu cầu làm mới phiên", async () => {
  const f = fixture([open]);
  const cookieJar = { getCookieString: async () => "mexusers_authn_token=test" };
  await assert.rejects(setGrabStoreState(f.page, source, "busy", { ...f, cookieJar }), {
    code: "GRAB_SESSION_EXPIRED"
  });
  assert.equal(f.calls.length, 1);
});

test("Bận 15 phút chỉ thành công khi Grab xác nhận, đúng cửa hàng và cookie URL", async () => {
  const f = fixture([{ data: open }, {}, { result: busy }]);
  const result = await setGrabStoreState(f.page, source, "busy", f);
  assert.equal(result.applied, true);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(JSON.parse(f.calls[1].body).busyModeRequest, {
    busyModeFoodPrepareTime: 15, busyModeStartTime: null
  });
  for (const call of f.calls) assert.equal(call.headers.merchantid, "store-A");
  assert.deepEqual(f.calls.map((call) => call.url), [
    "https://api.grab.com/food/merchant/v3/open-status",
    "https://api.grab.com/food/merchant/v1/merchant/status",
    "https://api.grab.com/food/merchant/v3/open-status"
  ]);
  for (const call of f.calls) {
    assert.equal(call.headers.origin, "https://merchant.grab.com");
    assert.equal(call.headers["x-client-id"], "GrabMerchant-Portal");
    assert.equal(call.headers["x-grabkit-clientid"], "grabmerchant-portal");
    assert.equal(call.headers["x-csrf-token"], "test-jti");
  }
  assert.deepEqual(f.cookieUrls, f.calls.map((call) => [call.url]));
});

test("dùng phiên API mới và cập nhật cookie cho yêu cầu tiếp theo", async () => {
  const f = fixture([{ body: open, headers: { "set-cookie": "portal=new; Path=/" } }, {}, busy]);
  let value = "portal=old; mexusers_authn_token_jti=old-jti";
  const cookieJar = {
    getCookieString: async () => value,
    setCookie: async () => { value = "portal=new; mexusers_authn_token_jti=new-jti"; }
  };
  await setGrabStoreState(f.page, source, "busy", { ...f, cookieJar });
  assert.equal(f.cookieUrls.length, 0);
  assert.equal(f.calls[1].headers.cookie, "portal=new; mexusers_authn_token_jti=new-jti");
  assert.equal(f.calls[1].headers["x-csrf-token"], "new-jti");
});

for (const status of [401, 403]) {
  test(`HTTP ${status} không ghi trạng thái, phân biệt lỗi phiên và quyền`, async () => {
    const f = fixture([{ status, body: {} }]);
    await assert.rejects(setGrabStoreState(f.page, source, "busy", f), {
      code: status === 401 ? "GRAB_SESSION_EXPIRED" : "GRAB_STORE_FORBIDDEN"
    });
    assert.equal(f.calls.length, 1);
  });
}

test("giữ nguyên cửa hàng đang đóng", async () => {
  const f = fixture([{ isOpen: false, closeReason: 3 }]);
  assert.equal((await setGrabStoreState(f.page, source, "busy", f)).reason, "closed");
  assert.equal(f.calls.length, 1);
});

test("không báo thành công khi PUT thành công nhưng trạng thái chưa đổi", async () => {
  const f = fixture([open, {}, open]);
  const result = await setGrabStoreState(f.page, source, "busy", f);
  assert.equal(result.applied, false);
  assert.equal(result.reason, "status_unconfirmed");
});

test("thiếu Merchant ID hoặc trạng thái lạ không được gửi lệnh", async () => {
  const f = fixture([{}]);
  assert.equal((await setGrabStoreState(f.page, {}, "busy", f)).reason, "missing_merchant_id");
  assert.equal(f.calls.length, 0);
  assert.equal((await setGrabStoreState(f.page, source, "busy", f)).reason, "unknown_status");
  assert.equal(f.calls.length, 1);
});

test("Mở bình thường vẫn được xác nhận đúng và không gửi lại nếu đã bình thường", async () => {
  const f = fixture([busy, {}, open, open]);
  assert.equal((await setGrabStoreState(f.page, source, "normal", f)).applied, true);
  assert.equal((await setGrabStoreState(f.page, source, "normal", f)).reason, "already_normal");
  assert.equal(f.calls.filter((call) => call.method === "PUT").length, 1);
});
