import { NativeModules, Platform } from "react-native";

import { formatMoney } from "../../utils/format";

const printerModule = NativeModules.PosPrinter || null;

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
    lines.push(`${Math.max(1, toNumber(item.quantity, 1))} x ${toText(item.name)}`);
    (Array.isArray(item.selectedOptions) ? item.selectedOptions : []).forEach((option) => {
      lines.push(`  + ${toText(option.name)}`);
    });
    if (toText(item.note)) {
      lines.push(`  Ghi chu: ${toText(item.note)}`);
    }
    lines.push(alignReceiptLine("  Thanh tien", formatMoney(item.lineTotal || 0), 42));
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
  return printerModule.printReceipt({
    text,
    qrUrl,
    sourceType,
    footerText,
    footerQrUrl
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
  const width = 42;
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:HOA DON BAN HANG",
    `@@BIG:${toText(order.displayOrderCode || order.orderCode || order.id || "POS")}`,
    buildLine("-", width),
    `Chi nhanh: ${toText(branchName) || "POS mobile"}`,
    `Thu ngan: ${toText(cashierName) || "Thu ngan"}`,
    `Gio in: ${formatDateTime(new Date().toISOString())}`
  ];

  if (toText(customerName)) lines.push(`Khach: ${toText(customerName)}`);
  if (toText(customerPhone)) lines.push(`SDT: ${toText(customerPhone)}`);
  if (toText(pagerNumber)) lines.push(`The rung: ${toText(pagerNumber)}`);

  lines.push(buildLine("-", width));
  lines.push(...buildCartLines(cart));
  lines.push(buildLine("-", width));
  lines.push(alignReceiptLine("Tam tinh", formatMoney(totals.subtotal || 0), width));

  if (toNumber(totals.voucherDiscount, 0) > 0) {
    lines.push(alignReceiptLine("Giam voucher", `-${formatMoney(totals.voucherDiscount || 0)}`, width));
  }
  if (toNumber(totals.pointsDiscount, 0) > 0) {
    lines.push(alignReceiptLine("Giam diem", `-${formatMoney(totals.pointsDiscount || 0)}`, width));
  }

  lines.push(alignReceiptLine("Tong can thu", formatMoney(totals.total || 0), width));
  lines.push(buildLine("-", width));
  lines.push(`Thanh toan: ${paymentConfirmed?.method === "bank_qr" ? "QR" : "Tien mat"}`);

  if (paymentConfirmed?.method === "cash") {
    lines.push(alignReceiptLine("Khach dua", formatMoney(paymentConfirmed.received || 0), width));
    lines.push(alignReceiptLine("Tien thoi", formatMoney(paymentConfirmed.change || 0), width));
  }
  if (paymentConfirmed?.reference) {
    lines.push(`Ma TT: ${toText(paymentConfirmed.reference)}`);
  }
  if (toText(orderNote)) {
    lines.push(buildLine("-", width));
    lines.push(`Ghi chu: ${toText(orderNote)}`);
  }

  lines.push(buildLine("-", width));
  lines.push("@@CENTER:Cam on quy khach!");
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
  closingNote = ""
} = {}) {
  const width = 42;
  const expectedCash = toNumber(summary.expectedCash ?? shift.expectedCashSnapshot, 0);
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
