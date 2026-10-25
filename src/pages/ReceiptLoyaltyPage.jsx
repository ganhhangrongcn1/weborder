import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useReceiptLoyalty from "../hooks/useReceiptLoyalty.js";
import "../styles/receipt-loyalty.css";

const number = (value) => Number(value || 0).toLocaleString("vi-VN");
const notices = {
  cancelled: "Bill đã hủy hoặc hoàn tiền, không được nhận điểm.",
  expired: "Bill đã hết thời hạn nhận điểm. Vui lòng liên hệ quán nếu cần hỗ trợ.",
  waiting_data: "Điểm đang chờ đối soát. Bạn có thể quét lại QR này sau, không cần chờ đơn hoàn thành."
};

export default function ReceiptLoyaltyPage() {
  const { token = "" } = useParams();
  const [tab, setTab] = useState("claim");
  const vm = useReceiptLoyalty(token);
  const bill = vm.receipt;
  useEffect(() => {
    const title = document.title;
    document.title = "Nhận điểm từ bill | Gánh Hàng Rong";
    const meta = document.createElement("meta");
    meta.name = "referrer"; meta.content = "no-referrer"; document.head.appendChild(meta);
    return () => { document.title = title; meta.remove(); };
  }, []);

  return (
    <main className="receipt-rewards">
      <div className="receipt-rewards__layout">
        <Link to="/home" className="receipt-rewards__brand">GÁNH HÀNG RONG</Link>

        <section className="receipt-rewards__card" aria-label="Điểm thành viên">
          <div className="receipt-rewards__tabs" role="tablist" aria-label="Chức năng">
            <button id="receipt-claim-tab" type="button" role="tab" aria-selected={tab === "claim"} aria-controls="receipt-panel" onClick={() => { setTab("claim"); vm.clearError(); }}>Tích điểm đơn</button>
            <button id="receipt-summary-tab" type="button" role="tab" aria-selected={tab === "summary"} aria-controls="receipt-panel" onClick={() => { setTab("summary"); vm.clearError(); }}>Xem điểm</button>
          </div>
          <div className="receipt-rewards__voucher">
          <div id="receipt-panel" role="tabpanel" aria-labelledby={tab === "claim" ? "receipt-claim-tab" : "receipt-summary-tab"}>
            {tab === "claim" ? <>
              <header className="receipt-rewards__heading"><span>HÓA ĐƠN CỦA BẠN</span><h2>{bill?.orderCode || "Nhận điểm từ bill"}</h2><p>{bill?.branchName || "Gánh Hàng Rong"}</p></header>
              {!bill && <div className="receipt-rewards__tear" aria-hidden="true" />}
              {vm.loading ? <p role="status" className="receipt-rewards__notice">Đang kiểm tra bill…</p> : bill ? <>
                <dl className="receipt-rewards__bill">
                  <div><dt>Kênh mua</dt><dd>{bill.source}</dd></div>
                  <div><dt>Ngày mua</dt><dd>{new Date(bill.createdAt).toLocaleString("vi-VN")}</dd></div>
                  <div><dt>Tổng bill</dt><dd>{number(bill.totalAmount)}đ</dd></div>
                  <div><dt>Giá trị tính điểm</dt><dd>{number(bill.pointsBaseAmount)}đ</dd></div>
                </dl>
                <div className="receipt-rewards__points"><span>{bill.status === "claimed" ? "Điểm đã ghi nhận" : "Điểm của đơn này"}</span><strong>+{number(bill.points)} <small>điểm</small></strong></div>
                {bill.status === "claimed" ? <div className="receipt-rewards__success" role="status"><strong>✓ Bill đã được tích điểm</strong><p>Đã tích cho số {bill.maskedPhone}. Bill này không thể nhận thêm lần nữa.</p></div>
                  : bill.status === "available" ? <form onSubmit={vm.review} className="receipt-rewards__form">
                    <label htmlFor="receipt-phone">Số điện thoại nhận điểm</label>
                    <input id="receipt-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="Nhập số điện thoại của bạn" value={vm.phone} onChange={(e) => { vm.setPhone(e.target.value); vm.setConfirmPhone(""); }} disabled={vm.busy} required />
                    <p>Kiểm tra kỹ số điện thoại. Sau khi nhận, bạn cần liên hệ quán để điều chỉnh nếu nhập nhầm.</p>
                    {vm.confirmPhone ? <div className="receipt-rewards__confirm"><span>Nhận điểm vào số</span><strong>{vm.confirmPhone}</strong><button className="receipt-rewards__primary" type="button" disabled={vm.busy} onClick={vm.claim}>{vm.busy ? "Đang nhận điểm…" : "Xác nhận nhận điểm"}</button><button type="button" className="receipt-rewards__text-button" disabled={vm.busy} onClick={() => vm.setConfirmPhone("")}>Sửa số điện thoại</button></div>
                      : <button className="receipt-rewards__primary" type="submit" disabled={vm.busy}>Nhận điểm</button>}
                    <small>Nhận trong 24 giờ từ lúc mua · Hạn {new Date(bill.expiresAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                  </form> : <p role="status" className="receipt-rewards__notice">{notices[bill.status] || "Vui lòng liên hệ quán để kiểm tra bill."}</p>}
              </> : null}
              {!vm.loading && bill?.status !== "claimed" && <button type="button" className="receipt-rewards__text-button" disabled={vm.busy} onClick={vm.refresh}>Kiểm tra lại bill</button>}
            </> : <>
              <header className="receipt-rewards__heading"><span>THÀNH VIÊN GÁNH HÀNG RONG</span><h2>Xem điểm bạn đang có</h2><p>Tra cứu số dư điểm. Lịch sử mua và đổi thưởng được bảo vệ trong tài khoản của bạn.</p></header>
              <div className="receipt-rewards__tear" aria-hidden="true" />
              <form onSubmit={vm.lookup} className="receipt-rewards__form"><label htmlFor="summary-phone">Số điện thoại</label><input id="summary-phone" type="tel" autoComplete="tel" maxLength={16} value={vm.summaryPhone} onChange={(e) => vm.setSummaryPhone(e.target.value)} placeholder="Nhập số điện thoại của bạn" required /><button className="receipt-rewards__primary" disabled={vm.busy}>{vm.busy ? "Đang tra cứu…" : "Xem điểm"}</button></form>
              {vm.summary && <div className="receipt-rewards__points" role="status"><span>Tổng điểm hiện có</span><strong>{number(vm.summary.totalPoints)} <small>điểm</small></strong></div>}
            </>}
          </div>
          {(vm.error || (tab === "claim" && vm.loadError)) && <p className="receipt-rewards__error" role="alert">{vm.error || vm.loadError}</p>}
          <Link to="/review-rewards" className="receipt-rewards__banner"><span className="receipt-rewards__star" aria-hidden="true">★</span><span><small>THƯỞNG ĐIỂM ĐÁNH GIÁ</small><strong>Đánh giá ngay —<br />Nhận điểm liền tay</strong><em>Đơn đối tác · Google Maps</em></span><span className="receipt-rewards__banner-cta">Xem ngay ›</span></Link>
          <Link className="receipt-rewards__account" to="/profile">Đăng nhập để xem lịch sử và dùng điểm →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
