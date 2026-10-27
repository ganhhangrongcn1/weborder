export function getPosOrderPayableAmount(order = {}) {
  return Number(order.collectAmount ?? order.totalAmount ?? order.paymentAmount ?? order.total ?? NaN);
}

export function isZeroPosOrder(order = {}) {
  return getPosOrderPayableAmount(order) === 0;
}

export default isZeroPosOrder;
