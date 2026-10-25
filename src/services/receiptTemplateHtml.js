import buildStampReceiptSvg from "./stampReceiptService.js";

function escape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function renderReceiptTemplateBody(text, qrImage = "") {
  return String(text).split("\n").map((line) => {
    if (line.startsWith("@@RECEIPTORDER:") || line === "@@STAMPEND") return "";
    if (line === "@@RULE") return '<hr class="receipt-rule" />';
    if (line === "@@SPACE") return '<div class="receipt-space"></div>';
    if (line === "@@QR") return qrImage
      ? `<img class="receipt-qr" src="${escape(qrImage)}" alt="QR của bill" />`
      : '<div class="receipt-qr-placeholder">QR CỦA BILL</div>';
    if (line.startsWith("@@STAMPS:")) return buildStampReceiptSvg(Math.min(10, Math.max(0, Number(line.slice(9)) || 0)));
    for (const prefix of ["@@BOLDROW:", "@@ROW:"]) {
      if (!line.startsWith(prefix)) continue;
      const [left, ...right] = line.slice(prefix.length).split("\t");
      return `<div class="receipt-row ${prefix === "@@BOLDROW:" ? "receipt-bold" : ""}"><span>${escape(left)}</span><span>${escape(right.join(" "))}</span></div>`;
    }
    for (const [prefix, className] of [["@@BOLDCENTER:", "receipt-center receipt-bold"], ["@@CENTER:", "receipt-center"], ["@@BIG:", "receipt-center receipt-big"]]) {
      if (line.startsWith(prefix)) return `<div class="${className}">${escape(line.slice(prefix.length))}</div>`;
    }
    return `<div>${escape(line)}</div>`;
  }).join("");
}
export const RECEIPT_TEMPLATE_CSS = `
  .receipt-paper{background:white;color:#111;padding:18px;font:13px/1.55 Arial,system-ui,sans-serif;overflow-wrap:anywhere}
  .receipt-center{text-align:center}.receipt-bold{font-weight:700}.receipt-big{font-size:24px;font-weight:800}
  .receipt-row{display:flex;justify-content:space-between;gap:12px}.receipt-row>span:last-child{flex-shrink:0}
  .receipt-rule{border:0;border-top:1px dashed #999;margin:10px 0}.receipt-space{height:8px}
  .receipt-qr{display:block;width:145px;height:145px;margin:12px auto}
  .receipt-qr-placeholder{width:120px;height:120px;margin:12px auto;border:2px dashed #555;display:grid;place-items:center;font-weight:700;font-size:11px}
`;
export default function buildTemplatePrintHtml(text, { qrImage = "", width = 80 } = {}) {
  return `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><title>In bill</title><style>
    ${RECEIPT_TEMPLATE_CSS} body{margin:0}.receipt-paper{width:${width === 58 ? 50 : 72}mm;box-sizing:border-box;margin:auto;padding:2mm}
    @page{size:${width === 58 ? 58 : 80}mm auto;margin:2mm}
  </style></head><body><main class="receipt-paper">${renderReceiptTemplateBody(text, qrImage)}</main>
  <script>window.addEventListener("load",()=>{window.focus();window.print()})</script></body></html>`;
}
