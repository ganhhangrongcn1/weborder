// Session-only sample ledger. Real receipt verification and redemption require a server.
export const POINT_UNIT = 1000;
export const SAMPLE_RECEIPTS = [
  { id: "HD-MAU-001", amount: 45000 },
  { id: "HD-MAU-002", amount: 68500 },
  { id: "HD-MAU-003", amount: 120000 },
];
export const SAMPLE_REWARDS = [
  { id: "drink", title: "Một phần nước uống mẫu", cost: 50 },
  { id: "meal", title: "Ưu đãi món ăn mẫu", cost: 100 },
];
export function createMemberPoints(actor) {
  if (!actor?.id) throw new Error("Vui lòng đăng nhập để xem điểm.");
  return { actorId: actor.id, entries: [] };
}
export function pointsBalance(state) {
  return state.entries.reduce((sum, entry) => sum + entry.points, 0);
}
function verifyOwner(state, actor) {
  if (!actor?.id || state?.actorId !== actor.id) throw new Error("Không đúng tài khoản thành viên.");
}
export function collectReceiptPoints(state, actor, receiptId) {
  verifyOwner(state, actor);
  const receipt = SAMPLE_RECEIPTS.find((item) => item.id === String(receiptId).trim().toUpperCase());
  if (!receipt) throw new Error("Không tìm thấy hóa đơn mẫu. Hãy chọn một mã trong danh sách thử.");
  if (state.entries.some((item) => item.receiptId === receipt.id)) throw new Error("Hóa đơn này đã được tích điểm trong phiên thử.");
  return { ...state, entries: [...state.entries, { id: receipt.id, receiptId: receipt.id, title: receipt.id,
    amount: receipt.amount, points: Math.floor(receipt.amount / POINT_UNIT), at: new Date().toISOString(), kind: "purchase" }] };
}
export function redeemMemberReward(state, actor, rewardId) {
  verifyOwner(state, actor);
  const reward = SAMPLE_REWARDS.find((item) => item.id === rewardId);
  if (!reward) throw new Error("Không tìm thấy quà mẫu.");
  if (pointsBalance(state) < reward.cost) throw new Error("Bạn chưa đủ điểm để đổi quà này.");
  if (state.entries.some((item) => item.rewardId === reward.id)) throw new Error("Quà này đã được đổi trong phiên thử.");
  return { ...state, entries: [...state.entries, { id: `reward-${reward.id}`, rewardId: reward.id,
    title: reward.title, points: -reward.cost, at: new Date().toISOString(), kind: "reward" }] };
}
