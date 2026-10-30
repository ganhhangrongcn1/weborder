// <define:import.meta.env>
var define_import_meta_env_default = {};

// ghr-pos-mobile-native/src/services/pos/compactReceiptLayout.js
function compactReceiptLayout(lines, { preparation = false } = {}) {
  let source = "";
  let time = "";
  let payment = "";
  const result = [];
  const hasPaidAmount = lines.some((line) => /^@@(?:BOLD)?ROW:ĐÃ THANH TOÁN/.test(line));
  const hasTotal = lines.some((line) => /^@@(?:BOLD)?ROW:(?:TỔNG ĐƠN|TỔNG TIỀN)\t/.test(line));
  for (const line of lines) {
    if (/^Nguồn:/.test(line)) {
      source = line.slice(6).trim();
      continue;
    }
    if (/^(?:Giờ:|Giờ in:)/.test(line)) {
      time = line.replace(/^(?:Giờ:|Giờ in:)\s*/, "");
      continue;
    }
    if (/^@@(?:BOLD)?ROW:CÒN PHẢI THU\t0(?:[.,]0+)?(?:đ| ₫)?$/.test(line)) continue;
    if (line.includes("*** KH\xD4NG THU TH\xCAM TI\u1EC0N ***")) continue;
    if (hasPaidAmount && /^(?:Thanh toán:|@@(?:BOLD)?ROW:Thanh toán\t)/.test(line)) continue;
    if (!preparation && !hasPaidAmount && /^Thanh toán:/.test(line)) {
      const status = line.match(/^Thanh toán:\s*(.*?)\s*-\s*(ĐÃ THANH TOÁN|CHƯA THANH TOÁN)$/i);
      payment = status ? `@@BOLDCENTER:${status[2]} \xB7 ${status[1]}` : line;
      continue;
    }
    const paid = line.match(/^@@(?:BOLD)?ROW:ĐÃ THANH TOÁN\s*(.*?)\t(.+)$/);
    if (paid) {
      if (!hasTotal) result.push(`@@BOLDROW:T\u1ED4NG TI\u1EC0N	${paid[2]}`);
      result.push(`@@BOLDCENTER:\u0110\xC3 THANH TO\xC1N${paid[1] ? ` \xB7 ${paid[1]}` : ""}`);
      continue;
    }
    if (preparation && /^(?:Chi nhánh:|Thu ngân:|Khách:|SĐT:|Địa chỉ:|Thanh toán:)/.test(line)) continue;
    if (preparation && line.includes("CH\u01AFA THANH TO\xC1N")) continue;
    if (preparation && /^Thẻ rung:/.test(line)) {
      result.push(`@@BOLDROW:TH\u1EBA RUNG	${line.slice(9).trim()}`);
      continue;
    }
    result.push(line.replace(/^@@(?:BOLD)?ROW:TỔNG ĐƠN\t/, "@@BOLDROW:T\u1ED4NG TI\u1EC0N	"));
  }
  const meta = [source, time].filter(Boolean).join(" \xB7 ");
  const firstRule = result.indexOf("@@RULE");
  if (meta) result.splice(firstRule < 0 ? 1 : firstRule + 1, 0, meta);
  if (payment) result.push(payment);
  return result;
}

