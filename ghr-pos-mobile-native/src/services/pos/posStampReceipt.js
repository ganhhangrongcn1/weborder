// Display only: never award stamps while printing or reprinting.
export function buildStampReceiptSection(summary) {
  if (!summary?.enabled) return "";
  return ["@@RULE", "@@CENTER:TÍCH TEM NHẬN QUÀ", `@@STAMPS:${summary.available}`,
    `Bạn có ${summary.available}/10 tem khả dụng`,
    "Mỗi ngày tối đa 1 tem / số điện thoại", "@@STAMPEND"].join("\n");
}

export function placeStampsAfterLoyaltyQr(text, footerText) {
  const lines = String(text || "").split("\n");
  const start = lines.findIndex((line) => line.includes("TÍCH TEM NHẬN QUÀ"));
  if (start < 0) return { text, footerText };
  let end = lines.indexOf("@@STAMPEND", start);
  if (end < 0) {
    const dailyRule = lines.findIndex((line, index) => index > start && line.includes("Mỗi ngày tối đa 1 tem"));
    end = dailyRule >= 0 ? dailyRule + 1 : lines.findIndex((line, index) => index > start && /^@@(?:RULE|ROW:|BOLDROW:|QR)/.test(line));
    if (end < 0) end = lines.length;
  } else end += 1;
  const from = start > 0 && lines[start - 1] === "@@RULE" ? start - 1 : start;
  const section = lines.splice(from, end - from).filter((line) => line !== "@@STAMPEND").join("\n");
  // Insert directly after the QR caption, preserving totals, notes and branch details.
  const target = footerText ? String(footerText).split("\n") : lines;
  const qrIndex = target.lastIndexOf("@@QR");
  target.splice(qrIndex < 0 ? target.length : qrIndex + 2, 0, section);
  return footerText
    ? { text: lines.join("\n"), footerText: target.join("\n") }
    : { text: target.join("\n"), footerText };
}

export default placeStampsAfterLoyaltyQr;
