import test from "node:test";
import assert from "node:assert/strict";
import { createMemberPoints, collectReceiptPoints, redeemMemberReward, pointsBalance } from "../src/services/memberPointsService.js";
import { destinationHash, parseDestination } from "../src/services/navigationService.js";
const actor = { id: "employee-test" };
test("purchase points round down per receipt and reject repeated/unknown receipts", () => {
  const initial = createMemberPoints(actor);
  const next = collectReceiptPoints(initial, actor, "hd-mau-002");
  assert.equal(pointsBalance(next), 68);
  assert.equal(pointsBalance(initial), 0);
  assert.throws(() => collectReceiptPoints(next, actor, "HD-MAU-002"), /đã được/);
  assert.throws(() => collectReceiptPoints(next, actor, "unknown"), /Không tìm thấy/);
});
test("redemption deducts points, prevents overdraft and duplicate rewards", () => {
  const initial = createMemberPoints(actor);
  assert.throws(() => redeemMemberReward(initial, actor, "drink"), /chưa đủ/);
  const earned = collectReceiptPoints(initial, actor, "HD-MAU-003");
  const spent = redeemMemberReward(earned, actor, "drink");
  assert.equal(pointsBalance(spent), 70);
  assert.equal(pointsBalance(earned), 120);
  assert.throws(() => redeemMemberReward(spent, actor, "drink"), /đã được đổi/);
  assert.throws(() => redeemMemberReward(spent, actor, "meal"), /chưa đủ/);
  assert.throws(() => redeemMemberReward(spent, actor, "missing"), /Không tìm thấy/);
});
test("sample ledger belongs to one authenticated actor and starts fresh per session", () => {
  const state = collectReceiptPoints(createMemberPoints(actor), actor, "HD-MAU-001");
  assert.throws(() => collectReceiptPoints(state, { id: "other" }, "HD-MAU-002"), /Không đúng/);
  assert.throws(() => redeemMemberReward(state, { id: "other" }, "drink"), /Không đúng/);
  assert.throws(() => createMemberPoints(null), /đăng nhập/);
  assert.equal(pointsBalance(createMemberPoints(actor)), 0);
  assert.deepEqual(parseDestination(destinationHash("membership")), { page: "membership", branch: "" });
});
