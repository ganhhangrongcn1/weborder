import { readStampSummary } from "./stampProgramService.js";
import { prepareReceiptLoyaltyUrl } from "./receiptLoyaltyService.js";
import { getReceiptTemplate, loadReceiptTemplate } from "./receiptTemplateService.js";
import {
  PRINTER_MODE,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  toText,
  toNumber,
  getObject,
  getPrinterConfig,
  splitText,
  buildPosQrReceiptText,
  isPartnerAppReceipt,
  normalizeReceiptItem,
  normalizeReceiptOrder,
  isReceiptPaid,
  buildReceiptText as buildReceiptTextCore,
  escapeHtml,
  buildReceiptHtml as buildReceiptHtmlCore,
  buildPrintJobPayload as buildPrintJobPayloadCore
} from "./receiptRenderCore.js";

function buildReceiptText(order = {}, options = {}) {
  return buildReceiptTextCore(order, { ...options, receiptTemplate: options.receiptTemplate || getReceiptTemplate() });
}

function buildReceiptHtml(order = {}, options = {}) {
  return buildReceiptHtmlCore(order, { ...options, receiptTemplate: options.receiptTemplate || getReceiptTemplate() });
}

function buildPrintJobPayload(order = {}, options = {}) {
  return buildPrintJobPayloadCore(order, { ...options, receiptTemplate: options.receiptTemplate || getReceiptTemplate() });
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

function normalizeItemLabelItem(item = {}) {
  const normalized = normalizeReceiptItem({
    ...item,
    options: item.selectedOptions ?? item.options ?? item.toppings ?? item.optionGroups
  });
  return { name: normalized.name, quantity: 1, note: normalized.note, options: normalized.options };
}

function buildItemLabelText(order = {}, item = {}, label = {}, options = {}) {
  const config = getPrinterConfig(options);
  const width = config.receiptWidthMm === 58 ? 32 : 48;
  const orderCode = toText(order.displayOrderCode || order.orderCode || order.order_code || order.id);
  const itemName = toText(item.name || item.productName || item.product_name || "Món");
  const note = toText(item.note);
  const orderNote = toText(order.note || order.orderNote || order.order_note
    || order.metadata?.note || order.metadata?.orderNote || order.raw?.metadata?.note);
  const optionsText = normalizeItemLabelItem(item).options;
  const unitNumber = Math.max(1, Math.floor(toNumber(label.unitNumber, 1)));
  const totalUnits = Math.max(unitNumber, Math.floor(toNumber(label.totalUnits, 1)));
  const itemNumber = Math.max(1, Math.floor(toNumber(label.itemNumber, 1)));
  const totalItems = Math.max(itemNumber, Math.floor(toNumber(label.totalItems, 1)));
  const lines = [
    `@@BOLDCENTER:${orderCode || "CHƯA CÓ MÃ"} · ${itemNumber}/${totalItems}`,
    `@@BOLDCENTER:${itemName}`
  ];

  if (totalUnits > 1) lines.push(`@@CENTER:Phần ${unitNumber}/${totalUnits}`);
  optionsText.forEach((value) => {
    splitText(`+ ${value}`, width).forEach((line) => lines.push(line));
  });
  if (note) {
    splitText(`Ghi chú: ${note}`, width).forEach((line) => lines.push(`@@BOLDCENTER:${line}`));
  }
  if (orderNote && orderNote !== note) {
    splitText(`Đơn: ${orderNote}`, width).forEach((line) => lines.push(`@@BOLDCENTER:${line}`));
  }
  return lines.join("\n");
}

function buildItemLabelHtml(order = {}, item = {}, label = {}, options = {}) {
  const config = getPrinterConfig(options);
  const text = buildItemLabelText(order, item, label, options)
    .replace(/^@@(?:BOLDCENTER|CENTER|BIG):/gm, "")
    .replace(/^@@RULE$/gm, "--------------------------------")
    .replace(/^@@SPACE$/gm, "");
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Tem món ${escapeHtml(order.displayOrderCode || order.orderCode || order.id || "")}</title>
    <style>
      @page { size: ${config.receiptWidthMm}mm auto; margin: 0; }
      body { margin: 0; color: #111; background: #fff; font-family: system-ui, Arial, sans-serif; }
      pre { width: ${config.receiptWidthMm}mm; margin: 0; padding: 8mm 4mm 10mm; box-sizing: border-box; white-space: pre-wrap; text-align: center; font: 800 15px/1.35 system-ui, Arial, sans-serif; }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(text)}</pre>
    <script>window.addEventListener("load", () => { window.focus(); window.print(); });</script>
  </body>
</html>`;
}

function buildItemLabelPrintPayload(order = {}, item = {}, label = {}, options = {}) {
  const config = getPrinterConfig(options);
  return {
    printerName: config.printerName,
    receiptWidthMm: config.receiptWidthMm,
    type: "item_label",
    text: buildItemLabelText(order, item, label, options),
    html: buildItemLabelHtml(order, item, label, options),
    label: {
      batchId: toText(label.batchId),
      labelKey: toText(label.labelKey),
      originalOrderId: toText(order.id),
      orderCode: toText(order.displayOrderCode || order.orderCode || order.order_code || order.id),
      branchUuid: toText(label.branchUuid),
      itemIndex: Math.max(0, Math.floor(toNumber(label.itemIndex, 0))),
      itemNumber: Math.max(1, Math.floor(toNumber(label.itemNumber, 1))),
      totalItems: Math.max(1, Math.floor(toNumber(label.totalItems, 1))),
      unitIndex: Math.max(0, Math.floor(toNumber(label.unitIndex, 0))),
      unitNumber: Math.max(1, Math.floor(toNumber(label.unitNumber, 1))),
      totalUnits: Math.max(1, Math.floor(toNumber(label.totalUnits, 1)))
    },
    order: {
      // Labels are independent print documents. Source/payment/customer metadata
      // makes deployed POS consumers incorrectly rebuild them as full receipts.
      orderCode: toText(order.displayOrderCode || order.orderCode || order.order_code || order.id),
      items: [normalizeItemLabelItem(item)]
    }
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
  const controller = new globalThis.AbortController();
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

function printViaBrowser(order = {}, options = {}, preparedWindow) {
  const printWindow = preparedWindow === undefined ? window.open("", "_blank", "width=420,height=720") : preparedWindow;
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
  const config = getPrinterConfig(options);
  // Preserve the click gesture: opening after the optional request can be blocked by mobile browsers.
  const printWindow = !androidBridge && config.mode !== PRINTER_MODE.bridge
    ? window.open("", "_blank", "width=420,height=720") : undefined;
  if (printWindow === null) return { ok: false, message: "Trình duyệt đang chặn popup in bill." };
  try { await loadReceiptTemplate(); } catch { /* Preserve printing with the last known template. */ }
  if (order.id && (isPartnerAppReceipt(normalizeReceiptOrder(order)) || isReceiptPaid(normalizeReceiptOrder(order)))) {
    try {
      const url = await prepareReceiptLoyaltyUrl(order);
      if (url) {
        const QRCode = (await import("qrcode")).default;
        options = { ...options, loyaltyUrl: url, loyaltyQrImage: await QRCode.toDataURL(url, { width: 170, margin: 2 }) };
      }
    } catch {
      // Keep printing available. The legacy QR remains usable during rollout.
    }
  }
  const phone = order.customerPhone || order.customer_phone;
  if (phone && !order.stampSummary) {
    try { order = { ...order, stampSummary: await readStampSummary(phone, { kitchen: true, force: true }) }; }
    catch { /* Printing remains available when the optional stamp lookup fails. */ }
  }
  if (androidBridge) {
    return printViaAndroidBridge(order, options);
  }

  if (config.mode === PRINTER_MODE.bridge) {
    return printViaBridge(order, options);
  }

  return printViaBrowser(order, options, printWindow);
}

export async function printItemLabelPayload(payload = {}, options = {}) {
  const safePayload = getObject(payload);
  const androidBridge = getAndroidPrinterBridge();
  if (androidBridge) {
    try {
      return parseBridgeResult(
        androidBridge.printCustomerBill(JSON.stringify(safePayload)),
        "Đã gửi tem món tới máy in USB."
      );
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "App POS không in được tem món."
      };
    }
  }

  const config = getPrinterConfig(options);
  if (config.mode === PRINTER_MODE.bridge) {
    if (!config.bridgeUrl) return { ok: false, message: "Chưa cấu hình trạm in." };
    try {
      const response = await fetchWithTimeout(
        buildBridgeUrl("/print", config.bridgeUrl),
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(safePayload)
        },
        config.timeoutMs
      );
      return {
        ok: response.ok,
        message: response.ok ? "Đã gửi tem món tới máy in." : `Trạm in trả lỗi ${response.status}.`
      };
    } catch {
      return { ok: false, message: "Không kết nối được trạm in để in tem món." };
    }
  }

  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) return { ok: false, message: "Trình duyệt đang chặn cửa sổ in tem." };
  printWindow.document.open();
  printWindow.document.write(toText(safePayload.html));
  printWindow.document.close();
  return { ok: true, message: "Đã mở hộp thoại in tem món." };
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

export {
  PRINTER_MODE,
  buildItemLabelPrintPayload,
  buildReceiptHtml,
  buildReceiptText,
  buildPrintJobPayload,
  buildPrintPayload,
  getPrinterConfig
};
