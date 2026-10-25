// Presentation only: keep non-zero amounts, items, options and notes untouched.
export default function compactReceiptLayout(lines, { preparation = false } = {}) {
  let source = "";
  let time = "";
  let payment = "";
  const result = [];
  const hasPaidAmount = lines.some((line) => /^@@(?:BOLD)?ROW:ĐÃ THANH TOÁN/.test(line));
  const hasTotal = lines.some((line) => /^@@(?:BOLD)?ROW:(?:TỔNG ĐƠN|TỔNG TIỀN)\t/.test(line));
  for (const line of lines) {
    if (/^Nguồn:/.test(line)) { source = line.slice(6).trim(); continue; }
    if (/^(?:Giờ:|Giờ in:)/.test(line)) { time = line.replace(/^(?:Giờ:|Giờ in:)\s*/, ""); continue; }
    if (/^@@(?:BOLD)?ROW:CÒN PHẢI THU\t0(?:[.,]0+)?(?:đ| ₫)?$/.test(line)) continue;
    if (line.includes("*** KHÔNG THU THÊM TIỀN ***")) continue;
    if (hasPaidAmount && /^(?:Thanh toán:|@@(?:BOLD)?ROW:Thanh toán\t)/.test(line)) continue;
    if (!preparation && !hasPaidAmount && /^Thanh toán:/.test(line)) {
      const status = line.match(/^Thanh toán:\s*(.*?)\s*-\s*(ĐÃ THANH TOÁN|CHƯA THANH TOÁN)$/i);
      payment = status ? `@@BOLDCENTER:${status[2]} · ${status[1]}` : line;
      continue;
    }
    const paid = line.match(/^@@(?:BOLD)?ROW:ĐÃ THANH TOÁN\s*(.*?)\t(.+)$/);
    if (paid) {
      if (!hasTotal) result.push(`@@BOLDROW:TỔNG TIỀN\t${paid[2]}`);
      result.push(`@@BOLDCENTER:ĐÃ THANH TOÁN${paid[1] ? ` · ${paid[1]}` : ""}`);
      continue;
    }
    if (preparation && /^(?:Chi nhánh:|Thu ngân:|Khách:|SĐT:|Địa chỉ:|Thanh toán:)/.test(line)) continue;
    if (preparation && line.includes("CHƯA THANH TOÁN")) continue;
    if (preparation && /^Thẻ rung:/.test(line)) { result.push(`@@BOLDROW:THẺ RUNG\t${line.slice(9).trim()}`); continue; }
    result.push(line.replace(/^@@(?:BOLD)?ROW:TỔNG ĐƠN\t/, "@@BOLDROW:TỔNG TIỀN\t"));
  }
  const meta = [source, time].filter(Boolean).join(" · ");
  const firstRule = result.indexOf("@@RULE");
  if (meta) result.splice(firstRule < 0 ? 1 : firstRule + 1, 0, meta);
  if (payment) result.push(payment);
  return result;
}