// ghr-pos-mobile-native/src/services/pos/receiptTemplate.js
var DEFAULT_RECEIPT_TEMPLATE = {
  version: 1,
  enabled: true,
  brand: "G\xC1NH H\xC0NG RONG",
  slogan: "",
  customerTitle: "H\xD3A \u0110\u01A0N B\xC1N H\xC0NG",
  kitchenTitle: "PHI\u1EBEU L\xC0M M\xD3N",
  thanks: "C\u1EA3m \u01A1n anh ch\u1ECB. H\u1EB9n g\u1EB7p l\u1EA1i!",
  website: "ganhhangrong.vn",
  hotline: "0933799061",
  kitchenReminder: "",
  showBranch: true,
  showCashier: false,
  showCustomer: true,
  showLoyalty: true,
  showStamps: true
};
function normalizeReceiptTemplate(value = {}) {
  const result = { ...DEFAULT_RECEIPT_TEMPLATE };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "boolean") result[key] = typeof value?.[key] === "boolean" ? value[key] : result[key];
    if (typeof result[key] === "string") {
      result[key] = String(value?.[key] ?? result[key]).normalize("NFC").replace(/[\x00-\x1f\x7f]/g, " ").replace(/@@/g, "").trim().slice(0, 100);
    }
  }
  for (const key of ["brand", "customerTitle", "kitchenTitle"]) {
    if (!result[key]) result[key] = DEFAULT_RECEIPT_TEMPLATE[key];
  }
  result.enabled = true;
  return result;
}
var STAMP_LINE = /^(?:@@STAMPS:|@@STAMPEND|(?:@@CENTER:)?(?:TÍCH TEM NHẬN QUÀ|TEM THÀNH VIÊN|Cung cấp SĐT để tích tem|Quét mã bên trên để tích tem đổi quà|Còn \d+ tem nữa để nhận quà|Đã đủ tem để nhận quà|\d+\/10 tem)|Tem khả dụng|Bạn có \d+\/10 tem|\d+ tem đang giữ|Mỗi ngày tối đa|Hôm nay đã nhận tem|Đủ tem:|Còn \d+ tem để nhận quà|Tem: chưa cập nhật)/;
var PROMO_LINE = /^(?:@@(?:BOLD)?CENTER:)?(?:ĐỪNG BỎ LỠ ĐIỂM|ĐIỂM THÀNH VIÊN|QUÉT QR VÀO WEBSITE|Xem \/ nhận|Quét QR để tích|Quét để nhận|Quét QR để nhận|Quét QR để xem|Nhận trong 24 giờ|Cảm ơn quý khách!|Hotline:|ganhhangrong\.vn)/;
function normalizeLegacyReceiptLine(line) {
  return line.replace(/^@@CENTER:HOA DON BAN HANG$/, "@@CENTER:H\xD3A \u0110\u01A0N B\xC1N H\xC0NG").replace(/^Chi nhanh:/, "Chi nh\xE1nh:").replace(/^Thu ngan:/, "Thu ng\xE2n:").replace(/^Nguon:/, "Ngu\u1ED3n:").replace(/^Ghi chu:/, "Ghi ch\xFA:").replace(/^Ma TT:/, "M\xE3 TT:").replace(/^Thanh toan: Vi MoMo - DA THANH TOAN$/, "Thanh to\xE1n: V\xED MoMo - \u0110\xC3 THANH TO\xC1N").replace(/^(@@(?:BOLD)?ROW:)TONG DON\t/, "$1T\u1ED4NG \u0110\u01A0N	").replace(/^(@@(?:BOLD)?ROW:)DA THANH TOAN MOMO\t/, "$1\u0110\xC3 THANH TO\xC1N V\xCD MOMO	").replace(/^(@@(?:BOLD)?ROW:)CON PHAI THU\t/, "$1C\xD2N PH\u1EA2I THU	").replace(/^@@CENTER:\*\*\* KHONG THU THEM TIEN \*\*\*$/, "@@CENTER:*** KH\xD4NG THU TH\xCAM TI\u1EC0N ***").replace(/^(@@(?:BOLD)?ROW:.*\t[\d.,]+)d$/, "$1\u0111");
}
function applyReceiptTemplate(text = "", value = {}, context = {}) {
  const config = normalizeReceiptTemplate(value);
  if (!config.enabled || !text) return text;
  const original = String(text).split("\n").map(normalizeLegacyReceiptLine);
  if (!original.some((line) => line === "@@CENTER:PHI\u1EBEU L\xC0M M\xD3N" || line === "@@CENTER:H\xD3A \u0110\u01A0N B\xC1N H\xC0NG" || line === `@@CENTER:${config.customerTitle}` || line === `@@CENTER:${config.kitchenTitle}`)) return text;
  const preparation = typeof context.preparation === "boolean" ? context.preparation : original.includes("@@CENTER:PHI\u1EBEU L\xC0M M\xD3N") || original.includes(`@@CENTER:${config.kitchenTitle}`);
  const stamps = original.filter((line) => STAMP_LINE.test(line) && line !== "@@STAMPEND");
  const orderIndex = original.findIndex((line) => line.startsWith("@@BIG:"));
  const customFooter = new Set([
    config.website,
    config.thanks,
    config.slogan,
    config.kitchenReminder,
    [config.website, config.hotline].filter(Boolean).join(" \xB7 ")
  ].filter(Boolean));
  let branchFooter = false;
  let body = original.filter((line, index) => {
    if (index < (orderIndex < 0 ? 2 : orderIndex) && /^@@(?:BOLD)?CENTER:/.test(line)) return false;
    if (line === "@@CENTER:Th\xF4ng tin chi nh\xE1nh") {
      branchFooter = true;
      return false;
    }
    if (branchFooter) {
      if (line === "@@RULE") branchFooter = false;
      else return false;
    }
    if (line === "@@QR" || STAMP_LINE.test(line) || PROMO_LINE.test(line)) return false;
    if (/^@@BOLDCENTER:\d+$/.test(line) && original[index - 1] === "@@CENTER:Xem / nh\u1EADn t\xEDch l\u0169y c\u1EE7a \u0111\u01A1n") return false;
    if (customFooter.has(line.replace(/^@@(?:BOLD)?CENTER:/, ""))) return false;
    if (line.includes("KI\u1EC2M TRA \u0110\u1EE6 M\xD3N - TOPPING - GHI CH\xDA")) return false;
    if (!config.showBranch && /^Chi nhánh:/.test(line)) return false;
    if (!config.showCashier && /^Thu ngân:/.test(line)) return false;
    if (!config.showCustomer && /^(Khách:|SĐT:|Địa chỉ:)/.test(line)) return false;
    return true;
  }).map((line) => {
    if (!line.startsWith("Ngu\u1ED3n:")) return line;
    const source = line.slice(6).trim();
    const label = { pos: "T\u1EA1i qu\u1EA7y", pos_mobile: "T\u1EA1i qu\u1EA7y", website: "Website", web: "Website", grabfood: "GrabFood", grab: "GrabFood", shopeefood: "ShopeeFood" }[source.toLowerCase()] || source;
    return `Ngu\u1ED3n: ${label}`;
  });
  while (body.length && ["@@RULE", "@@SPACE", ""].includes(body[body.length - 1])) body.pop();
  body = compactReceiptLayout(body, { preparation });
  const header = preparation ? [] : [`@@BOLDCENTER:${config.brand}`];
  if (!preparation && config.slogan) header.push(`@@CENTER:${config.slogan}`);
  header.push(`@@CENTER:${preparation ? config.kitchenTitle : config.customerTitle}`);
  const footer = ["@@RULE"];
  if (preparation) {
    if (config.kitchenReminder) footer.push(`@@CENTER:${config.kitchenReminder}`);
  } else {
    if (config.showLoyalty && context.includeLoyalty !== false) {
      const legacyPoints = original.join("\n").match(/(?:Quét để nhận |Quét QR để xem \/ nhận )([\d.,]+)(?: điểm| của đơn này|$)/m);
      const previousNumber = original.find((line, index) => /^@@BOLDCENTER:\d+$/.test(line) && original[index - 1] === "@@CENTER:Xem / nh\u1EADn t\xEDch l\u0169y c\u1EE7a \u0111\u01A1n");
      const points = Math.max(0, Math.floor(Number(context.expectedEarnPoints) || Number(legacyPoints?.[1]?.replace(/[.,]/g, "")) || Number(previousNumber?.slice(13)) || 0));
      footer.push(
        "@@BOLDCENTER:\u0110\u1EEANG B\u1ECE L\u1EE0 \u0110I\u1EC2M \u0110\u01A0N N\xC0Y",
        points > 0 ? `@@CENTER:Qu\xE9t \u0111\u1EC3 nh\u1EADn ${points}` : "@@CENTER:Qu\xE9t \u0111\u1EC3 nh\u1EADn t\xEDch l\u0169y c\u1EE7a \u0111\u01A1n"
      );
      footer.push("@@QR");
      footer.push("@@CENTER:Nh\u1EADn trong 24 gi\u1EDD k\u1EC3 t\u1EEB l\xFAc mua");
    }
    if (config.showStamps) {
      const chart = stamps.find((line) => line.startsWith("@@STAMPS:"));
      const hasPhone = typeof context.hasCustomerPhone === "boolean" ? context.hasCustomerPhone : !original.some((line) => ["@@CENTER:Cung c\u1EA5p S\u0110T \u0111\u1EC3 t\xEDch tem", "@@CENTER:Qu\xE9t m\xE3 b\xEAn tr\xEAn \u0111\u1EC3 t\xEDch tem \u0111\u1ED5i qu\xE0"].includes(line)) && Boolean(context.customerPhone || chart || original.some((line) => /^(?:SĐT:|Khách:).*0[35789]\d{8}/.test(line)));
      if (!hasPhone) footer.push("@@RULE", "@@CENTER:TEM TH\xC0NH VI\xCAN", "@@STAMPS:0", context.includeLoyalty !== false && config.showLoyalty ? "@@CENTER:Qu\xE9t m\xE3 b\xEAn tr\xEAn \u0111\u1EC3 t\xEDch tem \u0111\u1ED5i qu\xE0" : "@@CENTER:Cung c\u1EA5p S\u0110T \u0111\u1EC3 t\xEDch tem");
      else if (chart) {
        const remaining = Math.max(0, 10 - Math.floor(Number(chart.slice(9)) || 0));
        footer.push("@@RULE", "@@CENTER:TEM TH\xC0NH VI\xCAN", chart, remaining > 0 ? `@@CENTER:C\xF2n ${remaining} tem n\u1EEFa \u0111\u1EC3 nh\u1EADn qu\xE0` : "@@CENTER:\u0110\xE3 \u0111\u1EE7 tem \u0111\u1EC3 nh\u1EADn qu\xE0");
        footer.push(...stamps.filter((line) => /^\d+ tem đang giữ/.test(line)));
      }
    }
    const contact = [config.website, config.hotline].filter(Boolean).join(" \xB7 ");
    if (contact) footer.push(`@@CENTER:${contact}`);
    if (config.thanks) footer.push(`@@CENTER:${config.thanks}`);
  }
  return [...header, ...body, ...footer].join("\n").replace(/(?:@@RULE\n){2,}/g, "@@RULE\n");
}

