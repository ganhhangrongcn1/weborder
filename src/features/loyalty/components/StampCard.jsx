import { useState } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import Icon from "../../../components/Icon.jsx";
import useStampProgram from "../../../hooks/useStampProgram.js";
import { buildStampGift } from "../../../services/stampProgramService.js";
import "../../../styles/stamp-card.css";

const eventLabels = { earn: "Tích 1 tem", reverse: "Thu hồi tem đơn hủy", hold: "Giữ 10 tem cho đơn đổi quà", redeem: "Đã đổi món quà", release: "Hoàn tem đơn hủy" };
export default function StampCard({ phone = "", navigate, detailed = false, setCart, setCheckoutPreset }) {
  const [showRewards, setShowRewards] = useState(false);
  const { data, loading, error, history, historyError, hasMore, loadMore } = useStampProgram(phone, detailed && showRewards);
  const [notice, setNotice] = useState("");
  if (data && !data.enabled) return null;
  const available = data?.available || 0;
  const chooseGift = (gift) => {
    if (!phone || available < 10 || !setCart) return;
    setCart((items) => [...items.filter((item) => !item.stampGift), buildStampGift(gift, phone)]);
    setCheckoutPreset?.((current) => ({ ...current, fulfillmentType: "pickup" }));
    setNotice(`Đã thêm ${gift.name} — quà đổi tem 0đ vào giỏ.`);
    navigate?.("checkout", "menu");
  };
  return <section className={`stamp-card${detailed ? " stamp-card--rewards" : ""}`} aria-label="Tích tem nhận quà">
    <header><h2><Icon name="gift" size={21} /> Tem của bạn</h2><span className="stamp-card__count">{available}/10 tem</span></header>
    {loading ? <p role="status">Đang tải thẻ tem…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="stamp-card__grid" aria-label={`${available} tem khả dụng`}>
        {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < available ? "is-earned" : ""}>{i < available ? "✓" : i === 9 ? <Icon name="gift" size={15} /> : ""}</span>)}
      </div>
      <div className="stamp-card__footer">
        <span>{!phone ? "Đăng nhập để xem tem" : available >= 10 ? "Bạn đã đủ tem nhận quà!" : <>Còn <strong>{10 - available} tem</strong> để nhận quà</>}</span>
        <button type="button" aria-haspopup={detailed ? "dialog" : undefined} onClick={() => detailed ? setShowRewards(true) : navigate?.("loyalty", "loyalty")}>Xem thưởng <span aria-hidden="true">›</span></button>
      </div>
      {detailed && showRewards && <CustomerBottomSheet title="Đổi tem nhận quà" onClose={() => setShowRewards(false)} className="stamp-rewards-sheet" contentClassName="stamp-rewards-sheet__content">
        <div className="stamp-rewards-sheet__summary">
          <h3>{available >= 10 ? "Bạn đã đủ tem nhận quà!" : "Bạn chưa đủ tem"}</h3>
          <p>{available >= 10 ? "Chọn 1 món quà bên dưới để đổi." : `Còn ${10 - available} tem để chọn 1 món miễn phí.`}</p>
          <strong>{available}/10 tem</strong>
        </div>
        {data.held > 0 && <p>{data.held} tem đang giữ cho đơn chờ hoàn tất.</p>}
        {phone && data.earnedToday && <p>Hôm nay bạn đã nhận tem.</p>}
        {!phone && <button type="button" className="stamp-rewards-sheet__login" onClick={() => navigate?.("account", "account")}>Đăng nhập để xem và đổi tem</button>}
        <h3>Chọn 1 trong 3 món quà</h3>
        <div className="stamp-card__gifts">{(data.gifts || []).map((gift) => <button type="button" key={gift.id} disabled={!phone || available < 10 || !setCart} onClick={() => chooseGift(gift)}>
          {gift.image && <img src={gift.image} alt="" loading="lazy" />}<span>{gift.name}<small>Đổi 10 tem · 0đ</small></span>
        </button>)}</div>
        {!data.gifts?.length && <p>Quà tặng đang được cập nhật. Bạn quay lại sau nhé.</p>}
        {notice && <p role="status">{notice}</p>}
        <details className="stamp-disclosure"><summary>Thể lệ tích tem & đổi quà</summary>
          <ul className="stamp-rules">
            <li>Mỗi số điện thoại tích tối đa 1 tem/ngày, tính chung đơn tại quán, website và app giao đồ ăn.</li>
            <li>Áp dụng từ khi bật chương trình: đơn tại quầy đã thanh toán, đơn website đã hoàn tất, đơn app được quán xác nhận. Đơn phải có trả tiền và số điện thoại đầy đủ, hợp lệ. Đơn hủy hoặc hoàn tiền sẽ được điều chỉnh tem.</li>
            <li>Đủ 10 tem, chọn 1 trong 3 món quà. Quà có thể thay đổi theo chương trình.</li>
            <li>Đổi tại quán hoặc đặt đổi trên website và đến quán nhận. Không đổi quà trên app giao đồ ăn.</li>
            <li>Đơn chỉ có quà 0đ thanh toán tại quầy, không tích thêm tem. Đơn hủy/hoàn tiền bị thu hồi tem đã tích.</li>
          </ul>
        </details>
        {phone && <details className="stamp-disclosure"><summary>Lịch sử tem</summary>{historyError && <p role="alert">{historyError}</p>}
          <ol className="stamp-card__timeline">{history.map((event) => <li key={event.id}><strong>{eventLabels[event.kind] || event.kind}</strong><small>{new Date(event.created_at).toLocaleString("vi-VN")} · {event.source === "partner_orders" ? "Đơn đối tác" : "Đơn tại Gánh"}</small></li>)}</ol>
          {!history.length && !historyError && <p>Chưa có lịch sử tích tem.</p>}{hasMore && <button type="button" onClick={loadMore}>Xem thêm</button>}</details>}
      </CustomerBottomSheet>}
    </>}
  </section>;
}
