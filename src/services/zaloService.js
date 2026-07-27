import { zaloConfigRepository } from "./repositories/zaloConfigRepository.js";

export const DEFAULT_ZALO_TEMPLATE = [
  "\uD83D\uDD14 \u0110\u01A0N H\u00C0NG M\u1EDAI - G\u00C1NH H\u00C0NG RONG",
  "\uD83D\uDD16 M\u00E3 \u0111\u01A1n: {{order_code}}",
  "\uD83D\uDD52 Th\u1EDDi gian \u0111\u1EB7t: {{order_time}}",
  "\u23F0 Gi\u1EDD l\u1EA5y: {{pickup_time}}",
  "\uD83D\uDCE6 H\u00ECnh th\u1EE9c nh\u1EADn: {{fulfillment_type}}",
  "\uD83D\uDCB3 Thanh to\u00E1n: {{payment_method}}",
  "\uD83D\uDD0E Tra c\u1EE9u \u0111\u01A1n: {{order_link}}",
  "",
  "\uD83D\uDC64 TH\u00D4NG TIN KH\u00C1CH",
  "\u2022 Kh\u00E1ch: {{customer_name}} - {{phone}}",
  "\uD83D\uDCCD \u0110\u1ECBa ch\u1EC9: {{address}}",
  "\uD83D\uDDFA\uFE0F B\u1EA3n \u0111\u1ED3: {{map_link}}",
  "",
  "\uD83C\uDF7D\uFE0F CHI TI\u1EBET M\u00D3N",
  "{{items}}",
  "",
  "\uD83D\uDCB0 THANH TO\u00C1N",
  "\uD83D\uDE9A Ph\u00ED giao h\u00E0ng: {{shipping_fee}}",
  "\uD83C\uDF81 \u01AFu \u0111\u00E3i: -{{promo_discount}}",
  "\u2B50 D\u00F9ng \u0111i\u1EC3m th\u01B0\u1EDFng: -{{points_discount}}",
  "\u2705 T\u1ED5ng thanh to\u00E1n: {{total}}",
  "\uD83D\uDCDD Ghi ch\u00FA: {{note}}"
].join("\n");

function normalizeZaloConfig(config, fallbackPhone) {
  return {
    phone: String(config?.phone || fallbackPhone || "0788422424").replace(/\D/g, "") || String(fallbackPhone || "0788422424").replace(/\D/g, ""),
    template: DEFAULT_ZALO_TEMPLATE
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
    pickup_time: "",
    fulfillment_type: "",
    pickup_branch: "",
    delivery_branch: "",
    payment_method: "",
    map_link: "",
    distance_km: "",
    subtotal: "",
    shipping_fee: "",
    promo_discount: "",
    points_discount: "",
    order_link: ""
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
