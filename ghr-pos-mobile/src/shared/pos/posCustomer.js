export function getCustomerKey(phone = "") {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("84")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  return digits;
}
