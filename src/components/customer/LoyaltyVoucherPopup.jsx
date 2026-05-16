import { useMemo } from "react";

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
  const configuredGuide =
    String(voucher?.usageGuide || voucher?.guide || coupon?.usageGuide || coupon?.guide || coupon?.instruction || coupon?.description || coupon?.note || "").trim();
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

  if (!open || !voucher) return null;

  return (
    <div className="loyalty-voucher-overlay" role="dialog" aria-modal="true" aria-label="Voucher dành cho bạn">
      <section className="loyalty-voucher-card">
        <button type="button" className="loyalty-voucher-close" onClick={onClose} aria-label="Đóng">X</button>

        <p className="loyalty-voucher-pill">Ưu đãi & Tích điểm</p>
        <h2>{voucher?.title || voucher?.name || "Bạn vừa nhận voucher"}</h2>
        {valueText ? <p className="loyalty-voucher-value">{valueText}</p> : null}

        <div className="loyalty-voucher-body">
          <p><strong>Mã:</strong> {voucher?.code || coupon?.code || "--"}</p>
          <p><strong>Thời hạn:</strong> {formatDate(expiresAt)}</p>
          <p><strong>Hướng dẫn:</strong> {guideText}</p>
        </div>

        <button type="button" className="cta w-full" onClick={onPrimaryAction}>
          Chọn món ngay
        </button>
      </section>
    </div>
  );
}

