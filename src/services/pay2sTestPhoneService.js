export async function hashPay2sTestPhones(value = "") {
  const phones = [...new Set(String(value).split(/[\s,;]+/).filter(Boolean).map((phone) => {
    const digits = phone.replace(/\D/g, "");
    return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits;
  }))];
  if (phones.some((phone) => !/^0\d{9}$/.test(phone))) {
    throw new Error("Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số.");
  }
  return Promise.all(phones.map(async (phone) => {
    const digest = await crypto.subtle.digest("SHA-256", new globalThis.TextEncoder().encode(phone));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }));
}
