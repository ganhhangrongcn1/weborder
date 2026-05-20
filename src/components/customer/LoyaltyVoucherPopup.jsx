import { useMemo } from "react";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "--";
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("vi-VN");
}

function formatValue(voucher) {
  const value = Number(voucher?.value || 0);
  if (!value) return "";
  if (String(voucher?.discountType || "") === "percent") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}

function buildGuide(voucher, coupon) {
  const configuredGuide = String(
    voucher?.usageGuide ||
    voucher?.guide ||
    coupon?.usageGuide ||
    coupon?.guide ||
    coupon?.instruction ||
    coupon?.description ||
    coupon?.note ||
    ""
  ).trim();

  if (configuredGuide) return configuredGuide;

  const minOrder = Number(voucher?.minOrder ?? coupon?.minOrder ?? 0);
  if (minOrder > 0) {
    return `Áp dụng cho đơn từ ${minOrder.toLocaleString("vi-VN")}đ.`;
  }

  return "Áp dụng khi thanh toán trên menu chính thức.";
}

export default function LoyaltyVoucherPopup({
  open,
  voucher,
  coupon,
  onClose,
  onPrimaryAction
}) {
  const valueText = useMemo(() => formatValue(voucher), [voucher]);
  const guideText = useMemo(() => buildGuide(voucher, coupon), [voucher, coupon]);
  const expiresAt = voucher?.expiredAt || voucher?.endAt || voucher?.expiry || coupon?.endAt || "";
  const voucherCode = String(voucher?.code || coupon?.code || "--").trim();
  const title = String(voucher?.title || voucher?.name || "").trim() || "Tặng bạn voucher mới";
  const supportText = String(coupon?.description || coupon?.note || "").trim();

  if (!open || !voucher) return null;

  return (
    <CustomerBottomSheet
      ariaLabel="Quà tặng dành riêng cho bạn"
      onClose={onClose}
      className="promo-sheet loyalty-voucher-sheet"
      contentClassName="loyalty-voucher-sheet__scroll"
      showHeader={false}
      footer={(
        <div className="loyalty-voucher-footer">
          <button type="button" className="cta w-full" onClick={onPrimaryAction}>
            Dùng ngay
          </button>
        </div>
      )}
    >
      <section className="loyalty-voucher-card">
        <button type="button" className="loyalty-voucher-close" onClick={onClose} aria-label="Đóng">X</button>

        <div className="loyalty-voucher-hero">
          <p className="loyalty-voucher-pill">Quà tặng dành riêng cho bạn</p>
          <h2>{title}</h2>
          {valueText ? <p className="loyalty-voucher-value">{valueText}</p> : null}
          <p className="loyalty-voucher-subtitle">Dùng ngay khi đặt món hôm nay để không bỏ lỡ ưu đãi này.</p>
        </div>

        <div className="loyalty-voucher-coupon">
          <div className="loyalty-voucher-coupon__code">
            <span>Mã ưu đãi</span>
            <strong>{voucherCode}</strong>
          </div>
          <div className="loyalty-voucher-coupon__meta">
            <p><strong>Hạn dùng:</strong> {formatDate(expiresAt)}</p>
            <p><strong>Cách dùng:</strong> {guideText}</p>
            {supportText ? <p><strong>Lưu ý:</strong> {supportText}</p> : null}
          </div>
        </div>
      </section>
    </CustomerBottomSheet>
  );
}
