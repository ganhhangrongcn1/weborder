import { zaloConfigRepository } from "./repositories/zaloConfigRepository.js";

export const DEFAULT_ZALO_TEMPLATE = [
  "\uD83E\uDDE1 G\u00C1NH H\u00C0NG RONG - X\u00C1C NH\u1EACN \u0110\u01A0N",
  "\uD83D\uDD16 M\u00E3 \u0111\u01A1n: {{order_code}}",
  "\uD83D\uDD52 Th\u1EDDi gian \u0111\u1EB7t: {{order_time}}",
  "\uD83D\uDCE6 H\u00ECnh th\u1EE9c: {{fulfillment_type}}",
  "\uD83C\uDFEA Chi nh\u00E1nh l\u1EA5y \u0111\u01A1n: {{pickup_branch}}",
  "\uD83D\uDE9A Giao t\u1EEB chi nh\u00E1nh: {{delivery_branch}}",
  "\uD83D\uDCB3 Thanh to\u00E1n: {{payment_method}}",
  "\uD83D\uDC64 TH\u00D4NG TIN NG\u01AF\u1EDCI NH\u1EACN",
  "T\u00EAn: {{customer_name}}",
  "\u260E\uFE0F S\u0110T: {{phone}}",
  "\uD83D\uDCCD \u0110\u1ECBa ch\u1EC9: {{address}}",
  "\uD83D\uDDFA\uFE0F \u0110\u1ECBnh v\u1ECB: {{map_link}}",
  "\uD83D\uDCCF Kho\u1EA3ng c\u00E1ch: {{distance_km}}",
  "\uD83C\uDF7D\uFE0F M\u00F3n \u0111\u00E3 \u0111\u1EB7t",
  "{{items}}",
  "\uD83E\uDDFE T\u1EA1m t\u00EDnh: {{subtotal}}",
  "\uD83D\uDE9A Ph\u00ED ship: {{shipping_fee}}",
  "\u2705 T\u1ED4NG THANH TO\u00C1N: {{total}}",
  "\uD83D\uDCDD Ghi ch\u00FA: {{note}}",
  "M\u00ECnh g\u1EEDi \u0111\u01A1n \u0111\u1EC3 qu\u00E1n x\u00E1c nh\u1EADn v\u00E0 b\u1EAFt \u0111\u1EA7u chu\u1EA9n b\u1ECB m\u00F3n. C\u1EA3m \u01A1n qu\u00E1n \uD83E\uDDE1"
].join("\n");

function normalizeZaloConfig(config, fallbackPhone) {
  return {
    phone: String(config?.phone || fallbackPhone || "0788422424").replace(/\D/g, "") || String(fallbackPhone || "0788422424").replace(/\D/g, ""),
    template: String(config?.template || DEFAULT_ZALO_TEMPLATE)
  };
}

export function loadZaloConfig(fallbackPhone = "0788422424") {
  const fallback = normalizeZaloConfig({}, fallbackPhone);
  const saved = zaloConfigRepository.get(fallback);
  return normalizeZaloConfig(saved, fallback.phone);
}

export function saveZaloConfig(config) {
  const next = normalizeZaloConfig(config, "0788422424");
  zaloConfigRepository.set(next);
  return next;
}

export async function loadZaloConfigAsync(fallbackPhone = "0788422424") {
  const fallback = normalizeZaloConfig({}, fallbackPhone);
  const saved = await zaloConfigRepository.getAsync(fallback);
  return normalizeZaloConfig(saved, fallback.phone);
}

export async function saveZaloConfigAsync(config) {
  const next = normalizeZaloConfig(config, "0788422424");
  await zaloConfigRepository.setAsync(next);
  return next;
}

export function renderZaloTemplate(template, data) {
  const source = String(template || DEFAULT_ZALO_TEMPLATE);
  const values = {
    customer_name: "Kh\u00E1ch",
    phone: "",
    items: "",
    total: "0\u0111",
    address: "",
    note: "",
    order_code: "",
    order_time: "",
    fulfillment_type: "",
    pickup_branch: "",
    delivery_branch: "",
    payment_method: "",
    map_link: "",
    distance_km: "",
    subtotal: "",
    shipping_fee: ""
  };
  Object.assign(values, data || {});
  const output = source
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
      if (!keys.length) return true;
      return keys.every((key) => String(values[key] ?? "").trim() !== "");
    })
    .map((line) => {
      let nextLine = line;
      Object.entries(values).forEach(([key, value]) => {
        nextLine = nextLine.replaceAll(`{{${key}}}`, String(value ?? ""));
      });
      return nextLine;
    })
    .join("\n");
  return output;
}

export function buildZaloLink(phone, message) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  return `https://zalo.me/${cleanPhone}?text=${encodeURIComponent(String(message || ""))}`;
}