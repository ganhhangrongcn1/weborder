import { NativeModules, Platform } from "react-native";

import { getCashBreakdownEntries } from "./posCashBreakdownService";
import { formatMoney } from "../../utils/format";

const printerModule = NativeModules.PosPrinter || null;
const NO_FOOTER_SOURCE_TYPES = new Set([
  "pos_payment_qr",
  "pickup_order_payment_qr",
  "delivery_order_payment_qr",
  "pos_shift_close"
]);
const DEFAULT_RECEIPT_FOOTER_TEXT = [
  "@@RULE",
  "@@CENTER:Quét QR tích điểm ngay",
  "@@QR",
  "@@CENTER:Đơn từ Grab, ShopeeFood, Xanh Ngon",
  "@@CENTER:đều được tích 10 - 15% điểm tại Gánh Hàng Rong",
  "@@CENTER:Quét để xem đơn và dùng điểm",
  "@@CENTER:Hotline: 0933 799 061",
  "@@CENTER:Cảm ơn quý khách!"
].join("\n");
const DEFAULT_RECEIPT_FOOTER_QR_URL = "https://ganhhangrong.vn/loyalty?source=receipt";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLine(char = "-", width = 42) {
  return char.repeat(width);
}

function alignReceiptLine(label = "", value = "", width = 42) {
  const left = toText(label);
  const right = toText(value);
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

function buildReceiptRow(label = "", value = "", strong = false) {
  return `${strong ? "@@BOLDROW:" : "@@ROW:"}${toText(label)}\t${toText(value)}`;
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

function buildCartLines(cart = []) {
  const lines = [];
  (Array.isArray(cart) ? cart : []).forEach((item) => {
    lines.push(buildReceiptRow(
      `${Math.max(1, toNumber(item.quantity, 1))} × ${toText(item.name)}`,
      formatMoney(item.lineTotal || 0)
    ));
    (Array.isArray(item.selectedOptions) ? item.selectedOptions : []).forEach((option) => {
      lines.push(`  + ${toText(option.name)}`);
    });
    if (toText(item.note)) {
      lines.push(`  Ghi chú: ${toText(item.note)}`);
    }
  });
  return lines;
}

export function isLocalPrinterAvailable() {
  return Platform.OS === "android" && Boolean(printerModule);
}

export async function getLocalPrinterConfig() {
  if (!isLocalPrinterAvailable()) {
    return {
      mode: "usb",
      lanHost: "",
      lanPort: 9100,
      usbConnected: false,
      usbPermission: false,
      usbLabel: ""
    };
  }
  return printerModule.getPrinterConfig();
}

export async function setLocalPrinterMode(mode = "usb") {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  return printerModule.setPrinterMode(mode);
}

export async function saveLocalLanPrinter(host = "", port = 9100) {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  return printerModule.saveLanPrinter(host, Number(port || 9100));
}

export async function listLocalUsbPrinters() {
  if (!isLocalPrinterAvailable()) return [];
  return printerModule.listUsbPrinters();
}

export async function selectLocalUsbPrinter(vendorId, productId) {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  return printerModule.selectUsbPrinter(Number(vendorId), Number(productId));
}

export async function requestLocalUsbPrinterPermission(vendorId, productId) {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  return printerModule.requestUsbPermission(Number(vendorId), Number(productId));
}

export async function printLocalTestBill() {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  return printerModule.printTestBill();
}

export async function openLocalCashDrawer() {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  if (typeof printerModule.openCashDrawer !== "function") {
    throw new Error("Bản POS app này chưa hỗ trợ mở két tiền.");
  }
  return printerModule.openCashDrawer();
}

export async function playLocalNewOrderAlert() {
  if (!isLocalPrinterAvailable()) return false;
  if (typeof printerModule.playNewOrderAlert !== "function") return false;
  return printerModule.playNewOrderAlert();
}

export async function playLocalQrPaymentAlert() {
  if (!isLocalPrinterAvailable()) return false;
  if (typeof printerModule.playQrPaymentAlert !== "function") return false;
  return printerModule.playQrPaymentAlert();
}

export async function startLocalPrintStationService({ branchUuid = "", branchName = "", deviceId = "" } = {}) {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  if (typeof printerModule.startPrintStationService !== "function") {
    throw new Error("Bản POS app này chưa hỗ trợ trạm in chạy nền.");
  }
  return printerModule.startPrintStationService(branchUuid, branchName, deviceId);
}

export async function stopLocalPrintStationService() {
  if (!isLocalPrinterAvailable()) return null;
  if (typeof printerModule.stopPrintStationService !== "function") return null;
  return printerModule.stopPrintStationService();
}

export async function printLocalReceipt({ text = "", qrUrl = "", sourceType = "", footerText = "", footerQrUrl = "" } = {}) {
  if (!isLocalPrinterAvailable()) throw new Error("Native printer bridge chưa sẵn sàng.");
  const safeSourceType = toText(sourceType).toLowerCase();
  const shouldUseDefaultFooter = !NO_FOOTER_SOURCE_TYPES.has(safeSourceType);
  return printerModule.printReceipt({
    text,
    qrUrl,
    sourceType: safeSourceType || sourceType,
    footerText: toText(footerText) || (shouldUseDefaultFooter ? DEFAULT_RECEIPT_FOOTER_TEXT : ""),
    footerQrUrl: toText(footerQrUrl) || (shouldUseDefaultFooter ? DEFAULT_RECEIPT_FOOTER_QR_URL : "")
  });
}

export function buildPosCustomerBillText({
  order = {},
  cart = [],
  totals = {},
  customerName = "",
  customerPhone = "",
  pagerNumber = "",
  branchName = "",
  cashierName = "",
  orderNote = "",
  paymentConfirmed = null
} = {}) {
  const lines = [
    "@@CENTER:GÁNH HÀNG RONG",
    "@@CENTER:HÓA ĐƠN BÁN HÀNG",
    `@@BIG:${toText(order.displayOrderCode || order.orderCode || order.id || "POS")}`,
    "@@RULE",
    `Chi nhánh: ${toText(branchName) || "POS mobile"}`,
    `Thu ngân: ${toText(cashierName) || "Thu ngân"}`,
    `Giờ in: ${formatDateTime(new Date().toISOString())}`
  ];

  if (toText(customerName)) lines.push(`Khách: ${toText(customerName)}`);
  if (toText(customerPhone)) lines.push(`SĐT: ${toText(customerPhone)}`);
  if (toText(pagerNumber)) lines.push(`Thẻ rung: ${toText(pagerNumber)}`);

  lines.push("@@RULE");
  lines.push(...buildCartLines(cart));
  lines.push("@@RULE");
  lines.push(buildReceiptRow("Tạm tính", formatMoney(totals.subtotal || 0)));

  if (toNumber(totals.voucherDiscount, 0) > 0) {
    lines.push(buildReceiptRow("Giảm voucher", `-${formatMoney(totals.voucherDiscount || 0)}`));
  }
  if (toNumber(totals.pointsDiscount, 0) > 0) {
    lines.push(buildReceiptRow("Giảm điểm", `-${formatMoney(totals.pointsDiscount || 0)}`));
  }

  const cashRoundingDiscount = paymentConfirmed?.method === "cash"
    ? toNumber(paymentConfirmed.cashRoundingDiscount, 0)
    : 0;
  if (cashRoundingDiscount > 0) {
    lines.push(buildReceiptRow("Làm tròn tiền mặt", `-${formatMoney(cashRoundingDiscount)}`));
  }

  const amountDue = paymentConfirmed?.method === "cash" && toNumber(paymentConfirmed.amount, 0) > 0
    ? toNumber(paymentConfirmed.amount, 0)
    : toNumber(totals.total, 0);
  lines.push(buildReceiptRow("TỔNG CẦN THU", formatMoney(amountDue), true));
  lines.push("@@RULE");
  lines.push(buildReceiptRow("Thanh toán", paymentConfirmed?.method === "bank_qr" ? "QR" : "Tiền mặt"));

  if (paymentConfirmed?.method === "cash") {
    lines.push(buildReceiptRow("Khách đưa", formatMoney(paymentConfirmed.received || 0)));
    lines.push(buildReceiptRow("Tiền thối", formatMoney(paymentConfirmed.change || 0)));
  }
  if (paymentConfirmed?.reference) {
    lines.push(`Mã TT: ${toText(paymentConfirmed.reference)}`);
  }
  if (toText(orderNote)) {
    lines.push("@@RULE");
    lines.push(`Ghi chú: ${toText(orderNote)}`);
  }
  return lines.join("\n");
}

export function buildPosQrReceiptText({
  branchName = "",
  amount = 0,
  transferContent = "",
  orderCode = "",
  customerName = ""
} = {}) {
  const width = 42;
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:QUET MA THANH TOAN",
    buildLine("-", width)
  ];

  if (branchName) lines.push(`Chi nhanh: ${toText(branchName)}`);
  if (orderCode) lines.push(`Ma bill: ${toText(orderCode)}`);
  if (customerName) lines.push(`Khach: ${toText(customerName)}`);

  lines.push(alignReceiptLine("So tien", formatMoney(amount), width));
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Dua ma nay cho khach quet");
  lines.push("@@QR");
  lines.push("@@CENTER:Ma QR co hieu luc trong 10 phut.");
  lines.push(buildLine("-", width));
  lines.push(`Noi dung: ${toText(transferContent)}`);
  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Cam on quy khach!");
  return lines.join("\n");
}

export function buildPosShiftCloseReceiptText({
  shift = {},
  summary = {},
  closingCashCounted = 0,
  closingCashBreakdown = null,
  closingNote = ""
} = {}) {
  const width = 42;
  const expectedCash = toNumber(summary.expectedCash ?? shift.expectedCashSnapshot, 0);
  const cashRoundingTotal = toNumber(summary.cashRoundingTotal, 0);
  const countedCash = toNumber(closingCashCounted || shift.closingCashCounted, 0);
  const difference = countedCash - expectedCash;
  const shortShiftId = toText(shift.id || shift.shiftId).slice(0, 8).toUpperCase();
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:PHIEU KET CA",
    `@@BIG:${shortShiftId || "POS"}`,
    buildLine("-", width),
    `Chi nhanh: ${toText(shift.branchName) || "POS mobile"}`,
    `Thu ngan: ${toText(shift.cashierName) || "Thu ngan"}`,
    `Mo ca: ${formatDateTime(shift.openedAt)}`,
    `Ket ca: ${formatDateTime(shift.closedAt || new Date().toISOString())}`,
    buildLine("-", width),
    alignReceiptLine("Tien dau ca", formatMoney(shift.openingCash || 0), width),
    alignReceiptLine("Tien mat da thu", formatMoney(summary.cashTotal || 0), width),
    alignReceiptLine("QR da thu", formatMoney(summary.qrTotal || 0), width),
    ...(cashRoundingTotal > 0
      ? [alignReceiptLine("Giam lam tron", `-${formatMoney(cashRoundingTotal)}`, width)]
      : []),
    alignReceiptLine("Du kien trong ket", formatMoney(expectedCash), width),
    alignReceiptLine("Thuc dem", formatMoney(countedCash), width),
    alignReceiptLine(
      difference === 0 ? "Chenh lech" : difference > 0 ? "Thua tien" : "Thieu tien",
      `${difference < 0 ? "-" : ""}${formatMoney(Math.abs(difference))}`,
      width
    ),
    buildLine("-", width),
    alignReceiptLine("Tong don", `${Math.max(0, Math.round(toNumber(summary.orderCount, 0)))} don`, width),
    alignReceiptLine("Don tien mat", `${Math.max(0, Math.round(toNumber(summary.cashOrderCount, 0)))} don`, width),
    alignReceiptLine("Don QR", `${Math.max(0, Math.round(toNumber(summary.qrOrderCount, 0)))} don`, width),
    alignReceiptLine("Don huy", `${Math.max(0, Math.round(toNumber(summary.cancelledOrderCount, 0)))} don`, width)
  ];

  const cashBreakdownEntries = getCashBreakdownEntries(closingCashBreakdown);
  if (cashBreakdownEntries.length) {
    lines.push(buildLine("-", width));
    lines.push("Chi tiet tien cuoi ca");
    cashBreakdownEntries.forEach((entry) => {
      lines.push(alignReceiptLine(`${entry.label} x ${entry.count}`, formatMoney(entry.total), width));
    });
  }

  if (toText(closingNote)) {
    lines.push(buildLine("-", width));
    lines.push(`Ghi chu: ${toText(closingNote)}`);
  }

  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Nhan vien ky");
  lines.push("");
  lines.push("");
  lines.push("@@CENTER:____________________");
  return lines.join("\n");
}
