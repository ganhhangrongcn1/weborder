const PRINTER_MODE = {
  webPrint: "webPrint",
  bridge: "bridge"
};

const DEFAULT_RECEIPT_WIDTH_MM = 80;
const DEFAULT_STORE_NAME = "Gánh Hàng Rong";
const DEFAULT_BRIDGE_TIMEOUT_MS = 6000;

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
    timeoutMs: toNumber(overrides.timeoutMs || env.VITE_PRINT_BRIDGE_TIMEOUT_MS, DEFAULT_BRIDGE_TIMEOUT_MS)
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

function buildLine(char = "-", width = 32) {
  return char.repeat(width);
}

function splitText(value = "", limit = 32) {
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

function alignMoneyLine(label = "", value = "", width = 32) {
  const left = toText(label);
  const right = toText(value);
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

function normalizeReceiptItem(item = {}) {
  const options = getArray(item.options || item.toppings)
    .map((option) => {
      if (typeof option === "string") return option;
      return toText(option?.label || option?.name || option?.value);
    })
    .filter(Boolean);

  return {
    name: toText(item.name || item.productName || item.product_name || "Món"),
    quantity: Math.max(1, Math.floor(toNumber(item.quantity, 1))),
    price: toNumber(item.price || item.unitPrice || item.unit_price),
    total: toNumber(item.total || item.totalPrice || item.total_price),
    note: toText(item.note),
    options
  };
}

function normalizeReceiptOrder(order = {}, config = {}) {
  const metadata = getObject(order.metadata);
  const raw = getObject(order.raw);
  const rawMetadata = getObject(raw.metadata);
  const items = getArray(order.items).map(normalizeReceiptItem);

  return {
    orderCode: toText(order.displayOrderCode || order.orderCode || order.order_code || order.id),
    platform: toText(order.platform || order.source || order.sourceType || "Website"),
    branchName: toText(order.branchName || order.branch_name || config.branchName),
    customerName: toText(order.customerName || order.customer_name || "Khách"),
    customerPhone: toText(order.customerPhone || order.customer_phone),
    customerAddress: toText(order.customerAddress || order.address || metadata.address || rawMetadata.address),
    fulfillmentType: toText(order.fulfillmentType || order.fulfillment_type || metadata.fulfillmentType),
    paymentMethod: toText(order.paymentMethod || order.payment_method || metadata.paymentMethod),
    note: toText(order.note || metadata.note || rawMetadata.note),
    createdAt: toText(order.createdAt || order.created_at || order.orderTime || order.order_time),
    subtotal: toNumber(order.subtotal || metadata.subtotal),
    shippingFee: toNumber(order.shippingFee || order.shipping_fee || metadata.shippingFee),
    discount: toNumber(order.discount || metadata.discount),
    totalAmount: toNumber(order.totalAmount || order.total_amount || metadata.totalAmount),
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

function buildReceiptText(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
  const width = config.receiptWidthMm === 58 ? 32 : 42;
  const lines = [
    config.storeName.toUpperCase(),
    receipt.branchName,
    buildLine("-", width),
    `Đơn: ${receipt.orderCode || "Chưa có mã"}`,
    `Nguồn: ${receipt.platform}`,
    `Giờ: ${formatDateTime(receipt.createdAt)}`,
    `Khách: ${receipt.customerName}${receipt.customerPhone ? ` - ${receipt.customerPhone}` : ""}`
  ].filter(Boolean);

  if (receipt.customerAddress) lines.push(`Địa chỉ: ${receipt.customerAddress}`);
  if (receipt.fulfillmentType) lines.push(`Hình thức: ${receipt.fulfillmentType}`);
  if (receipt.paymentMethod) lines.push(`Thanh toán: ${receipt.paymentMethod}`);

  lines.push(buildLine("-", width));

  if (receipt.items.length) {
    receipt.items.forEach((item) => {
      const lineTotal = item.total > 0 ? item.total : item.price * item.quantity;
      splitText(`${item.quantity} x ${item.name}`, width).forEach((line, index) => {
        lines.push(index === 0 ? alignMoneyLine(line, lineTotal ? toMoney(lineTotal) : "", width) : line);
      });
      item.options.forEach((option) => lines.push(`  + ${option}`));
      if (item.note) lines.push(`  Ghi chú: ${item.note}`);
    });
  } else {
    lines.push("Chưa có chi tiết món.");
  }

  lines.push(buildLine("-", width));
  if (receipt.subtotal > 0) lines.push(alignMoneyLine("Tạm tính", toMoney(receipt.subtotal), width));
  if (receipt.shippingFee > 0) lines.push(alignMoneyLine("Phí giao", toMoney(receipt.shippingFee), width));
  if (receipt.discount > 0) lines.push(alignMoneyLine("Giảm giá", `-${toMoney(receipt.discount)}`, width));
  lines.push(alignMoneyLine("TỔNG", toMoney(getReceiptTotal(receipt)), width));

  if (receipt.note) {
    lines.push(buildLine("-", width));
    splitText(`Ghi chú đơn: ${receipt.note}`, width).forEach((line) => lines.push(line));
  }

  lines.push(buildLine("-", width));
  lines.push("Cảm ơn quý khách!");

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

function buildReceiptHtml(order = {}, options = {}) {
  const config = getPrinterConfig(options);
  const receipt = normalizeReceiptOrder(order, options);
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
          <strong>${lineTotal ? toMoney(lineTotal) : ""}</strong>
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
        padding: 10px 8px;
      }
      h1 {
        margin: 0 0 4px;
        text-align: center;
        font-size: 17px;
        line-height: 1.15;
      }
      .center { text-align: center; }
      .muted { color: #333333; }
      .line {
        border-top: 1px dashed #111111;
        margin: 8px 0;
      }
      .row, .item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
      }
      .item { padding: 5px 0; }
      .sub {
        margin-top: 2px;
        color: #333333;
        font-size: 11px;
      }
      .total {
        margin-top: 5px;
        font-size: 15px;
        font-weight: 800;
      }
      .empty {
        padding: 8px 0;
        color: #333333;
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <h1>${escapeHtml(config.storeName)}</h1>
      ${receipt.branchName ? `<div class="center muted">${escapeHtml(receipt.branchName)}</div>` : ""}
      <div class="line"></div>
      <div><strong>Đơn:</strong> ${escapeHtml(receipt.orderCode || "Chưa có mã")}</div>
      <div><strong>Nguồn:</strong> ${escapeHtml(receipt.platform)}</div>
      <div><strong>Giờ:</strong> ${escapeHtml(formatDateTime(receipt.createdAt))}</div>
      <div><strong>Khách:</strong> ${escapeHtml(receipt.customerName)}${receipt.customerPhone ? ` - ${escapeHtml(receipt.customerPhone)}` : ""}</div>
      ${receipt.customerAddress ? `<div><strong>Địa chỉ:</strong> ${escapeHtml(receipt.customerAddress)}</div>` : ""}
      ${receipt.fulfillmentType ? `<div><strong>Hình thức:</strong> ${escapeHtml(receipt.fulfillmentType)}</div>` : ""}
      ${receipt.paymentMethod ? `<div><strong>Thanh toán:</strong> ${escapeHtml(receipt.paymentMethod)}</div>` : ""}
      <div class="line"></div>
      ${itemRows}
      <div class="line"></div>
      ${receipt.subtotal > 0 ? `<div class="row"><span>Tạm tính</span><strong>${toMoney(receipt.subtotal)}</strong></div>` : ""}
      ${receipt.shippingFee > 0 ? `<div class="row"><span>Phí giao</span><strong>${toMoney(receipt.shippingFee)}</strong></div>` : ""}
      ${receipt.discount > 0 ? `<div class="row"><span>Giảm giá</span><strong>-${toMoney(receipt.discount)}</strong></div>` : ""}
      <div class="row total"><span>TỔNG</span><strong>${toMoney(total)}</strong></div>
      ${receipt.note ? `<div class="line"></div><div><strong>Ghi chú đơn:</strong> ${escapeHtml(receipt.note)}</div>` : ""}
      <div class="line"></div>
      <div class="center">Cảm ơn quý khách!</div>
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

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_BRIDGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
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
        body: JSON.stringify({
          printerName: config.printerName,
          receiptWidthMm: config.receiptWidthMm,
          type: "customer_bill",
          text: buildReceiptText(order, options),
          html: buildReceiptHtml(order, options),
          order: normalizeReceiptOrder(order, options)
        })
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

export { PRINTER_MODE, buildReceiptHtml, buildReceiptText, getPrinterConfig };
