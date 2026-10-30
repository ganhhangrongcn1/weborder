// Pure receipt rendering shared by browser and server. No auth/storage/printing side effects.
import { applyReceiptTemplate, normalizeReceiptTemplate } from "../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js";
import buildTemplatePrintHtml from "./receiptTemplateHtml.js";
const PRINTER_MODE = {
  webPrint: "webPrint",
  bridge: "bridge"
};

const DEFAULT_RECEIPT_WIDTH_MM = 80;
const DEFAULT_STORE_NAME = "Gánh Hàng Rong";
const DEFAULT_BRIDGE_TIMEOUT_MS = 6000;
const LOYALTY_QR_URL = "https://ganhhangrong.vn/orders";
const SUPPORT_HOTLINE = "0933799061";

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
    loyaltyUrl: toText(overrides.loyaltyUrl || env.VITE_RECEIPT_LOYALTY_URL || LOYALTY_QR_URL),
    loyaltyQrImage: toText(overrides.loyaltyQrImage)
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
    customerName: toText(order.customerName || order.customer_name || "Khách"),
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
      order.discount ??
        order.discountAmount ??
        order.discount_amount ??
        order.promoDiscount ??
        order.promo_discount ??
        metadata.discount ??
        metadata.discountAmount ??
        metadata.promoDiscount
    ),
    expectedEarnPoints: Math.max(0, Math.floor(toNumber(
      order.expectedEarnPoints ??
        order.expected_earn_points ??
        metadata.expectedEarnPoints ??
        metadata.expected_earn_points
    ))),
    totalAmount: toNumber(order.totalAmount ?? order.total_amount ?? metadata.totalAmount),
    items
  };
}

function buildReceiptRow(label = "", value = "", strong = false) {
  return `${strong ? "@@BOLDROW:" : "@@ROW:"}${toText(label)}\t${toText(value)}`;
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
  if (["cash", "cod"].includes(method)) return "TIỀN MẶT";
  return toText(receipt.paymentMethod).toUpperCase() || "THANH TOÁN";
}

function pushOrderMeta(lines, receipt, width) {
  if (receipt.branchName) lines.push(`Chi nhánh: ${receipt.branchName}`);
  if (receipt.cashierName) lines.push(`Thu ngân: ${receipt.cashierName}`);
  if (receipt.pagerNumber) lines.push(`Thẻ rung: ${receipt.pagerNumber}`);
  lines.push(`Nguồn: ${receipt.platform || "Website"}`);
  lines.push(`Giờ: ${formatDateTime(receipt.createdAt)}`);
  lines.push("@@SPACE");
  if (receipt.customerName || receipt.customerPhone) {
    lines.push(`Khách: ${receipt.customerName || "Khách"}${receipt.customerPhone ? ` - ${receipt.customerPhone}` : ""}`);
  }
  if (receipt.customerAddress) splitText(`Địa chỉ: ${receipt.customerAddress}`, width).forEach((line) => lines.push(line));
  lines.push("@@SPACE");
  if (receipt.fulfillmentType) lines.push(`Hình thức: ${receipt.fulfillmentType}`);
  if (receipt.paymentMethod) {
    lines.push(`Thanh toán: ${getReceiptPaymentLabel(receipt)}${isReceiptPaid(receipt) ? " - ĐÃ THANH TOÁN" : " - CHƯA THANH TOÁN"}`);
  }
}

function pushItemsText(lines, receipt, width, showMoney) {
  if (!receipt.items.length) {
    lines.push("Chưa có chi tiết món.");
    return;
  }

  receipt.items.forEach((item) => {
    const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
    const itemLabel = `${item.quantity} × ${item.name}`;
    lines.push(buildReceiptRow(itemLabel, showMoney && lineTotal ? toMoney(lineTotal) : "", true));
    item.options.forEach((option) => lines.push(`  + ${option}`));
    if (item.note) splitText(`  Ghi chú: ${item.note}`, width).forEach((line) => lines.push(line));
  });
}

function pushBranchFooter(lines, receipt, width) {
  if (!receipt.branchName && !receipt.branchAddress && !receipt.branchPhone) return;
  lines.push("@@RULE");
  lines.push("@@CENTER:Thông tin chi nhánh");
  if (receipt.branchName) splitText(receipt.branchName, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchAddress) splitText(receipt.branchAddress, width).forEach((line) => lines.push(`@@CENTER:${line}`));
  if (receipt.branchPhone) lines.push(`@@CENTER:${receipt.branchPhone}`);
}

function pushLoyaltyFooter(lines) {
  lines.push("@@RULE");
  lines.push("@@BOLDCENTER:ĐỪNG BỎ LỠ ĐIỂM CỦA ĐƠN NÀY");
  lines.push("@@QR");
  lines.push("@@CENTER:Quét QR để tích 10 - 15% giá trị đơn");
  lines.push("@@CENTER:ganhhangrong.vn");
  lines.push(`@@CENTER:Hotline: ${SUPPORT_HOTLINE}`);
  lines.push("@@CENTER:Cảm ơn quý khách!");
}

