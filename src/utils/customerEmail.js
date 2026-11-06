export function isValidCustomerEmail(value = "") {
  const email = String(value).trim();
  if (email.length > 254 || /\s/.test(email) || email.toLowerCase().endsWith("@phone.ghr.vn")) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && /^[a-zA-Z]{2,63}$/.test(labels.at(-1)) && labels.every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}
export default isValidCustomerEmail;
