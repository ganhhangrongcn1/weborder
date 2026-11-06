import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function MenuVoucherRail({ vouchers = [] }) {
  const [open, setOpen] = useState(false);
  if (!vouchers.length) return null;
  return (
    <>
      <section className="menu-vouchers" aria-label="Voucher dành cho bạn">
        <div className="menu-vouchers__rail">
          {vouchers.map((voucher) => (
            <CustomerControl key={voucher.id} type="button" className="menu-voucher-ticket" onClick={() => setOpen(true)}>
              <span className="menu-voucher-ticket__icon"><Icon name={voucher.icon} size={22} /></span>
              <span><strong>{voucher.reward}</strong><small>{voucher.lines[0]}</small></span>
            </CustomerControl>
          ))}
        </div>
        <CustomerControl type="button" className="menu-vouchers__more" onClick={() => setOpen(true)}><span>›</span>Xem thêm</CustomerControl>
      </section>
      {open && createPortal(
        <CustomerBottomSheet title="Ưu đãi dành cho bạn" onClose={() => setOpen(false)} className="menu-voucher-sheet">
          <h3 className="menu-voucher-sheet__heading">Voucher</h3>
          {vouchers.map((voucher) => (
            <article key={voucher.id} className="menu-voucher-detail">
              <div className="menu-voucher-detail__brand"><Icon name={voucher.icon} size={30} /><span>{voucher.badge}</span></div>
              <div className="menu-voucher-detail__copy">
                <strong>{voucher.reward}</strong>
                <p>{voucher.lines[0]}</p>
                {voucher.expiresAt ? <small>HSD: {voucher.expiresAt.slice(0, 10).split("-").reverse().join("/")}</small> : null}
                <details><summary>Điều kiện</summary><p>Mã: <b>{voucher.code}</b></p>{voucher.lines.slice(1).map((line) => <p key={line}>{line}</p>)}<p>{voucher.description || "Áp dụng cho đơn đủ điều kiện. Kiểm tra và chọn ưu đãi tại bước thanh toán."}</p></details>
              </div>
            </article>
          ))}
        </CustomerBottomSheet>, document.body
      )}
    </>
  );
}