// src/services/stampReceiptService.js
function buildStampReceiptSvg(available) {
  const count = Math.max(0, Math.min(10, Math.floor(Number(available) || 0)));
  const slots = Array.from({ length: 10 }, (_, index) => {
    const x = 13 + index * 26;
    const y = 14;
    return `<circle cx="${x}" cy="${y}" r="9"/>${index < count ? `<path d="M ${x - 4} ${y} l 3 3 l 5 -6"/>` : ""}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 28" role="img" aria-label="${count} tr\xEAn 10 \xF4 tem" style="display:block;width:100%;max-width:264px;margin:4px auto;break-inside:avoid" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${slots}</svg>`;
}

// src/services/receiptTemplateHtml.js
function escape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function renderReceiptTemplateBody(text, qrImage = "") {
  return String(text).split("\n").map((line) => {
    if (/^@@RECEIPT(?:ORDER|POINTS):/.test(line) || line === "@@STAMPEND") return "";
    if (line === "@@RULE") return '<hr class="receipt-rule" />';
    if (line === "@@SPACE") return '<div class="receipt-space"></div>';
    if (line === "@@QR") return qrImage ? `<img class="receipt-qr" src="${escape(qrImage)}" alt="QR c\u1EE7a bill" />` : '<div class="receipt-qr-placeholder">QR C\u1EE6A BILL</div>';
    if (line.startsWith("@@STAMPS:")) return buildStampReceiptSvg(Math.min(10, Math.max(0, Number(line.slice(9)) || 0)));
    for (const prefix of ["@@BOLDROW:", "@@ROW:"]) {
      if (!line.startsWith(prefix)) continue;
      const [left, ...right] = line.slice(prefix.length).split("	");
      return `<div class="receipt-row ${prefix === "@@BOLDROW:" ? "receipt-bold" : ""}"><span>${escape(left)}</span><span>${escape(right.join(" "))}</span></div>`;
    }
    for (const [prefix, className] of [["@@BOLDCENTER:", "receipt-center receipt-bold"], ["@@CENTER:", "receipt-center"], ["@@BIG:", "receipt-center receipt-big"]]) {
      if (line.startsWith(prefix)) return `<div class="${className}">${escape(line.slice(prefix.length))}</div>`;
    }
    return `<div>${escape(line)}</div>`;
  }).join("");
}
var RECEIPT_TEMPLATE_CSS = `
  .receipt-paper{background:white;color:#111;padding:16px;font:12px/1.45 Arial,system-ui,sans-serif;overflow-wrap:anywhere}
  .receipt-center{text-align:center}.receipt-bold{font-weight:700}.receipt-big{font-size:24px;font-weight:800}
  .receipt-row{display:flex;justify-content:space-between;gap:12px}.receipt-row>span:last-child{flex-shrink:0}
  .receipt-rule{border:0;border-top:1px dashed #999;margin:7px 0}.receipt-space{height:4px}
  .receipt-qr{display:block;width:145px;height:145px;margin:12px auto}
  .receipt-qr-placeholder{width:120px;height:120px;margin:12px auto;border:2px dashed #555;display:grid;place-items:center;font-weight:700;font-size:11px}
`;
function buildTemplatePrintHtml(text, { qrImage = "", width = 80 } = {}) {
  return `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><title>In bill</title><style>
    ${RECEIPT_TEMPLATE_CSS} body{margin:0}.receipt-paper{width:${width === 58 ? 50 : 72}mm;box-sizing:border-box;margin:auto;padding:2mm}
    @page{size:${width === 58 ? 58 : 80}mm auto;margin:2mm}
  </style></head><body><main class="receipt-paper">${renderReceiptTemplateBody(text, qrImage)}</main>
  <script>window.addEventListener("load",()=>{window.focus();window.print()})</script></body></html>`;
}

// src/services/receiptRenderCore.js
var PRINTER_MODE = {
  webPrint: "webPrint",
  bridge: "bridge"
};
var DEFAULT_RECEIPT_WIDTH_MM = 80;
var DEFAULT_STORE_NAME = "G\xE1nh H\xE0ng Rong";
var DEFAULT_BRIDGE_TIMEOUT_MS = 6e3;
var LOYALTY_QR_URL = "https://ganhhangrong.vn/orders";
var SUPPORT_HOTLINE = "0933799061";
var APP_SOURCE_KEYS = [
  "grab",
  "grabfood",
  "shopee",
  "shopeefood",
  "xanh",
  "xanhngon",
  "nexpos",
  "partner"
];
function toText(value = "") {
  return String(value || "").trim();
}
function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toMoney(value = 0) {
  return toNumber(value).toLocaleString("vi-VN");
}
function toReceiptWidth(value = DEFAULT_RECEIPT_WIDTH_MM) {
  const width = toNumber(value, DEFAULT_RECEIPT_WIDTH_MM);
  return width === 58 ? 58 : 80;
}
function getArray(value) {
  return Array.isArray(value) ? value : [];
}
function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function getImportMetaEnv() {
  return getObject(define_import_meta_env_default);
}
function getPrinterConfig(overrides = {}) {
  const env = getImportMetaEnv();
  const mode = toText(overrides.mode || env.VITE_PRINTER_MODE || PRINTER_MODE.webPrint);
  return {
    mode: mode === PRINTER_MODE.bridge ? PRINTER_MODE.bridge : PRINTER_MODE.webPrint,
    bridgeUrl: toText(overrides.bridgeUrl || env.VITE_PRINT_BRIDGE_URL),
    printerName: toText(overrides.printerName || env.VITE_PRINTER_NAME || "Xprinter"),
    receiptWidthMm: toReceiptWidth(overrides.receiptWidthMm || env.VITE_RECEIPT_WIDTH_MM),
    storeName: toText(overrides.storeName || env.VITE_RECEIPT_STORE_NAME || DEFAULT_STORE_NAME),
    timeoutMs: toNumber(overrides.timeoutMs || env.VITE_PRINT_BRIDGE_TIMEOUT_MS, DEFAULT_BRIDGE_TIMEOUT_MS),
    loyaltyUrl: toText(overrides.loyaltyUrl || env.VITE_RECEIPT_LOYALTY_URL || LOYALTY_QR_URL),
    loyaltyQrImage: toText(overrides.loyaltyQrImage)
  };
}
function formatDateTime(value = "") {
  const date = value ? new Date(value) : /* @__PURE__ */ new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
function buildLine(char = "-", width = 42) {
  return char.repeat(width);
}
function splitText(value = "", limit = 42) {
  const text = toText(value);
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= limit) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word.length > limit ? word.slice(0, limit) : word;
  });
  if (current) lines.push(current);
  return lines;
}
function alignMoneyLine(label = "", value = "", width = 42) {
  const left = toText(label);
  const right = toText(value);
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}
function buildPosQrReceiptText({
  branchName = "",
  amount = 0,
  transferContent = "",
  orderCode = "",
  customerName = ""
} = {}) {
  const width = 42;
  const lines = [
    "@@CENTER:G\xC1NH H\xC0NG RONG",
    "@@CENTER:QU\xC9T M\xC3 THANH TO\xC1N",
    buildLine("-", width)
  ];
  if (branchName) lines.push(`Chi nh\xE1nh: ${toText(branchName)}`);
  if (orderCode) lines.push(`M\xE3 bill: ${toText(orderCode)}`);
  if (customerName) lines.push(`Kh\xE1ch: ${toText(customerName)}`);
  lines.push(alignMoneyLine("S\u1ED1 ti\u1EC1n", toMoney(amount), width));
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:\u0110\u01B0a m\xE3 n\xE0y cho kh\xE1ch qu\xE9t");
  lines.push("@@QR");
  lines.push(buildLine("-", width));
  lines.push(`N\u1ED9i dung: ${toText(transferContent)}`);
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:C\u1EA3m \u01A1n qu\xFD kh\xE1ch!");
  return lines.join("\n");
}
function normalizeSource(value = "") {
  return toText(value).toLowerCase().replace(/[\s_-]+/g, "");
}
function isPartnerAppReceipt(receipt = {}) {
  const sourceText = [
    receipt.platform,
    receipt.sourceType,
    receipt.partnerSource,
    receipt.orderSource,
    receipt.channel
  ].map(normalizeSource).join(" ");
  return APP_SOURCE_KEYS.some((key) => sourceText.includes(key));
}
function normalizeReceiptItem(item = {}) {
  const options = getArray(item.options || item.toppings || item.optionGroups).map((option) => {
    if (typeof option === "string") return option;
    return toText(option?.label || option?.name || option?.value);
  }).filter(Boolean);
  return {
    name: toText(item.name || item.productName || item.product_name || "M\xF3n"),
    quantity: Math.max(1, Math.floor(toNumber(item.quantity, 1))),
    price: toNumber(item.price ?? item.unitPrice ?? item.unitTotal ?? item.unit_price),
    total: toNumber(item.total ?? item.totalPrice ?? item.total_price ?? item.lineTotal ?? item.line_total),
    note: toText(item.note),
    options
  };
}
function normalizeReceiptOrder(order = {}, config = {}) {
  const metadata = getObject(order.metadata);
  const raw = getObject(order.raw || order.rawData || order.raw_data);
  const rawMetadata = getObject(raw.metadata || raw.raw_data);
  const items = getArray(order.items).map(normalizeReceiptItem);
  const source = toText(
    order.platform || order.partnerSource || order.partner_source || order.sourceType || order.source || metadata.source || metadata.channel || "Website"
  );
  return {
    id: toText(order.id),
    orderCode: toText(order.displayOrderCode || order.orderCode || order.order_code || order.id),
    platform: source,
    sourceType: toText(order.sourceType || order.source || metadata.source),
    partnerSource: toText(order.partnerSource || order.partner_source || metadata.partnerSource),
    orderSource: toText(order.orderSource || metadata.orderSource),
    channel: toText(order.channel || metadata.channel),
    branchName: toText(order.branchName || order.branch_name || metadata.branchName || raw.branch_name || config.branchName),
    branchAddress: toText(order.branchAddress || order.branch_address || metadata.branchAddress || raw.branch_address),
    branchPhone: toText(order.branchPhone || order.branch_phone || metadata.branchPhone || raw.branch_phone),
    customerName: toText(order.customerName || order.customer_name || "Kh\xE1ch"),
    customerPhone: toText(order.customerPhone || order.customer_phone),
    cashierName: toText(order.cashierName || order.cashier_name || metadata.cashierName),
    pagerNumber: toText(order.pagerNumber || order.pager_number || metadata.pagerNumber),
    stampSummary: order.stampSummary,
    customerAddress: toText(order.customerAddress || order.address || metadata.address || rawMetadata.address),
    fulfillmentType: toText(order.fulfillmentType || order.fulfillment_type || metadata.fulfillmentType),
    paymentMethod: toText(order.paymentMethod || order.payment_method || metadata.paymentMethod),
    paymentStatus: toText(order.paymentStatus || order.payment_status || metadata.paymentStatus || metadata.payment_status),
    paymentAmount: toNumber(order.paymentAmount ?? order.payment_amount ?? metadata.paymentAmount),
    paidAt: toText(order.paidAt || order.paid_at || metadata.paidAt || metadata.paid_at),
    note: toText(order.note || metadata.note || rawMetadata.note),
    promoCode: toText(order.promoCode || order.promo_code || metadata.promoCode || metadata.couponCode),
    createdAt: toText(order.createdAt || order.created_at || order.orderTime || order.order_time),
    subtotal: toNumber(order.subtotal ?? order.subtotal_amount ?? metadata.subtotal),
    shippingFee: toNumber(order.shippingFee ?? order.shipping_fee ?? metadata.shippingFee),
    discount: toNumber(
      order.discount ?? order.discountAmount ?? order.discount_amount ?? order.promoDiscount ?? order.promo_discount ?? metadata.discount ?? metadata.discountAmount ?? metadata.promoDiscount
    ),
    expectedEarnPoints: Math.max(0, Math.floor(toNumber(
      order.expectedEarnPoints ?? order.expected_earn_points ?? metadata.expectedEarnPoints ?? metadata.expected_earn_points
    ))),
    totalAmount: toNumber(order.totalAmount ?? order.total_amount ?? metadata.totalAmount),
    items
  };
}
function buildReceiptRow(label = "", value = "", strong = false) {
  return `${strong ? "@@BOLDROW:" : "@@ROW:"}${toText(label)}	${toText(value)}`;
}
function getReceiptTotal(order = {}) {
  if (order.totalAmount > 0) return order.totalAmount;
  const itemTotal = getArray(order.items).reduce((total, item) => {
    const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
    return total + lineTotal;
  }, 0);
  return Math.max(0, itemTotal + order.shippingFee - order.discount);
}
function isReceiptPaid(receipt = {}) {
  const status = toText(receipt.paymentStatus).toLowerCase();
  return ["paid", "converted"].includes(status) || Boolean(toText(receipt.paidAt));
}
function getReceiptPaymentLabel(receipt = {}) {
  const method = toText(receipt.paymentMethod).toLowerCase();
  if (method === "momo") return "MOMO";
  if (["bank_qr", "bankqr", "qr", "sepay"].includes(method)) return "QR";
  if (["cash", "cod"].includes(method)) return "TI\u1EC0N M\u1EB6T";
  return toText(receipt.paymentMethod).toUpperCase() || "THANH TO\xC1N";
}
function pushOrderMeta(lines, receipt, width) {
  if (receipt.branchName) lines.push(`Chi nh\xE1nh: ${receipt.branchName}`);
  if (receipt.cashierName) lines.push(`Thu ng\xE2n: ${receipt.cashierName}`);
  if (receipt.pagerNumber) lines.push(`Th\u1EBB rung: ${receipt.pagerNumber}`);
  lines.push(`Ngu\u1ED3n: ${receipt.platform || "Website"}`);
  lines.push(`Gi\u1EDD: ${formatDateTime(receipt.createdAt)}`);
  lines.push("@@SPACE");
  if (receipt.customerName || receipt.customerPhone) {
    lines.push(`Kh\xE1ch: ${receipt.customerName || "Kh\xE1ch"}${receipt.customerPhone ? ` - ${receipt.customerPhone}` : ""}`);
  }
  if (receipt.customerAddress) splitText(`\u0110\u1ECBa ch\u1EC9: ${receipt.customerAddress}`, width).forEach((line) => lines.push(line));
  lines.push("@@SPACE");
  if (receipt.fulfillmentType) lines.push(`H\xECnh th\u1EE9c: ${receipt.fulfillmentType}`);
  if (receipt.paymentMethod) {
    lines.push(`Thanh to\xE1n: ${getReceiptPaymentLabel(receipt)}${isReceiptPaid(receipt) ? " - \u0110\xC3 THANH TO\xC1N" : " - CH\u01AFA THANH TO\xC1N"}`);
  }
}
function pushItemsText(lines, receipt, width, showMoney) {
  if (!receipt.items.length) {
    lines.push("Ch\u01B0a c\xF3 chi ti\u1EBFt m\xF3n.");
    return;
  }
  receipt.items.forEach((item) => {
    const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
    const itemLabel = `${item.quantity} \xD7 ${item.name}`;
    lines.push(buildReceiptRow(itemLabel, showMoney && lineTotal ? toMoney(lineTotal) : "", true));
    item.options.forEach((option) => lines.push(`  + ${option}`));
    if (item.note) splitText(`  Ghi ch\xFA: ${item.note}`, width).forEach((line) => lines.push(line));
  });
}
function pushBranchFooter(lines, receipt, width) {
  if (!receipt.branchName && !receipt.branchAddress && !receipt.branchPhone) return;
  lines.push("@@RULE");
  lines.push("@@CENTER:Th\xF4ng tin chi nh\xE1nh");
  if (receipt.branchName) splitText(receipt.branchName, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchAddress) splitText(receipt.branchAddress, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchPhone) lines.push(`@@CENTER:${receipt.branchPhone}`);
}
function pushLoyaltyFooter(lines) {
  lines.push("@@RULE");
  lines.push("@@BOLDCENTER:\u0110\u1EEANG B\u1ECE L\u1EE0 \u0110I\u1EC2M C\u1EE6A \u0110\u01A0N N\xC0Y");
  lines.push("@@QR");
  lines.push("@@CENTER:Qu\xE9t QR \u0111\u1EC3 t\xEDch 10 - 15% gi\xE1 tr\u1ECB \u0111\u01A1n");
  lines.push("@@CENTER:ganhhangrong.vn");
  lines.push(`@@CENTER:Hotline: ${SUPPORT_HOTLINE}`);
  lines.push("@@CENTER:C\u1EA3m \u01A1n qu\xFD kh\xE1ch!");
}
function pushPartnerLoyaltyPrompt(lines, expectedEarnPoints = 0) {
  const safeExpectedEarnPoints = Math.max(0, Math.floor(toNumber(expectedEarnPoints)));
  lines.push("@@BOLDCENTER:\u0110\u1EEANG B\u1ECE L\u1EE0 \u0110I\u1EC2M C\u1EE6A \u0110\u01A0N N\xC0Y");
  lines.push("@@QR");
  lines.push(safeExpectedEarnPoints > 0 ? `@@BOLDCENTER:Qu\xE9t \u0111\u1EC3 nh\u1EADn ${safeExpectedEarnPoints.toLocaleString("vi-VN")} c\u1EE7a \u0111\u01A1n n\xE0y` : "@@BOLDCENTER:Qu\xE9t \u0111\u1EC3 nh\u1EADn t\xEDch l\u0169y c\u1EE7a \u0111\u01A1n n\xE0y");
  lines.push("@@CENTER:ganhhangrong.vn");
  lines.push(`@@CENTER:Hotline: ${SUPPORT_HOTLINE}`);
}
function buildReceiptText(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
  const template = normalizeReceiptTemplate(options.receiptTemplate || normalizeReceiptTemplate());
  if (template.enabled && !template.showCustomer) {
    receipt.customerName = "";
    receipt.customerPhone = "";
    receipt.customerAddress = "";
  }
  const width = config.receiptWidthMm === 58 ? 32 : 48;
  const showMoney = !isPartnerAppReceipt(receipt);
  const receiptPaid = isReceiptPaid(receipt);
  const isPreparationTicket = showMoney && !receiptPaid;
  if (template.enabled && isPreparationTicket) {
    receipt.customerName = "";
    receipt.customerPhone = "";
    receipt.customerAddress = "";
  }
  const includeLoyaltyFooter = options.includeLoyaltyFooter !== false;
  const lines = [
    "@@CENTER:G\xC1NH H\xC0NG RONG",
    `@@CENTER:${isPreparationTicket ? "PHI\u1EBEU L\xC0M M\xD3N" : "H\xD3A \u0110\u01A0N B\xC1N H\xC0NG"}`,
    `@@BIG:${receipt.orderCode || "CH\u01AFA C\xD3 M\xC3"}`,
    "@@RULE"
  ];
  const usePartnerLoyaltyPrompt = options.partnerLoyaltyPrompt === true && isPartnerAppReceipt(receipt);
  if (usePartnerLoyaltyPrompt) {
    pushPartnerLoyaltyPrompt(lines, receipt.expectedEarnPoints);
  } else {
    pushOrderMeta(lines, receipt, width);
  }
  if (isPreparationTicket) {
    lines.push("@@CENTER:*** CH\u01AFA THANH TO\xC1N T\u1EA0I QU\u1EA6Y ***");
  }
  lines.push("@@RULE");
  pushItemsText(lines, receipt, width, showMoney && !isPreparationTicket);
  if (showMoney && !isPreparationTicket) {
    const receiptTotal = getReceiptTotal(receipt);
    lines.push("@@RULE");
    if (receipt.subtotal > 0) lines.push(buildReceiptRow("T\u1EA1m t\xEDnh", toMoney(receipt.subtotal)));
    if (receipt.promoCode) lines.push(buildReceiptRow("M\xE3 gi\u1EA3m gi\xE1", receipt.promoCode));
    if (receipt.discount > 0) lines.push(buildReceiptRow("Gi\u1EA3m gi\xE1", `-${toMoney(receipt.discount)}`));
    if (receipt.shippingFee > 0) lines.push(buildReceiptRow("Ph\xED ship", toMoney(receipt.shippingFee)));
    if (receiptPaid) {
      lines.push(buildReceiptRow("T\u1ED4NG \u0110\u01A0N", toMoney(receiptTotal)));
      lines.push(buildReceiptRow(`\u0110\xC3 THANH TO\xC1N ${getReceiptPaymentLabel(receipt)}`, toMoney(receipt.paymentAmount || receiptTotal), true));
      lines.push(buildReceiptRow("C\xD2N PH\u1EA2I THU", "0", true));
      lines.push("@@CENTER:*** KH\xD4NG THU TH\xCAM TI\u1EC0N ***");
    } else {
      lines.push(buildReceiptRow("T\u1ED4NG C\u1EA6N THU", toMoney(receiptTotal), true));
      lines.push("@@CENTER:*** CH\u01AFA THANH TO\xC1N ***");
    }
  }
  if (receipt.note) {
    lines.push("@@RULE");
    splitText(`Ghi ch\xFA \u0111\u01A1n: ${receipt.note}`, width).forEach((line) => lines.push(line));
  }
  if (!isPartnerAppReceipt(receipt)) pushBranchFooter(lines, receipt, width);
  if (includeLoyaltyFooter && !isPreparationTicket) pushLoyaltyFooter(lines);
  if (usePartnerLoyaltyPrompt) {
    lines.push("@@RULE");
    lines.push("@@CENTER:C\u1EA3m \u01A1n qu\xFD kh\xE1ch!");
  }
  if (!isPreparationTicket && receipt.stampSummary?.enabled) {
    const stampLines = [];
    stampLines.push("@@RULE", "@@CENTER:T\xCDCH TEM NH\u1EACN QU\xC0", `@@STAMPS:${receipt.stampSummary.available}`);
    stampLines.push(`Tem kh\u1EA3 d\u1EE5ng hi\u1EC7n t\u1EA1i: ${receipt.stampSummary.available}/10`);
    if (receipt.stampSummary.held) stampLines.push(`${receipt.stampSummary.held} tem \u0111ang gi\u1EEF cho \u0111\u01A1n \u0111\u1ED5i qu\xE0`);
    stampLines.push("M\u1ED7i ng\xE0y t\u1ED1i \u0111a 1 tem / s\u1ED1 \u0111i\u1EC7n tho\u1EA1i.");
    const qrIndex = lines.lastIndexOf("@@QR");
    lines.splice(qrIndex < 0 ? lines.length : qrIndex + 2, 0, ...stampLines);
  }
  return applyReceiptTemplate(lines.join("\n"), options.receiptTemplate || normalizeReceiptTemplate(), {
    preparation: isPreparationTicket,
    includeLoyalty: includeLoyaltyFooter,
    expectedEarnPoints: receipt.expectedEarnPoints,
    hasCustomerPhone: Boolean(toText(order.customerPhone || order.customer_phone))
  });
}
function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function qrImageUrl(value = LOYALTY_QR_URL) {
  if (String(value).includes("/nhan-diem/")) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=8&data=${encodeURIComponent(value)}`;
}
function buildReceiptHtml(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  return buildTemplatePrintHtml(buildReceiptText(order, options), {
    qrImage: config.loyaltyQrImage || qrImageUrl(config.loyaltyUrl),
    width: config.receiptWidthMm
  });
}
function buildPrintJobPayload(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
  const partnerReceipt = isPartnerAppReceipt(receipt);
  return {
    printerName: config.printerName,
    receiptWidthMm: config.receiptWidthMm,
    type: "customer_bill",
    text: buildReceiptText(order, {
      ...options,
      includeLoyaltyFooter: false,
      partnerLoyaltyPrompt: partnerReceipt
    }),
    loyaltyUrl: partnerReceipt ? config.loyaltyUrl : "",
    order: receipt
  };
}
export {
  APP_SOURCE_KEYS,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_RECEIPT_WIDTH_MM,
  DEFAULT_STORE_NAME,
  LOYALTY_QR_URL,
  PRINTER_MODE,
  SUPPORT_HOTLINE,
  alignMoneyLine,
  buildLine,
  buildPosQrReceiptText,
  buildPrintJobPayload,
  buildReceiptHtml,
  buildReceiptRow,
  buildReceiptText,
  escapeHtml,
  formatDateTime,
  getArray,
  getImportMetaEnv,
  getObject,
  getPrinterConfig,
  getReceiptPaymentLabel,
  getReceiptTotal,
  isPartnerAppReceipt,
  isReceiptPaid,
  normalizeReceiptItem,
  normalizeReceiptOrder,
  normalizeSource,
  pushBranchFooter,
  pushItemsText,
  pushLoyaltyFooter,
  pushOrderMeta,
  pushPartnerLoyaltyPrompt,
  qrImageUrl,
  splitText,
  toMoney,
  toNumber,
  toReceiptWidth,
  toText
};
