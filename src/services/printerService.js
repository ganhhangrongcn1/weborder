const PRINTER_MODE = {
  webPrint: "webPrint",
  bridge: "bridge"
};

const DEFAULT_RECEIPT_WIDTH_MM = 80;
const DEFAULT_STORE_NAME = "Gánh Hàng Rong";
const DEFAULT_BRIDGE_TIMEOUT_MS = 6000;
const LOYALTY_QR_URL = "https://ganhhangrong.vn/loyalty?source=receipt";
const SUPPORT_HOTLINE = "0933 799 061";

const APP_SOURCE_KEYS = [
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
  return getObject(import.meta.env);
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
    loyaltyUrl: toText(overrides.loyaltyUrl || env.VITE_RECEIPT_LOYALTY_URL || LOYALTY_QR_URL)
  };
}

function formatDateTime(value = "") {
  const date = value ? new Date(value) : new Date();
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
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:QUÉT MÃ THANH TOÁN",
    buildLine("-", width)
  ];

  if (branchName) lines.push(`Chi nhánh: ${toText(branchName)}`);
  if (orderCode) lines.push(`Mã bill: ${toText(orderCode)}`);
  if (customerName) lines.push(`Khách: ${toText(customerName)}`);

  lines.push(alignMoneyLine("Số tiền", toMoney(amount), width));
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Đưa mã này cho khách quét");
  lines.push("@@QR");
  lines.push(buildLine("-", width));
  lines.push(`Nội dung: ${toText(transferContent)}`);
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Cảm ơn quý khách!");
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

function centerText(value = "", width = 42) {
  const text = toText(value);
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  const right = Math.max(0, width - text.length - left);
  return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
}

function normalizeReceiptItem(item = {}) {
  const options = getArray(item.options || item.toppings || item.optionGroups)
    .map((option) => {
      if (typeof option === "string") return option;
      return toText(option?.label || option?.name || option?.value);
    })
    .filter(Boolean);

  return {
    name: toText(item.name || item.productName || item.product_name || "Món"),
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
    order.platform ||
      order.partnerSource ||
      order.partner_source ||
      order.sourceType ||
      order.source ||
      metadata.source ||
      metadata.channel ||
      "Website"
  );

  return {
    orderCode: toText(order.displayOrderCode || order.orderCode || order.order_code || order.id),
    platform: source,
    sourceType: toText(order.sourceType || order.source || metadata.source),
    partnerSource: toText(order.partnerSource || order.partner_source || metadata.partnerSource),
    orderSource: toText(order.orderSource || metadata.orderSource),
    channel: toText(order.channel || metadata.channel),
    branchName: toText(order.branchName || order.branch_name || metadata.branchName || raw.branch_name || config.branchName),
    branchAddress: toText(order.branchAddress || order.branch_address || metadata.branchAddress || raw.branch_address),
    branchPhone: toText(order.branchPhone || order.branch_phone || metadata.branchPhone || raw.branch_phone),
    customerName: toText(order.customerName || order.customer_name || "Khách"),
    customerPhone: toText(order.customerPhone || order.customer_phone),
    customerAddress: toText(order.customerAddress || order.address || metadata.address || rawMetadata.address),
    fulfillmentType: toText(order.fulfillmentType || order.fulfillment_type || metadata.fulfillmentType),
    paymentMethod: toText(order.paymentMethod || order.payment_method || metadata.paymentMethod),
    note: toText(order.note || metadata.note || rawMetadata.note),
    promoCode: toText(order.promoCode || order.promo_code || metadata.promoCode || metadata.couponCode),
    createdAt: toText(order.createdAt || order.created_at || order.orderTime || order.order_time),
    subtotal: toNumber(order.subtotal ?? order.subtotal_amount ?? metadata.subtotal),
    shippingFee: toNumber(order.shippingFee ?? order.shipping_fee ?? metadata.shippingFee),
    discount: toNumber(
      order.discount ??
        order.discountAmount ??
        order.discount_amount ??
        order.promoDiscount ??
        order.promo_discount ??
        metadata.discount ??
        metadata.discountAmount ??
        metadata.promoDiscount
    ),
    totalAmount: toNumber(order.totalAmount ?? order.total_amount ?? metadata.totalAmount),
    items
  };
}

function getReceiptTotal(order = {}) {
  if (order.totalAmount > 0) return order.totalAmount;
  const itemTotal = getArray(order.items).reduce((total, item) => {
    const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
    return total + lineTotal;
  }, 0);

  return Math.max(0, itemTotal + order.shippingFee - order.discount);
}

