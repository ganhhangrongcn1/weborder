import CustomerOfferCard from "../../../components/customer/CustomerOfferCard.jsx";

function formatVoucherValue(voucher) {
  const value = Number(voucher?.value || 0);
  if (!value) return "";
  if (voucher.discountType === "percent") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}

function formatVoucherDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Chưa có hạn dùng";
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleDateString("vi-VN");
}

function formatVoucherCondition(voucher) {
  const minOrder = Math.max(0, Number(voucher?.minOrder || 0));
  const maxDiscount = Math.max(0, Number(voucher?.maxDiscount || 0));
  if (minOrder > 0) return `Đơn từ ${minOrder.toLocaleString("vi-VN")}đ`;
  if (voucher?.discountType === "percent" && maxDiscount > 0) {
    return `Giảm tối đa ${maxDiscount.toLocaleString("vi-VN")}đ`;
  }
  return "Áp dụng cho mọi đơn";
}

export default function VoucherCard({ voucher, expired, onUse }) {
  const valueText = formatVoucherValue(voucher);
  const canceled = voucher?.canceled === true;
  const used = voucher?.used === true;
  const inactive = canceled || used || expired;
  const statusLabel = canceled ? "Đã hủy" : used ? "Đã dùng" : expired ? "Đã hết hạn" : "Có thể dùng";
  const expiresAt = voucher?.expiredAt || voucher?.endAt || voucher?.expiry;
  const conditionText = formatVoucherCondition(voucher);
  const title = voucher?.title || voucher?.name || "Voucher dành cho bạn";

  return (
    <CustomerOfferCard
      value={valueText || "Quà tặng"}
      title={title}
      status={statusLabel}
      inactive={inactive}
      details={[
        { icon: "tag", text: conditionText },
        { icon: "clock", text: `Dùng đến ${formatVoucherDate(expiresAt)}` }
      ]}
      codeLabel={voucher?.code ? `Mã: ${voucher.code}` : "Chọn tại bước thanh toán"}
      actionLabel={!inactive && onUse ? "Dùng ngay" : ""}
      onAction={!inactive && onUse ? () => onUse(voucher) : undefined}
    />
  );
}
