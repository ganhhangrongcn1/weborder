const TEST_ACCOUNT = "test";

export function prepareDemoPhoneLink(actor, scenario, consent, now = Date.now()) {
  if (!actor?.id || actor.username !== TEST_ACCOUNT) throw new Error("Luồng mẫu chỉ dành cho tài khoản thử nghiệm.");
  if (!["match", "mismatch", "declined"].includes(scenario)) throw new Error("Tình huống liên kết không hợp lệ.");
  if (!consent || scenario === "declined") return { status: "declined", message: "Bạn chưa chia sẻ số điện thoại. Bạn vẫn có thể dùng tích điểm và điểm danh." };
  if (scenario === "mismatch") return { status: "mismatch", message: "Số điện thoại không khớp hồ sơ nhân viên. Vui lòng liên hệ quản lý để kiểm tra. Thông tin liên kết hiện có được giữ nguyên." };
  return { status: "matched", link: { masked: "SĐT liên kết · *** 0001", simulated: true, verified: false, linkedAt: now, source: "demo-profile-match" } };
}

export function applyDemoPhoneLink(state, actor, result) {
  if (result?.status !== "matched") return state;
  if (!actor?.id || result.link?.source !== "demo-profile-match" || !result.link.simulated) throw new Error("Kết quả liên kết không hợp lệ.");
  if (state.phones[actor.id]) return state;
  return { ...state, phones: { ...state.phones, [actor.id]: result.link } };
}
