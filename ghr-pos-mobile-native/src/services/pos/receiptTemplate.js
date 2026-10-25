// Pure, shared by the web preview/browser printer and Android print station.
export const RECEIPT_TEMPLATE_KEY = "ghr_receipt_template";
export const DEFAULT_RECEIPT_TEMPLATE = {
  version: 1, enabled: false,
  brand: "GÁNH HÀNG RONG", slogan: "Thân quen từng lần ghé",
  customerTitle: "HÓA ĐƠN BÁN HÀNG", kitchenTitle: "PHIẾU LÀM MÓN",
  thanks: "Cảm ơn anh chị. Hẹn gặp lại!", website: "ganhhangrong.vn", hotline: "0933799061",
  kitchenReminder: "KIỂM TRA ĐỦ MÓN - TOPPING - GHI CHÚ",
  showBranch: true, showCashier: true, showCustomer: true, showLoyalty: true, showStamps: true
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
  return result;
}

const STAMP_LINE = /^(?:@@STAMPS:|@@STAMPEND|(?:@@CENTER:)?TÍCH TEM NHẬN QUÀ|Tem khả dụng|Bạn có \d+\/10 tem|\d+ tem đang giữ|Mỗi ngày tối đa|Hôm nay đã nhận tem|Đủ tem:|Còn \d+ tem để nhận quà|Tem: chưa cập nhật)/;
const PROMO_LINE = /^(?:@@(?:BOLD)?CENTER:)?(?:ĐỪNG BỎ LỠ ĐIỂM|ĐIỂM THÀNH VIÊN|Quét QR để tích|Quét để nhận|Quét QR để nhận|Quét QR để xem|Nhận trong 24 giờ|Cảm ơn quý khách!|Hotline:|ganhhangrong\.vn)/;

export function applyReceiptTemplate(text = "", value = {}, context = {}) {
  const config = normalizeReceiptTemplate(value);
  if (!config.enabled || !text) return text;
  const original = String(text).split("\n");
  // These are payment slips/labels/shift reports, not customer or kitchen bills.
  if (!original.some((line) => line === "@@CENTER:PHIẾU LÀM MÓN" || line === "@@CENTER:HÓA ĐƠN BÁN HÀNG"
    || line === `@@CENTER:${config.customerTitle}` || line === `@@CENTER:${config.kitchenTitle}`)) return text;
  const preparation = typeof context.preparation === "boolean" ? context.preparation
    : original.includes("@@CENTER:PHIẾU LÀM MÓN") || original.includes(`@@CENTER:${config.kitchenTitle}`);
  const stamps = original.filter((line) => STAMP_LINE.test(line) && line !== "@@STAMPEND");
  const orderIndex = original.findIndex((line) => line.startsWith("@@BIG:"));
  const customFooter = new Set([config.website, config.thanks, config.slogan, config.kitchenReminder].filter(Boolean));
  const branchIndex = original.indexOf("@@CENTER:Thông tin chi nhánh");
  const branchDetails = [];
  if (branchIndex >= 0) {
    for (let index = branchIndex + 1; index < original.length && original[index] !== "@@RULE"; index += 1) {
      if (original[index].startsWith("@@CENTER:")) branchDetails.push(original[index].slice(9));
    }
  }
  let branchFooter = false;
  const body = original.filter((line, index) => {
    if (index < (orderIndex < 0 ? 2 : orderIndex) && /^@@(?:BOLD)?CENTER:/.test(line)) return false;
    if (line === "@@CENTER:Thông tin chi nhánh") { branchFooter = true; return false; }
    if (branchFooter) { if (line === "@@RULE") branchFooter = false; else return false; }
    if (line === "@@QR" || STAMP_LINE.test(line) || PROMO_LINE.test(line)) return false;
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
  if (config.showBranch && branchDetails.length > 1) {
    const location = body.findIndex((line) => line.startsWith("Chi nhánh:"));
    body.splice(location < 0 ? Math.max(0, body.findIndex((line) => line.startsWith("@@BIG:")) + 1) : location + 1,
      0, ...branchDetails.slice(1).map((detail) => `Chi nhánh: ${detail}`));
  }
  const header = [`@@BOLDCENTER:${config.brand}`];
  if (!preparation && config.slogan) header.push(`@@CENTER:${config.slogan}`);
  header.push(`@@CENTER:${preparation ? config.kitchenTitle : config.customerTitle}`);
  const footer = ["@@RULE"];
  if (preparation) {
    if (config.kitchenReminder) footer.push(`@@CENTER:${config.kitchenReminder}`);
  } else {
    if (config.showLoyalty && context.includeLoyalty !== false) {
      const legacyPoints = original.join("\n").match(/(?:Quét để nhận |Quét QR để xem \/ nhận )([\d.,]+)(?: điểm| của đơn này)/);
      const points = Math.max(0, Math.floor(Number(context.expectedEarnPoints) || Number(legacyPoints?.[1]?.replace(/[.,]/g, "")) || 0));
      footer.push("@@BOLDCENTER:ĐIỂM THÀNH VIÊN", "@@QR", points > 0
        ? `@@CENTER:Quét QR để xem / nhận ${points.toLocaleString("vi-VN")} điểm`
        : "@@CENTER:Quét QR để xem / nhận điểm của đơn");
      footer.push("@@CENTER:Nhận trong 24 giờ kể từ lúc mua");
    }
    if (config.showStamps && stamps.length) footer.push("@@RULE", ...stamps);
    if (config.website) footer.push(`@@CENTER:${config.website}`);
    if (config.hotline) footer.push(`@@CENTER:Hotline: ${config.hotline}`);
    if (config.thanks) footer.push(`@@CENTER:${config.thanks}`);
  }
  return [...header, ...body, ...footer].join("\n").replace(/(?:@@RULE\n){2,}/g, "@@RULE\n");
}

export default applyReceiptTemplate;
