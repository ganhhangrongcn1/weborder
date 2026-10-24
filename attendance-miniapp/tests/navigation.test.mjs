import test from "node:test";
import assert from "node:assert/strict";
import { parseDestination, destinationHash, phoneHref, zaloHref, externalHref } from "../src/services/navigationService.js";
test("đường dẫn trang và chi nhánh, không cho URL thực thi tùy ý", () => {
  assert.deepEqual(parseDestination(destinationHash("branch", "demo-store")), { page: "branch", branch: "demo-store" });
  assert.equal(parseDestination("#page=unknown").page, "checkin");
  assert.throws(() => destinationHash("javascript:alert(1)"));
  assert.equal(phoneHref(""), null);
  assert.equal(phoneHref("0900 000 001"), "tel:0900000001");
  assert.equal(phoneHref("123;alert"), null);
  assert.equal(zaloHref("https://evil.example"), null);
  assert.equal(zaloHref("javascript:alert(1)"), null);
  assert.equal(zaloHref("https://zalo.me/123456"), "https://zalo.me/123456");
});

test("link ngoài chỉ nhận HTTPS và không chứa tài khoản trong URL", () => {
  assert.equal(externalHref("https://maps.google.com/?q=quan"), "https://maps.google.com/?q=quan");
  for (const value of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", ""]) assert.equal(externalHref(value), null);
});
