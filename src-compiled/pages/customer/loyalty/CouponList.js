import VoucherCard from "./VoucherCard.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CouponList({
  vouchers,
  isVoucherExpired,
  EmptyState
}) {
  const sortedVouchers = [...vouchers].sort((a, b) => {
    const score = item => {
      if (item?.canceled) return 3;
      if (item?.used) return 2;
      if (isVoucherExpired(item)) return 1;
      return 0;
    };
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
  });
  return /*#__PURE__*/_jsxs("div", {
    className: "space-y-2",
    children: [sortedVouchers.length === 0 && EmptyState, sortedVouchers.map(voucher => /*#__PURE__*/_jsx(VoucherCard, {
      voucher: voucher,
      expired: isVoucherExpired(voucher)
    }, voucher.id))]
  });
}