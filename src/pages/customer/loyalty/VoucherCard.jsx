import Icon from "../../../components/Icon.jsx";

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
    <article className={`loyalty-offer-card${inactive ? " is-inactive" : ""}`}>
      <div className="loyalty-offer-card__mark" aria-hidden="true">
        <Icon name="gift" size={22} />
        <span>Ưu đãi</span>
      </div>

      <div className="loyalty-offer-card__body">
        <div className="loyalty-offer-card__heading">
          <div className="min-w-0">
            <strong className="loyalty-offer-card__value">{valueText || "Quà tặng"}</strong>
            <h3>{title}</h3>
          </div>
          <span className={`loyalty-offer-card__status${inactive ? " is-muted" : ""}`}>
            {statusLabel}
          </span>
        </div>

        <div className="loyalty-offer-card__details">
          <span><Icon name="tag" size={14} />{conditionText}</span>
          <span><Icon name="clock" size={14} />Dùng đến {formatVoucherDate(expiresAt)}</span>
        </div>

        <div className="loyalty-offer-card__footer">
          {voucher?.code ? (
            <span className="loyalty-offer-card__code">Mã: <strong>{voucher.code}</strong></span>
          ) : (
            <span className="loyalty-offer-card__code">Chọn tại bước thanh toán</span>
          )}
          {!inactive && onUse ? (
            <button type="button" onClick={() => onUse(voucher)}>
              Dùng ngay
              <Icon name="cart" size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
