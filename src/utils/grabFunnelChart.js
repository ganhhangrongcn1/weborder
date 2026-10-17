const STAGES = [
  ['reach', 'Xem trang quán'],
  ['visits', 'Xem thực đơn'],
  ['baskets', 'Tới giỏ hàng'],
  ['checkouts', 'Checkout']
];

export default function buildGrabFunnelStages(summary = {}) {
  const values = STAGES.map(([key]) => Math.max(0, Number(summary?.[key]) || 0));
  const scaleMax = Math.max(...values);
  const reach = values[0];
  return STAGES.map(([key, label], index) => ({
    key, label, value: values[index],
    // No minimum visible width, rounding, logarithmic scale or decorative taper.
    widthPercent: scaleMax > 0 ? values[index] / scaleMax * 100 : 0,
    sharePercent: reach > 0 ? values[index] / reach * 100 : null
  }));
}
