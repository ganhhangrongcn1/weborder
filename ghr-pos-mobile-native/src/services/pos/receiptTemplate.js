// Pure, shared by the web preview/browser printer and Android print station.
import compactReceiptLayout from "./compactReceiptLayout.js";
export const RECEIPT_TEMPLATE_KEY = "ghr_receipt_template";
export const DEFAULT_RECEIPT_TEMPLATE = {
  version: 1, enabled: true,
  brand: "GÁNH HÀNG RONG", slogan: "",
  customerTitle: "HÓA ĐƠN BÁN HÀNG", kitchenTitle: "PHIẾU LÀM MÓN",
  thanks: "Cảm ơn anh chị. Hẹn gặp lại!", website: "ganhhangrong.vn", hotline: "0933799061",
  kitchenReminder: "",
  showBranch: true, showCashier: false, showCustomer: true, showLoyalty: true, showStamps: true
};

export function normalizeReceiptTemplate(value = {}) {
  const result = { ...DEFAULT_RECEIPT_TEMPLATE };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "boolean") result[key] = typeof value?.[key] === "boolean" ? value[key] : result[key];
    if (typeof result[key] === "string") {
      // Admin text cannot inject printer directives, control bytes or new lines.
      result[key] = String(value?.[key] ?? result[key]).normalize("NFC")
        .replace(/[\x00-\x1f\x7f]/g, " ").replace(/@@/g, "").trim().slice(0, 100);
    }
  }
  for (const key of ["brand", "customerTitle", "kitchenTitle"]) {
    if (!result[key]) result[key] = DEFAULT_RECEIPT_TEMPLATE[key];
  }
  // The approved shared template is mandatory in POS 0.4.31 and the web release.
  // Old enabled=false snapshots must not resurrect the retired print layout.
  result.enabled = true;
  return result;
}

const STAMP_LINE = /^(?:@@STAMPS:|@@STAMPEND|(?:@@CENTER:)?(?:TÍCH TEM NHẬN QUÀ|TEM THÀNH VIÊN|Cung cấp SĐT để tích tem|Quét mã bên trên để tích tem đổi quà|Còn \d+ tem nữa để nhận quà|Đã đủ tem để nhận quà|\d+\/10 tem)|Tem khả dụng|Bạn có \d+\/10 tem|\d+ tem đang giữ|Mỗi ngày tối đa|Hôm nay đã nhận tem|Đủ tem:|Còn \d+ tem để nhận quà|Tem: chưa cập nhật)/;
const PROMO_LINE = /^(?:@@(?:BOLD)?CENTER:)?(?:ĐỪNG BỎ LỠ ĐIỂM|ĐIỂM THÀNH VIÊN|QUÉT QR VÀO WEBSITE|Xem \/ nhận|Quét QR để tích|Quét để nhận|Quét QR để nhận|Quét QR để xem|Nhận trong 24 giờ|Cảm ơn quý khách!|Hotline:|ganhhangrong\.vn)/;

// Older MoMo jobs have ASCII labels. Canonicalize only known labels, never item text.
function normalizeLegacyReceiptLine(line) {
  return line.replace(/^@@CENTER:HOA DON BAN HANG$/, "@@CENTER:HÓA ĐƠN BÁN HÀNG")
    .replace(/^Chi nhanh:/, "Chi nhánh:").replace(/^Thu ngan:/, "Thu ngân:")
    .replace(/^Nguon:/, "Nguồn:").replace(/^Ghi chu:/, "Ghi chú:").replace(/^Ma TT:/, "Mã TT:")
    .replace(/^Thanh toan: Vi MoMo - DA THANH TOAN$/, "Thanh toán: Ví MoMo - ĐÃ THANH TOÁN")
    .replace(/^(@@(?:BOLD)?ROW:)TONG DON\t/, "$1TỔNG ĐƠN\t")
    .replace(/^(@@(?:BOLD)?ROW:)DA THANH TOAN MOMO\t/, "$1ĐÃ THANH TOÁN VÍ MOMO\t")
    .replace(/^(@@(?:BOLD)?ROW:)CON PHAI THU\t/, "$1CÒN PHẢI THU\t")
    .replace(/^@@CENTER:\*\*\* KHONG THU THEM TIEN \*\*\*$/, "@@CENTER:*** KHÔNG THU THÊM TIỀN ***")
    .replace(/^(@@(?:BOLD)?ROW:.*\t[\d.,]+)d$/, "$1đ");
}

