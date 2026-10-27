import { useState } from "react";
import { POINT_UNIT, SAMPLE_RECEIPTS, SAMPLE_REWARDS, pointsBalance } from "../services/memberPointsService.js";

const number = (value) => value.toLocaleString("vi-VN");
export default function Membership({ app, membership }) {
  const [receipt, setReceipt] = useState(SAMPLE_RECEIPTS[0].id);
  const [selectedReward, setSelectedReward] = useState(null);
  const { state, collect, redeem, message, error } = membership;
  const balance = pointsBalance(state);
  return <div className="membership-page">
    <section className="card member-card" aria-label="Thẻ thành viên">
      <p className="eyebrow">Gánh Hàng Rong · Thành viên nhân viên</p><h2>{app.actor.name}</h2>
      <p>Điểm khả dụng · Dữ liệu mẫu</p><strong className="member-balance">{number(balance)} <small>điểm</small></strong>
      <p className="small">Mua hàng tại quán · Quy đổi mẫu: {number(POINT_UNIT)}đ = 1 điểm, làm tròn xuống trên từng hóa đơn.</p>
    </section>
    <p className="notice">Bản trải nghiệm: chỉ dùng hóa đơn và quà mẫu. Điểm giữ trong phiên, mất khi đăng xuất hoặc tải lại; không liên quan lương, điểm khách hàng hay ưu đãi thật.</p>
    {error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice success">{message}</p>}
    <section className="card"><h2>Tích điểm mua hàng</h2><p>Chọn hóa đơn mẫu để thử tích điểm. Mỗi hóa đơn chỉ được nhận điểm một lần trong phiên.</p>
      <form onSubmit={(event) => { event.preventDefault(); collect(receipt); }}>
        <label htmlFor="member-receipt">Hóa đơn mẫu</label>
        <select id="member-receipt" value={receipt} onChange={(event) => setReceipt(event.target.value)}>{SAMPLE_RECEIPTS.map((item) => <option key={item.id} value={item.id}>{item.id} · {number(item.amount)}đ · +{Math.floor(item.amount / POINT_UNIT)} điểm</option>)}</select>
        <button className="primary" type="submit" disabled={state.entries.some((item) => item.receiptId === receipt)}>Tích điểm hóa đơn mẫu</button>
      </form>
    </section>
    <section className="card"><h2>Đổi quà</h2><div className="member-rewards">{SAMPLE_REWARDS.map((reward) => {
      const used = state.entries.some((item) => item.rewardId === reward.id);
      return <article key={reward.id}><h3>{reward.title}</h3><p>{reward.cost} điểm · Quà minh họa</p><button disabled={used || balance < reward.cost} onClick={() => setSelectedReward(reward)}>{used ? "Đã đổi mẫu" : balance < reward.cost ? "Chưa đủ điểm" : "Đổi quà mẫu"}</button></article>;
    })}</div>
      {selectedReward && <div className="notice"><p>Đổi {selectedReward.cost} điểm lấy {selectedReward.title.toLowerCase()}? Chỉ mô phỏng, không nhận quà thật.</p><div className="button-row"><button className="primary" onClick={() => { redeem(selectedReward.id); setSelectedReward(null); }}>Xác nhận đổi mẫu</button><button onClick={() => setSelectedReward(null)}>Hủy</button></div></div>}
    </section>
    <section className="card"><h2>Lịch sử điểm</h2>{!state.entries.length ? <p>Chưa có giao dịch. Hãy thử tích điểm một hóa đơn mẫu.</p> : <ul className="member-ledger">{[...state.entries].reverse().map((entry) => <li key={entry.id}><div><strong>{entry.title}</strong><small>{new Date(entry.at).toLocaleString("vi-VN")}{entry.amount ? ` · ${number(entry.amount)}đ` : " · Đổi quà mô phỏng"}</small></div><strong>{entry.points > 0 ? "+" : ""}{entry.points} điểm</strong></li>)}</ul>}</section>
  </div>;
}
