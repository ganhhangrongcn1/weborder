import { useState } from "react";
import { createMemberPoints, collectReceiptPoints, redeemMemberReward } from "../../services/memberPointsService.js";

// Mounted once per authenticated session; never writes attendance or customer data.
export default function useMemberPoints(actor) {
  const [state, setState] = useState(() => createMemberPoints(actor));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const perform = (action, success) => {
    setError(""); setMessage("");
    try { const next = action(state); setState(next); setMessage(success); }
    catch (failure) { setError(failure.message); }
  };
  return { state, error, message,
    collect: (id) => perform((current) => collectReceiptPoints(current, actor, id), "Đã cộng điểm hóa đơn mẫu."),
    redeem: (id) => perform((current) => redeemMemberReward(current, actor, id), "Đã đổi quà mô phỏng. Quà này không có giá trị sử dụng tại quán.") };
}