export function applyReceiptTemplate(text = "", value = {}, context = {}) {
  const config = normalizeReceiptTemplate(value);
  if (!config.enabled || !text) return text;
  const original = String(text).split("\n").map(normalizeLegacyReceiptLine);
  // These are payment slips/labels/shift reports, not customer or kitchen bills.
  if (!original.some((line) => line === "@@CENTER:PHIẾU LÀM MÓN" || line === "@@CENTER:HÓA ĐƠN BÁN HÀNG"
    || line === `@@CENTER:${config.customerTitle}` || line === `@@CENTER:${config.kitchenTitle}`)) return text;
  const preparation = typeof context.preparation === "boolean" ? context.preparation
    : original.includes("@@CENTER:PHIẾU LÀM MÓN") || original.includes(`@@CENTER:${config.kitchenTitle}`);
  const stamps = original.filter((line) => STAMP_LINE.test(line) && line !== "@@STAMPEND");
  const orderIndex = original.findIndex((line) => line.startsWith("@@BIG:"));
  const customFooter = new Set([config.website, config.thanks, config.slogan, config.kitchenReminder,
    [config.website, config.hotline].filter(Boolean).join(" · ")].filter(Boolean));
  let branchFooter = false;
  let body = original.filter((line, index) => {
    if (index < (orderIndex < 0 ? 2 : orderIndex) && /^@@(?:BOLD)?CENTER:/.test(line)) return false;
    if (line === "@@CENTER:Thông tin chi nhánh") { branchFooter = true; return false; }
    if (branchFooter) { if (line === "@@RULE") branchFooter = false; else return false; }
    if (line === "@@QR" || STAMP_LINE.test(line) || PROMO_LINE.test(line)) return false;
    if (/^@@BOLDCENTER:\d+$/.test(line) && original[index - 1] === "@@CENTER:Xem / nhận tích lũy của đơn") return false;
    if (customFooter.has(line.replace(/^@@(?:BOLD)?CENTER:/, ""))) return false;
    if (line.includes("KIỂM TRA ĐỦ MÓN - TOPPING - GHI CHÚ")) return false;
    if (!config.showBranch && /^Chi nhánh:/.test(line)) return false;
    if (!config.showCashier && /^Thu ngân:/.test(line)) return false;
    if (!config.showCustomer && /^(Khách:|SĐT:|Địa chỉ:)/.test(line)) return false;
    return true;
  }).map((line) => {
    if (!line.startsWith("Nguồn:")) return line;
    const source = line.slice(6).trim();
    const label = ({ pos: "Tại quầy", pos_mobile: "Tại quầy", website: "Website", web: "Website", grabfood: "GrabFood", grab: "GrabFood", shopeefood: "ShopeeFood" })[source.toLowerCase()] || source;
    return `Nguồn: ${label}`;
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
      const previousNumber = original.find((line, index) => /^@@BOLDCENTER:\d+$/.test(line)
        && original[index - 1] === "@@CENTER:Xem / nhận tích lũy của đơn");
      const points = Math.max(0, Math.floor(Number(context.expectedEarnPoints) || Number(legacyPoints?.[1]?.replace(/[.,]/g, "")) || Number(previousNumber?.slice(13)) || 0));
      footer.push("@@BOLDCENTER:ĐỪNG BỎ LỠ ĐIỂM ĐƠN NÀY",
        points > 0 ? `@@CENTER:Quét để nhận ${points}` : "@@CENTER:Quét để nhận tích lũy của đơn");
      footer.push("@@QR");
      footer.push("@@CENTER:Nhận trong 24 giờ kể từ lúc mua");
    }
    if (config.showStamps) {
      const chart = stamps.find((line) => line.startsWith("@@STAMPS:"));
      const hasPhone = typeof context.hasCustomerPhone === "boolean" ? context.hasCustomerPhone
        : !original.some((line) => ["@@CENTER:Cung cấp SĐT để tích tem", "@@CENTER:Quét mã bên trên để tích tem đổi quà"].includes(line)) && Boolean(context.customerPhone || chart
          || original.some((line) => /^(?:SĐT:|Khách:).*0[35789]\d{8}/.test(line)));
      if (!hasPhone) footer.push("@@RULE", "@@CENTER:TEM THÀNH VIÊN", "@@STAMPS:0", context.includeLoyalty !== false && config.showLoyalty
        ? "@@CENTER:Quét mã bên trên để tích tem đổi quà" : "@@CENTER:Cung cấp SĐT để tích tem");
      else if (chart) {
        const remaining = Math.max(0, 10 - Math.floor(Number(chart.slice(9)) || 0));
        footer.push("@@RULE", "@@CENTER:TEM THÀNH VIÊN", chart, remaining > 0
          ? `@@CENTER:Còn ${remaining} tem nữa để nhận quà` : "@@CENTER:Đã đủ tem để nhận quà");
        footer.push(...stamps.filter((line) => /^\d+ tem đang giữ/.test(line)));
      }
    }
    const contact = [config.website, config.hotline].filter(Boolean).join(" · ");
    if (contact) footer.push(`@@CENTER:${contact}`);
    if (config.thanks) footer.push(`@@CENTER:${config.thanks}`);
  }
  return [...header, ...body, ...footer].join("\n").replace(/(?:@@RULE\n){2,}/g, "@@RULE\n");
}

export default applyReceiptTemplate;
