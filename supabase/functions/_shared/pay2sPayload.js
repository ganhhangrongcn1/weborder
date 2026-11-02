const text = (value) => String(value ?? "").trim();

const BANK_BINS = {
  MB: "970422", MBBANK: "970422", VIETCOMBANK: "970436", VCB: "970436", BIDV: "970418",
  TECHCOMBANK: "970407", TCB: "970407", AGRIBANK: "970405", VIETINBANK: "970415", ICB: "970415",
  ACB: "970416", VPBANK: "970432", TPBANK: "970423", SACOMBANK: "970403", STB: "970403",
  EXIMBANK: "970431", EIB: "970431", HDBANK: "970437", SEABANK: "970440", OCB: "970448",
  BAOVIETBANK: "970438", BVBANK: "970454", VIETCAPITALBANK: "970454", VIB: "970441", SHB: "970443",
  SAIGONBANK: "970400", PUBLICBANK: "970439"
};

export function parsePay2sTransaction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_transaction");
  const id = text(input.id);
  const accountNumber = text(input.accountNumber);
  const amount = Number(input.transferAmount);
  const direction = text(input.transferType).toUpperCase();
  if (!id || id.length > 160 || !accountNumber || !["IN", "OUT"].includes(direction) ||
      !Number.isSafeInteger(amount) || amount <= 0) throw new Error("invalid_transaction");
  const rawTime = text(input.transactionDate).replace(" ", "T");
  const time = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(rawTime) ? rawTime : `${rawTime}+07:00`);
  if (Number.isNaN(time.getTime())) throw new Error("invalid_transaction_date");
  const references = new Set();
  const add = (value) => { const key = text(value).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (key) references.add(key); };
  // paymentCode is optional. Never match short substrings of longer order codes.
  add(input.paymentCode);
  for (const match of text(input.content).toUpperCase().matchAll(/(?:^|[^A-Z0-9])(GHR-?\d{4,}(?:-?QR-?\d{4,})?|POS-?\d{8}-?\d{6})(?=$|[^A-Z0-9])/g)) add(match[1]);
  return {
    id, accountNumber, amount, direction, transactionDate: time.toISOString(),
    references: [...references], gateway: text(input.gateway),
    bankBin: BANK_BINS[text(input.gateway).toUpperCase().replace(/[^A-Z0-9]/g, "")] || "", raw: input
  };
}

export async function verifyPay2sToken(authorization, expectedToken) {
  if (!expectedToken || !authorization?.startsWith("Bearer ")) return false;
  const digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [actual, expected] = await Promise.all([digest(authorization.slice(7)), digest(expectedToken)]);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
