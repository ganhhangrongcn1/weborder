import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function LoyaltyPointsPopup({
  open,
  points,
  journey,
  onClose,
  onPrimaryAction
}) {
  if (!open) return null;

  const safePoints = Math.max(0, Number(points || 0));
  const progressPercent = Math.min(100, Math.max(0, Number(journey?.progressPercent || 0)));
  const currentTierName = journey?.currentTier?.name || "Khách Mới";
  const nextTierName = journey?.nextTier?.name || "";
  const amountToNextTier = Math.max(0, Number(journey?.amountToNextTier || 0));
  const progressText = nextTierName
    ? `Còn ${amountToNextTier.toLocaleString("vi-VN")}đ để lên ${nextTierName}`
    : "Bạn đã đạt hạng thành viên cao nhất";

  return (
    <CustomerBottomSheet
      ariaLabel="Điểm thưởng của bạn"
      onClose={onClose}
      className="promo-sheet loyalty-voucher-sheet"
      contentClassName="loyalty-voucher-sheet__scroll"
      showHeader={false}
      footer={(
        <div className="loyalty-voucher-footer">
          <button type="button" className="cta w-full" onClick={onPrimaryAction}>
            Xem cách dùng điểm
          </button>
        </div>
      )}
    >
      <section className="loyalty-voucher-card loyalty-points-popup">
        <button type="button" className="loyalty-voucher-close" onClick={onClose} aria-label="Đóng">
          X
        </button>

        <div className="loyalty-voucher-hero">
          <p className="loyalty-voucher-pill">Điểm thưởng của bạn</p>
          <h2>Bạn đang có</h2>
          <p className="loyalty-points-popup__value">
            {safePoints.toLocaleString("vi-VN")} <span>điểm</span>
          </p>
          <p className="loyalty-voucher-subtitle">
            Dùng điểm để giảm trực tiếp khi thanh toán đơn hàng.
          </p>
        </div>

        <div className="loyalty-points-popup__progress">
          <div>
            <span>Hạng hiện tại</span>
            <strong>{currentTierName}</strong>
          </div>
          <div className="loyalty-points-popup__track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <p>{progressText}</p>
        </div>
      </section>
    </CustomerBottomSheet>
  );
}
