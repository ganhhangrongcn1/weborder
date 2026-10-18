import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import useStampProgram from "../../../hooks/useStampProgram.js";

const EVENT_LABELS = {
  earn: "Tích tem",
  reverse: "Thu hồi tem đơn hủy",
  hold: "Giữ tem đổi quà",
  redeem: "Đổi quà",
  release: "Hoàn tem đơn hủy"
};

export default function CustomerStampPanel({ phone }) {
  const [showHistory, setShowHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data, loading, error, history, historyError, historyLoading, hasMore, loadMore } = useStampProgram(phone, showHistory, { admin: true });

  async function showMore() {
    setLoadingMore(true);
    try { await loadMore(); }
    finally { setLoadingMore(false); }
  }

  return (
    <section className="crm-detail-card" aria-label="Tem của khách hàng">
      <div className="crm-card-title"><Icon name="gift" size={17} /><h3>Tem của khách hàng</h3></div>
      {loading ? <p role="status">Đang tải tem…</p> : error ? <p role="alert">{error}</p> : data ? <>
        <div className="crm-points-line"><span>Tem khả dụng</span><strong>{Number(data.available || 0).toLocaleString("vi-VN")} tem</strong></div>
        <div className="crm-points-grid">
          <span>Tổng tem hiện có: {Number(data.balance || 0).toLocaleString("vi-VN")}</span>
          <span>Đang giữ đổi quà: {Number(data.held || 0).toLocaleString("vi-VN")}</span>
          <span>{data.earnedToday ? "Đã tích tem hôm nay" : "Chưa tích tem hôm nay"}</span>
          <span>{data.required || 10} tem đổi 1 quà</span>
        </div>
        {!data.enabled && <p>Chương trình tích tem đang tắt.</p>}
        <details className="crm-loyalty-breakdown" onToggle={(event) => setShowHistory(event.currentTarget.open)}>
          <summary>Lịch sử tem</summary>
          {showHistory && <>
            {historyError && <p role="alert">{historyError}</p>}
            {historyLoading && <p role="status">Đang tải lịch sử tem…</p>}
            {!historyLoading && !history.length && !historyError && <p>Chưa có lịch sử tem.</p>}
            <ol>{history.map((event) => <li key={event.id}>
              <strong>{EVENT_LABELS[event.kind] || event.kind}</strong>
              <div>{Number(event.delta) > 0 ? "+" : ""}{event.delta} tem · {event.source === "partner_orders" ? "Đơn đối tác" : "Đơn tại Gánh"}</div>
              <small>{new Date(event.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</small>
            </li>)}</ol>
            {hasMore && <button type="button" className="crm-page-btn" disabled={loadingMore || historyLoading} onClick={showMore}>{loadingMore ? "Đang tải…" : "Xem thêm lịch sử tem"}</button>}
          </>}
        </details>
      </> : null}
    </section>
  );
}
