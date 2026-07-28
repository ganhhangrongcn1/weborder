export const formatMoney = (value) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return `${safeValue.toLocaleString("vi-VN")}đ`;
};
