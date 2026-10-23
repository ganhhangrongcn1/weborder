import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState, DEMO_ACCOUNTS, DEMO_BRANCH } from "../src/data/demo.js";
import { recordAttendance, validateLocation, hours, submitCorrection, reviewCorrection, exportCsv } from "../src/services/attendanceService.js";
import { exchangeToken } from "../server/zaloBridge.mjs";

const actor = DEMO_ACCOUNTS[0]; const manager = DEMO_ACCOUNTS[1];
const when = new Date("2026-10-23T01:00:00Z");
const location = { latitude: DEMO_BRANCH.latitude, longitude: DEMO_BRANCH.longitude, accuracy: 5, capturedAt: when.getTime(), simulated: true };
const evidence = { online: true, location, method: "gps" };
const empty = () => ({ ...createDemoState(when), records: [] });

test("vào ca và ra ca lưu đúng giờ, không cộng ca đang mở", () => {
  const state = recordAttendance(empty(), actor, "in", evidence, when);
  assert.equal(hours(state.records[0]), 0);
  const end = new Date(when.getTime() + 8 * 3600000);
  const closed = recordAttendance(state, actor, "out", { ...evidence, location: { ...location, capturedAt: end.getTime() } }, end);
  assert.equal(hours(closed.records[0]), 8);
});

test("chặn vào ca lặp, ra ca khi chưa vào, và mất mạng", () => {
  const state = recordAttendance(empty(), actor, "in", evidence, when);
  assert.throws(() => recordAttendance(state, actor, "in", evidence, when), /chưa ra/);
  assert.throws(() => recordAttendance(empty(), actor, "out", evidence, when), /Chưa có ca/);
  assert.throws(() => recordAttendance(empty(), actor, "in", { ...evidence, online: false }, when), /mất mạng/);
});

test("GPS quá hạn, sai số lớn, ngoài bán kính và NaN đều bị từ chối", () => {
  assert.throws(() => validateLocation(location, when.getTime() + 120001), /quá 2 phút/);
  assert.throws(() => validateLocation({ ...location, accuracy: 101 }, when.getTime()), /chính xác/);
  assert.throws(() => validateLocation({ ...location, latitude: 0 }, when.getTime()), /phạm vi/);
  assert.throws(() => validateLocation({ ...location, latitude: NaN }, when.getTime()), /hợp lệ/);
});

test("QR không đúng hoặc cũ không được vào ca", () => {
  assert.throws(() => recordAttendance(empty(), actor, "in", { ...evidence, method: "qr", qr: "wrong", qrAt: when.getTime() }, when), /QR/);
  assert.throws(() => recordAttendance(empty(), actor, "in", { ...evidence, method: "qr", qr: DEMO_BRANCH.qr, qrAt: when.getTime() - 120001 }, when), /QR/);
  assert.equal(recordAttendance(empty(), actor, "in", { ...evidence, method: "qr", qr: DEMO_BRANCH.qr, qrAt: when.getTime() }, when).records.length, 1);
});

test("điều chỉnh chỉ áp dụng bản ghi của mình và không cho gửi trùng", () => {
  const state = createDemoState(when); const row = state.records[0];
  const input = { recordId: row.id, checkIn: row.checkIn, checkOut: new Date(new Date(row.checkOut).getTime() + 15 * 60000).toISOString(), reason: "Quên xác nhận giờ ra ca, nhờ kiểm tra lại." };
  assert.throws(() => submitCorrection(state, manager, input), /của mình/);
  const pending = submitCorrection(state, actor, input);
  assert.equal(pending.requests[0].status, "pending");
  assert.throws(() => submitCorrection(pending, actor, input), /chờ duyệt/);
  assert.throws(() => reviewCorrection(pending, actor, pending.requests[0].id, "approved", "Đã xác minh"), /quản lý/);
  const approved = reviewCorrection(pending, manager, pending.requests[0].id, "approved", "Đã xác minh ca làm mẫu");
  assert.equal(approved.requests[0].status, "approved"); assert.equal(approved.records[0].adjusted, true);
  assert.equal(approved.records[0].originalCheckIn, row.checkIn);
  assert.equal(hours(approved.records[0]), 8.25);
  assert.equal(approved.records[0].originalCheckOut, row.checkOut);
});

test("không duyệt ca chồng lấn; từ chối giữ nguyên giờ công", () => {
  const state = createDemoState(when); const row = state.records[0];
  const pending = submitCorrection(state, actor, { recordId: row.id, checkIn: state.records[1].checkIn, checkOut: row.checkOut, reason: "Yêu cầu thử giờ công trùng lấn ca mẫu" });
  assert.throws(() => reviewCorrection(pending, manager, pending.requests[0].id, "approved", "Kiểm tra"), /trùng/);
  const rejected = reviewCorrection(pending, manager, pending.requests[0].id, "rejected", "Trùng giờ ca khác");
  assert.equal(rejected.records[0].checkIn, row.checkIn);
});

test("CSV có UTF-8 BOM, escape dấu nháy và chống công thức trong tên", () => {
  const csv = exportCsv([{ name: '=HYPERLINK("x")', checkIn: when.toISOString(), checkOut: null }]);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('""x""'));
});

test("bridge thiếu secret hoặc Zalo trả lỗi thì không giả lập dữ liệu", async () => {
  await assert.rejects(() => exchangeToken("phone", {}, ""), /ZALO_APP_SECRET/);
  await assert.rejects(() => exchangeToken("location", { token: "test", accessToken: "test" }, "test-secret", async () => ({ ok: true, json: async () => ({ error: -1 }) })), /từ chối/);
});

test("bridge đổi token dùng header, chỉ trả số điện thoại che bớt", async () => {
  let sent;
  const result = await exchangeToken("phone", { token: "test-code", accessToken: "test-access" }, "test-secret", async (url, options) => {
    sent = { url, options }; return { ok: true, json: async () => ({ error: 0, data: { number: "84900000001" } }) };
  });
  assert.equal(sent.url, "https://graph.zalo.me/v2.0/me/info"); assert.equal(sent.options.headers.code, "test-code");
  assert.equal(result.masked, "SĐT Zalo · *** 0001"); assert.equal(result.simulated, false);
});
