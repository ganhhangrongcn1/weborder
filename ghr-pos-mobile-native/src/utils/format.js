export function formatMoney(amount = 0) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(amount || 0))}đ`;
}
