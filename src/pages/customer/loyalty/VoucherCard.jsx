function formatVoucherValue(voucher) {
  const value = Number(voucher?.value || 0);
  if (!value) return "";
  if (voucher.discountType === "percent") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}

export default function VoucherCard({ voucher, expired }) {
  const valueText = formatVoucherValue(voucher);
  const canceled = voucher?.canceled === true;
  const used = voucher?.used === true;
  const inactive = canceled || used || expired;
  const statusLabel = canceled ? "Đã hủy" : used ? "Đã dùng" : expired ? "Đã hết hạn" : "Còn hạn";
  const statusClass = inactive ? "bg-brown/5 text-brown/45" : "bg-green-50 text-green-600";

  return (
    <div className={`rounded-2xl bg-white px-4 py-3 text-sm shadow-soft ${inactive ? "opacity-45" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-brown">{voucher.title || voucher.name || "Voucher"}</strong>
          {voucher.code ? <span className="mt-1 block text-xs font-black text-orange-600">Mã: {voucher.code}</span> : null}
          {valueText ? <span className="block text-xs text-brown/60">{valueText}</span> : null}
          <span className="text-xs text-brown/50">HSD: {voucher.expiredAt || voucher.endAt || voucher.expiry || "--"}</span>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
