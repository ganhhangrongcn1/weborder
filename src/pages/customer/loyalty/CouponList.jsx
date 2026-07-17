import VoucherCard from "./VoucherCard.jsx";

export default function CouponList({
  vouchers,
  isVoucherExpired,
  EmptyState,
  onUseVoucher
}) {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const sortedVouchers = [...safeVouchers].sort((a, b) => {
    const score = (item) => {
      if (item?.canceled) return 3;
      if (item?.used) return 2;
      if (isVoucherExpired(item)) return 1;
      return 0;
    };
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;

    if (score(a) === 0) {
      const aExpiry = new Date(a?.expiredAt || a?.endAt || a?.expiry || "9999-12-31").getTime();
      const bExpiry = new Date(b?.expiredAt || b?.endAt || b?.expiry || "9999-12-31").getTime();
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
    }

    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
  });

  return (
    <div className="space-y-2">
      {sortedVouchers.length === 0 && EmptyState}
      {sortedVouchers.map((voucher, index) => (
        <VoucherCard
          key={voucher.id || voucher.code || `${voucher.title || "voucher"}-${index}`}
          voucher={voucher}
          expired={isVoucherExpired(voucher)}
          onUse={onUseVoucher}
        />
      ))}
    </div>
  );
}