function pushOrderMeta(lines, receipt, width) {
  if (receipt.branchName) lines.push(`Chi nhánh: ${receipt.branchName}`);
  lines.push(`Nguồn: ${receipt.platform || "Website"}`);
  lines.push(`Giờ: ${formatDateTime(receipt.createdAt)}`);
  if (receipt.customerName || receipt.customerPhone) {
    lines.push(`Khách: ${receipt.customerName || "Khách"}${receipt.customerPhone ? ` - ${receipt.customerPhone}` : ""}`);
  }
  if (receipt.customerAddress) splitText(`Địa chỉ: ${receipt.customerAddress}`, width).forEach((line) => lines.push(line));
  if (receipt.fulfillmentType) lines.push(`Hình thức: ${receipt.fulfillmentType}`);
  if (receipt.paymentMethod) lines.push(`Thanh toán: ${receipt.paymentMethod}`);
}

function pushItemsText(lines, receipt, width, showMoney) {
  if (!receipt.items.length) {
    lines.push("Chưa có chi tiết món.");
    return;
  }

  receipt.items.forEach((item, index) => {
    if (index > 0) lines.push(buildLine("-", width));
    const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
    const itemLabel = `${item.quantity} x ${item.name}`;
    splitText(itemLabel, width).forEach((line, lineIndex) => {
      if (showMoney && lineIndex === 0) {
        lines.push(alignMoneyLine(line, lineTotal ? toMoney(lineTotal) : "", width));
      } else {
        lines.push(line);
      }
    });
    item.options.forEach((option) => lines.push(`  + ${option}`));
    if (item.note) splitText(`  Ghi chú: ${item.note}`, width).forEach((line) => lines.push(line));
  });
}

function pushBranchFooter(lines, receipt, width) {
  if (!receipt.branchName && !receipt.branchAddress && !receipt.branchPhone) return;
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Thông tin chi nhánh");
  if (receipt.branchName) splitText(receipt.branchName, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchAddress) splitText(receipt.branchAddress, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchPhone) lines.push(`@@CENTER:${receipt.branchPhone}`);
}

function pushLoyaltyFooter(lines, width) {
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Quét QR tích điểm ngay");
  lines.push("@@QR");
  lines.push("@@CENTER:Đơn từ Grab, ShopeeFood, Xanh Ngon");
  lines.push("@@CENTER:đều được tích điểm tại Gánh Hàng Rong");
  lines.push("@@CENTER:Quét để xem đơn và dùng điểm");
  lines.push(`@@CENTER:Hotline: ${SUPPORT_HOTLINE}`);
  lines.push("@@CENTER:Cảm ơn quý khách!");
}

