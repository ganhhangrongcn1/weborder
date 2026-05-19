export function getCustomerKey(phone) {
  return normalizeVietnamPhone(phone);
}

function normalizeVietnamPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0084")) {
    digits = `84${digits.slice(4)}`;
  }
  if (digits.startsWith("84")) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }

  if (!/^0\d{9}$/.test(digits)) return "";
  return digits;
}
