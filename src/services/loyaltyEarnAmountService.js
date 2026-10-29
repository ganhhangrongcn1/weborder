// Shipping is not eligible for loyalty. Cap the net merchandise amount by
// the final amount due so cash rounding and other reductions cannot earn points.
export function calculateLoyaltyEarnAmount({
  subtotal, promoDiscount = 0, pointsDiscount = 0, totalAmount, shippingFee = 0
} = {}) {
  const nonnegative = (value) => Math.max(0, Number(value) || 0);
  const paidMerchandise = totalAmount == null
    ? Infinity
    : nonnegative(nonnegative(totalAmount) - nonnegative(shippingFee));
  const netMerchandise = subtotal == null
    ? paidMerchandise
    : nonnegative(nonnegative(subtotal) - nonnegative(promoDiscount) - nonnegative(pointsDiscount));
  const amount = Math.min(netMerchandise, paidMerchandise);
  return Number.isFinite(amount) ? amount : 0;
}

export default calculateLoyaltyEarnAmount;