function buildReceiptText(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
  const width = config.receiptWidthMm === 58 ? 32 : 48;
  const showMoney = !isPartnerAppReceipt(receipt);
  const includeLoyaltyFooter = options.includeLoyaltyFooter !== false;
  const lines = [
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:MÃ ĐƠN",
    `@@BIG:${receipt.orderCode || "CHƯA CÓ MÃ"}`,
    buildLine("-", width)
  ];

  pushOrderMeta(lines, receipt, width);
  lines.push(buildLine("-", width));
  pushItemsText(lines, receipt, width, showMoney);

  if (showMoney) {
    lines.push(buildLine("-", width));
    if (receipt.subtotal > 0) lines.push(alignMoneyLine("Tạm tính", toMoney(receipt.subtotal), width));
    if (receipt.promoCode) lines.push(alignMoneyLine("Mã giảm giá", receipt.promoCode, width));
    if (receipt.discount > 0) lines.push(alignMoneyLine("Giảm giá", `-${toMoney(receipt.discount)}`, width));
    if (receipt.shippingFee > 0) lines.push(alignMoneyLine("Phí ship", toMoney(receipt.shippingFee), width));
    lines.push(alignMoneyLine("TỔNG CẦN THU", toMoney(getReceiptTotal(receipt)), width));
  }

  if (receipt.note) {
    lines.push(buildLine("-", width));
    splitText(`Ghi chú đơn: ${receipt.note}`, width).forEach((line) => lines.push(line));
  }

  pushBranchFooter(lines, receipt, width);
  if (includeLoyaltyFooter) pushLoyaltyFooter(lines, width);

  return lines.join("\n");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function qrImageUrl(value = LOYALTY_QR_URL) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=8&data=${encodeURIComponent(value)}`;
}

function buildReceiptHtml(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
  const showMoney = !isPartnerAppReceipt(receipt);
  const total = getReceiptTotal(receipt);

  const itemRows = receipt.items.length
    ? receipt.items.map((item) => {
      const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
      const optionRows = item.options.map((option) => `<div class="sub">+ ${escapeHtml(option)}</div>`).join("");
      const noteRow = item.note ? `<div class="sub">Ghi chú: ${escapeHtml(item.note)}</div>` : "";

      return `
        <div class="item">
          <div>
            <strong>${item.quantity} x ${escapeHtml(item.name)}</strong>
            ${optionRows}
            ${noteRow}
          </div>
          ${showMoney ? `<strong>${lineTotal ? toMoney(lineTotal) : ""}</strong>` : ""}
        </div>
      `;
    }).join("")
    : `<div class="empty">Chưa có chi tiết món.</div>`;

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>In bill ${escapeHtml(receipt.orderCode)}</title>
    <style>
      @page { size: ${config.receiptWidthMm}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #111111;
        font-family: system-ui, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.35;
      }
      .receipt {
        width: ${config.receiptWidthMm}mm;
        padding: 10px 8px 14px;
      }
      h1 {
        margin: 0 0 2px;
        text-align: center;
        font-size: 16px;
        line-height: 1.15;
      }
      .order-label {
        margin-top: 4px;
        text-align: center;
        font-size: 12px;
        font-weight: 800;
      }
      .order-code {
        text-align: center;
        font-size: 46px;
        line-height: 1.02;
        font-weight: 1000;
        letter-spacing: 0;
        overflow-wrap: anywhere;
      }
      .center { text-align: center; }
      .muted { color: #333333; }
      .line {
        border-top: 1px dashed #111111;
        margin: 8px -2px;
      }
      .row, .item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
      }
      .item {
        padding: 7px 0;
        border-bottom: 1px dashed #111111;
      }
      .item:last-child { border-bottom: 0; }
      .sub {
        margin-top: 2px;
        color: #333333;
        font-size: 11px;
      }
      .total {
        margin-top: 5px;
        font-size: 15px;
        font-weight: 900;
      }
      .gift-box {
        margin: 9px 0 8px;
        border: 2px solid #111111;
        padding: 7px 5px;
        text-align: center;
      }
      .gift-title {
        font-size: 14px;
        font-weight: 1000;
        line-height: 1.1;
      }
      .gift-text {
        margin-top: 3px;
        font-size: 19px;
        font-weight: 1000;
        line-height: 1.15;
      }
      .empty {
        padding: 8px 0;
        color: #333333;
      }
      .qr {
        display: block;
        width: 36mm;
        height: 36mm;
        margin: 8px auto 6px;
      }
      .thanks {
        margin-top: 6px;
        text-align: center;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <h1>${escapeHtml(config.storeName)}</h1>
      <div class="order-label">MÃ ĐƠN</div>
      <div class="order-code">${escapeHtml(receipt.orderCode || "CHƯA CÓ MÃ")}</div>
      <div class="line"></div>
      ${receipt.branchName ? `<div><strong>Chi nhánh:</strong> ${escapeHtml(receipt.branchName)}</div>` : ""}
      <div><strong>Nguồn:</strong> ${escapeHtml(receipt.platform)}</div>
      <div><strong>Giờ:</strong> ${escapeHtml(formatDateTime(receipt.createdAt))}</div>
      <div><strong>Khách:</strong> ${escapeHtml(receipt.customerName)}${receipt.customerPhone ? ` - ${escapeHtml(receipt.customerPhone)}` : ""}</div>
      ${receipt.customerAddress ? `<div><strong>Địa chỉ:</strong> ${escapeHtml(receipt.customerAddress)}</div>` : ""}
      ${receipt.fulfillmentType ? `<div><strong>Hình thức:</strong> ${escapeHtml(receipt.fulfillmentType)}</div>` : ""}
      ${receipt.paymentMethod ? `<div><strong>Thanh toán:</strong> ${escapeHtml(receipt.paymentMethod)}</div>` : ""}
      <div class="line"></div>
      ${itemRows}
      ${showMoney ? `
        <div class="line"></div>
        ${receipt.subtotal > 0 ? `<div class="row"><span>Tạm tính</span><strong>${toMoney(receipt.subtotal)}</strong></div>` : ""}
        ${receipt.promoCode ? `<div class="row"><span>Mã giảm giá</span><strong>${escapeHtml(receipt.promoCode)}</strong></div>` : ""}
        ${receipt.discount > 0 ? `<div class="row"><span>Giảm giá</span><strong>-${toMoney(receipt.discount)}</strong></div>` : ""}
        ${receipt.shippingFee > 0 ? `<div class="row"><span>Phí ship</span><strong>${toMoney(receipt.shippingFee)}</strong></div>` : ""}
        <div class="row total"><span>TỔNG CẦN THU</span><strong>${toMoney(total)}</strong></div>
      ` : ""}
      ${receipt.note ? `<div class="line"></div><div><strong>Ghi chú đơn:</strong> ${escapeHtml(receipt.note)}</div>` : ""}
      ${(receipt.branchName || receipt.branchAddress || receipt.branchPhone) ? `
        <div class="line"></div>
        <div class="center"><strong>Thông tin chi nhánh</strong></div>
        ${receipt.branchName ? `<div class="center">${escapeHtml(receipt.branchName)}</div>` : ""}
        ${receipt.branchAddress ? `<div class="center">${escapeHtml(receipt.branchAddress)}</div>` : ""}
        ${receipt.branchPhone ? `<div class="center">${escapeHtml(receipt.branchPhone)}</div>` : ""}
      ` : ""}
      <div class="line"></div>
      <div class="center"><strong>Quét QR để tích điểm</strong></div>
      <img class="qr" src="${qrImageUrl(config.loyaltyUrl)}" alt="QR tích điểm" />
      <div class="center"><strong>Hotline: ${SUPPORT_HOTLINE}</strong></div>
      <div class="thanks">Cảm ơn quý khách!</div>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}

function buildBridgeUrl(path = "", bridgeUrl = "") {
  const baseUrl = toText(bridgeUrl).replace(/\/+$/, "");
  const cleanPath = toText(path).replace(/^\/+/, "");
  return `${baseUrl}/${cleanPath}`;
}

function getAndroidPrinterBridge() {
  if (typeof window === "undefined") return null;
  const bridge = window.GhrPrinter;
  return bridge && typeof bridge.printCustomerBill === "function" ? bridge : null;
}

export function hasAndroidPrinterBridge() {
  return Boolean(getAndroidPrinterBridge());
}

function parseBridgeResult(value, fallbackMessage = "") {
  if (!value) {
    return {
      ok: true,
      message: fallbackMessage || "Đã gửi lệnh in bill."
    };
  }

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return {
      ok: Boolean(parsed?.ok),
      message: parsed?.message || fallbackMessage || (parsed?.ok ? "Đã gửi lệnh in bill." : "In bill thất bại.")
    };
  } catch {
    return {
      ok: true,
      message: String(value)
    };
  }
}

function buildPrintPayload(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  return {
    printerName: config.printerName,
    receiptWidthMm: config.receiptWidthMm,
    type: "customer_bill",
    text: buildReceiptText(order, options),
    html: buildReceiptHtml(order, options),
    loyaltyUrl: config.loyaltyUrl,
    order: normalizeReceiptOrder(order, options)
  };
}

function buildPrintJobPayload(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  return {
    printerName: config.printerName,
    receiptWidthMm: config.receiptWidthMm,
    type: "customer_bill",
    text: buildReceiptText(order, {
      ...options,
      includeLoyaltyFooter: false
    }),
    order: normalizeReceiptOrder(order, options)
  };
}

async function printViaAndroidBridge(order = {}, options = {}) {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) {
    return {
      ok: false,
      message: "Không tìm thấy app POS để in USB."
    };
  }

  try {
    return parseBridgeResult(bridge.printCustomerBill(JSON.stringify(buildPrintPayload(order, options))), "Đã gửi bill tới máy in USB.");
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "App POS không in được bill USB."
    };
  }
}

export async function printPosQrReceipt({
  branch = null,
  amount = 0,
  qrUrl = "",
  transferContent = "",
  orderCode = "",
  customerName = ""
} = {}, options = {}) {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) {
    return {
      ok: false,
      message: "Không tìm thấy app POS để in QR qua USB."
    };
  }

  const safeQrUrl = toText(qrUrl);
  if (!safeQrUrl) {
    return {
      ok: false,
      message: "Chưa tạo được mã QR để in."
    };
  }

  const config = getPrinterConfig(options);
  const branchName = toText(branch?.name || branch?.branchName || options.branchName);
  const safeOrderCode = toText(orderCode || transferContent || `QR-${Date.now()}`);
  const payload = {
    printerName: config.printerName,
    receiptWidthMm: config.receiptWidthMm,
    type: "pos_payment_qr",
    text: buildPosQrReceiptText({
      branchName,
      amount,
      transferContent,
      orderCode: safeOrderCode,
      customerName
    }),
    loyaltyUrl: safeQrUrl,
    order: {
      id: "",
      orderCode: safeOrderCode,
      sourceType: "pos_payment_qr",
      branchName,
      customerName: toText(customerName || "QR thanh toán"),
      createdAt: new Date().toISOString(),
      items: [],
      totalAmount: Math.max(0, Math.round(toNumber(amount)))
    }
  };

  try {
    return parseBridgeResult(bridge.printCustomerBill(JSON.stringify(payload)), "Đã in QR thanh toán.");
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "App POS không in được QR qua USB."
    };
  }
}

async function testAndroidBridge(options = {}) {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) {
    return {
      ok: false,
      mode: "androidBridge",
      message: "Không tìm thấy app POS để kiểm tra máy in USB."
    };
  }

  try {
    if (typeof bridge.printTestBill === "function") {
      return parseBridgeResult(bridge.printTestBill(JSON.stringify({
        receiptWidthMm: getPrinterConfig(options).receiptWidthMm
      })), "Đã gửi bill test tới máy in USB.");
    }

    return {
      ok: true,
      mode: "androidBridge",
      message: "App POS đã sẵn sàng nhận lệnh in USB."
    };
  } catch (error) {
    return {
      ok: false,
      mode: "androidBridge",
      message: error?.message || "Không kiểm tra được app POS."
    };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_BRIDGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function printViaBridge(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  if (!config.bridgeUrl) {
    return {
      ok: false,
      message: "Chưa cấu hình VITE_PRINT_BRIDGE_URL để kết nối Xprinter."
    };
  }

  try {
    const response = await fetchWithTimeout(
      buildBridgeUrl("/print", config.bridgeUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(buildPrintPayload(order, options))
      },
      config.timeoutMs
    );

    if (!response.ok) {
      return {
        ok: false,
        message: `Máy in chưa nhận lệnh. Mã lỗi: ${response.status}.`
      };
    }

    return {
      ok: true,
      message: "Đã gửi bill tới Xprinter."
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.name === "AbortError"
        ? "Kết nối máy in quá lâu, vui lòng kiểm tra app in hoặc mạng nội bộ."
        : "Không kết nối được máy in Xprinter."
    };
  }
}

function printViaBrowser(order = {}, options = {}) {
  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) {
    return {
      ok: false,
      message: "Trình duyệt đang chặn popup in bill."
    };
  }

  printWindow.document.open();
  printWindow.document.write(buildReceiptHtml(order, options));
  printWindow.document.close();

  return {
    ok: true,
    message: "Đã mở hộp thoại in bill."
  };
}

export async function testPrinterConnection(options = {}) {
  const config = getPrinterConfig(options);
  const androidBridge = getAndroidPrinterBridge();

  if (androidBridge) {
    return testAndroidBridge(options);
  }

  if (config.mode === PRINTER_MODE.webPrint) {
    return {
      ok: true,
      mode: config.mode,
      message: "Web print sẵn sàng. iPad sẽ in qua AirPrint hoặc hộp thoại in của trình duyệt."
    };
  }

  if (!config.bridgeUrl) {
    return {
      ok: false,
      mode: config.mode,
      message: "Thiếu VITE_PRINT_BRIDGE_URL để kiểm tra Xprinter."
    };
  }

  try {
    const response = await fetchWithTimeout(buildBridgeUrl("/health", config.bridgeUrl), {
      method: "GET"
    }, config.timeoutMs);

    return {
      ok: response.ok,
      mode: config.mode,
      message: response.ok ? "Đã kết nối app in Xprinter." : `App in trả lỗi ${response.status}.`
    };
  } catch {
    return {
      ok: false,
      mode: config.mode,
      message: "Không gọi được app in Xprinter trong mạng nội bộ."
    };
  }
}

export async function printCustomerBill(order = {}, options = {}) {
  const androidBridge = getAndroidPrinterBridge();
  if (androidBridge) {
    return printViaAndroidBridge(order, options);
  }

  const config = getPrinterConfig(options);

  if (config.mode === PRINTER_MODE.bridge) {
    return printViaBridge(order, options);
  }

  return printViaBrowser(order, options);
}

export async function printXprinterTestBill(options = {}) {
  const testOrder = {
    orderCode: "TEST-XPRINTER",
    platform: "Bếp",
    branchName: "Gánh Hàng Rong - Đường 30/4",
    customerName: "Khách thử máy",
    createdAt: new Date().toISOString(),
    items: [
      {
        name: "Bill test tiếng Việt",
        quantity: 1,
        total: 0,
        note: "Nếu dòng này rõ dấu là máy in ổn."
      }
    ],
    totalAmount: 0
  };

  return printCustomerBill(testOrder, options);
}

export { PRINTER_MODE, buildReceiptHtml, buildReceiptText, buildPrintJobPayload, buildPrintPayload, getPrinterConfig };
