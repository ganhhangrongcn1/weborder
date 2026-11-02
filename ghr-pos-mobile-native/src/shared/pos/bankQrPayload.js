// NAPAS VietQR transfer-to-account payload (TLV + CRC-16/CCITT-FALSE).
// Pure ASCII fields keep the same payload on Android, web and ESC/POS printers.
const tlv = (tag, value) => `${tag}${String(value.length).padStart(2, "0")}${value}`;
export function crc16(value) {
  let crc = 0xffff;
  for (let i = 0; i < value.length; i += 1) {
    crc ^= value.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function buildBankQrPayload({ bankBin, accountNumber, amount, reference } = {}) {
  const bin = String(bankBin || "").trim();
  const account = String(accountNumber || "").trim();
  const memo = String(reference || "").trim();
  const money = Number(amount);
  if (!/^\d{6}$/.test(bin) || !/^\d{1,34}$/.test(account) || !Number.isSafeInteger(money)
    || money <= 0 || !/^[A-Z0-9-]{6,25}$/.test(memo)) return "";
  const beneficiary = tlv("00", bin) + tlv("01", account);
  const provider = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const payload = tlv("00", "01") + tlv("01", "12") + tlv("38", provider)
    + tlv("53", "704") + tlv("54", String(money)) + tlv("58", "VN") + tlv("62", tlv("08", memo)) + "6304";
  return payload + crc16(payload);
}
export function localizeBankQrUrl(value) {
  const text = String(value || "");
  const match = text.match(/^https:\/\/img\.vietqr\.io\/image\/(\d{6})-(\d+)-[\w]+\.png\?(.*)$/);
  if (!match) return text;
  const params = new globalThis.URLSearchParams(match[3]);
  return buildBankQrPayload({ bankBin: match[1], accountNumber: match[2], amount: Number(params.get("amount")), reference: params.get("addInfo") });
}
