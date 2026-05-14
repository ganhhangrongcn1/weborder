import { zaloConfigRepository } from "./repositories/zaloConfigRepository.js";

export const DEFAULT_ZALO_TEMPLATE = [
  "\uD83E\uDDE1 G\u00C1NH H\u00C0NG RONG - \u0110\u1EB6T H\u00C0NG TH\u00C0NH C\u00D4NG",
  "\uD83D\uDD16 M\u00E3 \u0111\u01A1n: {{order_code}}",
  "\uD83D\uDD52 Th\u1EDDi gian: {{order_time}}",
  "\uD83D\uDCE6 H\u00ECnh th\u1EE9c: {{fulfillment_type}}",
  "",
  "\uD83D\uDC64 Kh\u00E1ch: {{customer_name}} - {{phone}}",
  "\uD83D\uDCCD \u0110\u1ECBa ch\u1EC9: {{address}}",
  "\uD83D\uDDFA\uFE0F B\u1EA3n \u0111\u1ED3: {{map_link}}",
  "",
  "\uD83C\uDF7D\uFE0F M\u00F3n \u0111\u00E3 \u0111\u1EB7t",
  "{{items}}",
  "",
  "\uD83D\uDE9A Ph\u00ED ship: {{shipping_fee}}",
  "\u2705 T\u1ED5ng thanh to\u00E1n: {{total}}",
  "\uD83D\uDCDD Ghi ch\u00FA: {{note}}",
  "",
  "\uD83D\uDD0E Xem l\u1EA1i \u0111\u01A1n h\u00E0ng: {{order_link}}",
  "C\u1EA3m \u01A1n b\u1EA1n \u0111\u00E3 \u0111\u1EB7t m\u00F3n t\u1EA1i G\u00E1nh H\u00E0ng Rong \uD83E\uDDE1"
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
    shipping_fee: "",
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