function pushPartnerLoyaltyPrompt(lines, expectedEarnPoints = 0) {
  const safeExpectedEarnPoints = Math.max(0, Math.floor(toNumber(expectedEarnPoints)));
  lines.push("@@BOLDCENTER:ĐỪNG BỎ LỠ ĐIỂM CỦA ĐƠN NÀY");
  lines.push("@@QR");
  lines.push(safeExpectedEarnPoints > 0
    ? `@@BOLDCENTER:Quét để nhận ${safeExpectedEarnPoints.toLocaleString("vi-VN")} của đơn này`
    : "@@BOLDCENTER:Quét để nhận tích lũy của đơn này");
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
    "@@CENTER:GÁNH HÀNG RONG",
    `@@CENTER:${isPreparationTicket ? "PHIẾU LÀM MÓN" : "HÓA ĐƠN BÁN HÀNG"}`,
    `@@BIG:${receipt.orderCode || "CHƯA CÓ MÃ"}`,
    "@@RULE"
  ];

  const usePartnerLoyaltyPrompt = options.partnerLoyaltyPrompt === true && isPartnerAppReceipt(receipt);
  if (usePartnerLoyaltyPrompt) {
    pushPartnerLoyaltyPrompt(lines, receipt.expectedEarnPoints);
  } else {
    pushOrderMeta(lines, receipt, width);
  }
  if (isPreparationTicket) {
    lines.push("@@CENTER:*** CHƯA THANH TOÁN TẠI QUẦY ***");
  }
  lines.push("@@RULE");
  pushItemsText(lines, receipt, width, showMoney && !isPreparationTicket);

  if (showMoney && !isPreparationTicket) {
    const receiptTotal = getReceiptTotal(receipt);
    lines.push("@@RULE");
    if (receipt.subtotal > 0) lines.push(buildReceiptRow("Tạm tính", toMoney(receipt.subtotal)));
    if (receipt.promoCode) lines.push(buildReceiptRow("Mã giảm giá", receipt.promoCode));
    if (receipt.discount > 0) lines.push(buildReceiptRow("Giảm giá", `-${toMoney(receipt.discount)}`));
    if (receipt.shippingFee > 0) lines.push(buildReceiptRow("Phí ship", toMoney(receipt.shippingFee)));
    if (receiptPaid) {
      lines.push(buildReceiptRow("TỔNG ĐƠN", toMoney(receiptTotal)));
      lines.push(buildReceiptRow(`ĐÃ THANH TOÁN ${getReceiptPaymentLabel(receipt)}`, toMoney(receipt.paymentAmount || receiptTotal), true));
      lines.push(buildReceiptRow("CÒN PHẢI THU", "0", true));
      lines.push("@@CENTER:*** KHÔNG THU THÊM TIỀN ***");
    } else {
      lines.push(buildReceiptRow("TỔNG CẦN THU", toMoney(receiptTotal), true));
      lines.push("@@CENTER:*** CHƯA THANH TOÁN ***");
    }
  }

  if (receipt.note) {
    lines.push("@@RULE");
    splitText(`Ghi chú đơn: ${receipt.note}`, width).forEach((line) => lines.push(line));
  }

  if (!isPartnerAppReceipt(receipt)) pushBranchFooter(lines, receipt, width);
  if (includeLoyaltyFooter && !isPreparationTicket) pushLoyaltyFooter(lines);
  if (usePartnerLoyaltyPrompt) {
    lines.push("@@RULE");
    lines.push("@@CENTER:Cảm ơn quý khách!");
  }

  if (!isPreparationTicket && receipt.stampSummary?.enabled) {
    const stampLines = [];
    stampLines.push("@@RULE", "@@CENTER:TÍCH TEM NHẬN QUÀ", `@@STAMPS:${receipt.stampSummary.available}`);
    stampLines.push(`Tem khả dụng hiện tại: ${receipt.stampSummary.available}/10`);
    if (receipt.stampSummary.held) stampLines.push(`${receipt.stampSummary.held} tem đang giữ cho đơn đổi quà`);
    stampLines.push("Mỗi ngày tối đa 1 tem / số điện thoại.");
    const qrIndex = lines.lastIndexOf("@@QR");
    lines.splice(qrIndex < 0 ? lines.length : qrIndex + 2, 0, ...stampLines);
  }

  return applyReceiptTemplate(lines.join("\n"), options.receiptTemplate || normalizeReceiptTemplate(), {
    preparation: isPreparationTicket, includeLoyalty: includeLoyaltyFooter, expectedEarnPoints: receipt.expectedEarnPoints,
    hasCustomerPhone: Boolean(toText(order.customerPhone || order.customer_phone))
  });
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
  // A receipt token is a bearer capability: never send it to a QR image vendor.
  if (String(value).includes("/nhan-diem/")) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=8&data=${encodeURIComponent(value)}`;
}

function buildReceiptHtml(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  return buildTemplatePrintHtml(buildReceiptText(order, options), {
    qrImage: config.loyaltyQrImage || qrImageUrl(config.loyaltyUrl), width: config.receiptWidthMm
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


export { PRINTER_MODE, DEFAULT_RECEIPT_WIDTH_MM, DEFAULT_STORE_NAME, DEFAULT_BRIDGE_TIMEOUT_MS, LOYALTY_QR_URL, SUPPORT_HOTLINE, APP_SOURCE_KEYS, toText, toNumber, toMoney, toReceiptWidth, getArray, getObject, getImportMetaEnv, getPrinterConfig, formatDateTime, buildLine, splitText, alignMoneyLine, buildPosQrReceiptText, normalizeSource, isPartnerAppReceipt, normalizeReceiptItem, normalizeReceiptOrder, buildReceiptRow, getReceiptTotal, isReceiptPaid, getReceiptPaymentLabel, pushOrderMeta, pushItemsText, pushBranchFooter, pushLoyaltyFooter, pushPartnerLoyaltyPrompt, buildReceiptText, escapeHtml, qrImageUrl, buildReceiptHtml, buildPrintJobPayload };
