import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";
import { getGrabMarketingReport } from "../../../services/grabMarketingReportService.js";
import { addDaysToVietnamDateInput, toVietnamDateInputValue } from "../../../utils/adminDateRange.js";
import { formatMoney } from "../../../utils/format.js";
import { AdminInput, AdminSelect } from "../ui/index.js";
import "../../../styles/admin/grab-marketing.css";

const CHANNELS = {
  keyword_ads: { label: "Quảng cáo từ khóa", shortLabel: "Từ khóa", tone: "amber", icon: "search" },
  promo: { label: "Khuyến mãi tự tạo", shortLabel: "KM tự tạo", tone: "green", icon: "tag" },
  spotlight: { label: "Xế tối / Siêu Deal", shortLabel: "Xế tối / Siêu Deal", tone: "blue", icon: "sale" }
};

const money = (value) => formatMoney(Math.round(Number(value || 0)));
const number = (value) => Number(value || 0).toLocaleString("vi-VN");
const ratio = (value) => value == null ? "--" : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} lần`;
const percent = (value) => value == null ? "--" : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
const dateLabel = (value = "") => {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

function recommendationForChannel(channel, rank) {
  if (rank === 0) return "Ưu tiên";
  if (channel === "keyword_ads") return "Cần tối ưu";
  return "Duy trì";
}

function buildBranchDecisions(campaigns = []) {
  const groups = new Map();
  campaigns.forEach((row) => {
    const list = groups.get(row.sourceId) || [];
    list.push(row);
    groups.set(row.sourceId, list);
  });

  return [...groups.values()].map((rows) => {
    const active = rows.filter((row) => row.spendAmount > 0 && row.ordersCount > 0 && row.costPerOrder != null);
    const ranked = [...active].sort((a, b) => a.costPerOrder - b.costPerOrder);
    const best = ranked[0] || null;
    const keyword = rows.find((row) => row.channel === "keyword_ads") || null;
    let action = "Chưa đủ dữ liệu để đề xuất.";
    let level = "neutral";

    if (best && (!keyword || keyword.spendAmount <= 0)) {
      action = `Chưa cần bật quảng cáo từ khóa. Tiếp tục ${CHANNELS[best.channel]?.shortLabel || best.campaignName}.`;
      level = "good";
    } else if (best && keyword && best.channel !== "keyword_ads" && keyword.costPerOrder > best.costPerOrder * 1.15) {
      const gap = Math.round((keyword.costPerOrder / best.costPerOrder - 1) * 100);
      action = `Giảm thử 30% ngân sách từ khóa; đang đắt hơn kênh tốt nhất ${gap}%.`;
      level = "warning";
    } else if (best) {
      action = `Duy trì ${CHANNELS[best.channel]?.shortLabel || best.campaignName} và theo dõi lợi nhuận món.`;
      level = "good";
    }

    return {
      sourceId: rows[0]?.sourceId,
      displayName: rows[0]?.displayName || "Gian hàng Grab",
      best,
      action,
      level
    };
  }).sort((a, b) => {
    if (a.level === b.level) return a.displayName.localeCompare(b.displayName, "vi");
    return a.level === "warning" ? -1 : 1;
  });
}

export default function AdminGrabMarketingPage({ branches = [], selectedBranchFilter = "all", setSelectedBranchFilter }) {
  const today = toVietnamDateInputValue();
  const yesterday = addDaysToVietnamDateInput(today, -1);
  const [reportDate, setReportDate] = useState(yesterday);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const branchOptions = useMemo(() => buildBranchFilterOptions(branches), [branches]);
  const branchOption = branchOptions.find((item) => item.value === selectedBranchFilter) || null;

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    setError("");
    getGrabMarketingReport({ fromDate: reportDate, toDate: reportDate, branchOption }).then((value) => {
      if (!disposed) {
        setReport(value);
        setStatus("ready");
      }
    }).catch(() => {
      if (!disposed) {
        setReport(null);
        setStatus("error");
        setError("Chưa tải được dữ liệu Marketing Grab. Anh thử lại sau khi worker đồng bộ.");
      }
    });
    return () => { disposed = true; };
  }, [reportDate, selectedBranchFilter]);

  const activeChannels = (report?.channels || [])
    .filter((item) => item.spendAmount > 0 && item.ordersCount > 0 && item.costPerOrder != null)
    .sort((a, b) => a.costPerOrder - b.costPerOrder);
  const best = activeChannels[0] || null;
  const keyword = activeChannels.find((item) => item.channel === "keyword_ads") || null;
  const spotlight = activeChannels.find((item) => item.channel === "spotlight") || null;
  const branchDecisions = buildBranchDecisions(report?.campaigns || []);
  const maxCostPerOrder = Math.max(...activeChannels.map((item) => item.costPerOrder || 0), 1);
  const lastSync = report?.lastSyncedAt ? new Date(report.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có";
  const keywordGap = keyword && best && keyword.channel !== best.channel
    ? Math.round((keyword.costPerOrder / best.costPerOrder - 1) * 100)
    : 0;
  const spotlightSavings = keyword && spotlight && keyword.costPerOrder > 0
    ? Math.round((1 - spotlight.costPerOrder / keyword.costPerOrder) * 100)
    : 0;

  return <div className="grab-marketing-page">
    <header className="grab-marketing-header">
      <div><span><Icon name="sale" size={24} /></span><div><h1>Hiệu quả Marketing Grab</h1><p>Trang này trả lời: nên ưu tiên kênh nào và quán nào cần điều chỉnh.</p></div></div>
      <small>Đồng bộ: {lastSync}</small>
    </header>

    <section className="grab-marketing-filters">
      <label><span>Chi nhánh</span><AdminSelect value={selectedBranchFilter} onChange={(event) => setSelectedBranchFilter?.(event.target.value)} options={[{ value: "all", label: "Tất cả quán" }, ...branchOptions]} /></label>
      <label><span>Lũy kế từ đầu tháng đến ngày</span><AdminInput type="date" value={reportDate} max={yesterday} onChange={(event) => setReportDate(event.target.value)} /></label>
      <div className="grab-marketing-filter-note"><Icon name="clock" size={18} /><span>Số liệu ngày gần nhất có thể còn được Grab cập nhật thêm trong 48 giờ.</span></div>
    </section>

    {status === "loading" ? <div className="grab-marketing-message">Đang đọc dữ liệu và tạo đề xuất...</div> : null}
    {status === "error" ? <div className="grab-marketing-message is-error">{error}</div> : null}

    {status === "ready" ? <>
      <section className="grab-marketing-decision-hero">
        <div className="grab-marketing-decision-icon"><Icon name="sparkle" size={26} /></div>
        <div className="grab-marketing-decision-copy">
          <small>KẾT LUẬN NHANH · 01/{reportDate.slice(5, 7)} ĐẾN {dateLabel(reportDate)}</small>
          <h2>{best ? `Ưu tiên ${CHANNELS[best.channel]?.label || best.channel}` : "Chưa đủ dữ liệu để kết luận"}</h2>
          <p>{best
            ? `Đây là kênh có chi phí trên mỗi đơn được Grab quy gán thấp nhất: ${money(best.costPerOrder)}. ${keywordGap > 0 ? `Quảng cáo từ khóa đang đắt hơn ${keywordGap}%.` : "Tiếp tục theo dõi thêm trước khi đổi ngân sách."}`
            : "Chưa có đủ chi phí và đơn để so sánh các kênh."}</p>
        </div>
        {best ? <div className="grab-marketing-decision-number"><span>Chi phí/đơn tốt nhất</span><strong>{money(best.costPerOrder)}</strong></div> : null}
      </section>

      <section className="grab-marketing-summary-grid">
        <article><span>Ngân sách đã dùng</span><strong>{money(report.spendAmount)}</strong><small>Tổng chi phí Marketing Grab ghi nhận</small></article>
        <article><span>Doanh số được quy gán</span><strong>{money(report.salesAmount)}</strong><small>Không phải doanh thu tài chính thực nhận</small></article>
        <article><span>Kênh tạo nhiều đơn nhất</span><strong>{activeChannels.length ? CHANNELS[[...activeChannels].sort((a, b) => b.ordersCount - a.ordersCount)[0]?.channel]?.shortLabel : "--"}</strong><small>{activeChannels.length ? `${number([...activeChannels].sort((a, b) => b.ordersCount - a.ordersCount)[0]?.ordersCount)} đơn được quy gán` : "Chưa có dữ liệu"}</small></article>
        <article><span>Chất lượng quảng cáo từ khóa</span><strong>{keyword ? percent(keyword.ctr) : "Chưa chạy"}</strong><small>{keyword ? `${number(keyword.clicksCount)} lượt nhấp / ${number(keyword.impressionsCount)} hiển thị` : "Không có lượt hiển thị"}</small></article>
      </section>

      <section className="grab-marketing-section-heading">
        <div><small>BƯỚC 1</small><h2>Xếp hạng ba hình thức</h2><p>Nhìn vào chi phí/đơn trước. Con số càng thấp càng tốt.</p></div>
        <div className="grab-marketing-legend"><span><i className="is-good" /> Nên ưu tiên</span><span><i className="is-watch" /> Cần theo dõi</span></div>
      </section>

      <section className="grab-marketing-channel-grid">
        {activeChannels.map((row, index) => {
          const config = CHANNELS[row.channel] || { label: row.channel, shortLabel: row.channel, tone: "neutral", icon: "sale" };
          const aov = row.ordersCount > 0 ? row.salesAmount / row.ordersCount : null;
          const score = Math.max(22, Math.round((1 - row.costPerOrder / (maxCostPerOrder * 1.35)) * 100));
          return <article className={`grab-marketing-channel-card is-${config.tone} ${index === 0 ? "is-best" : ""}`} key={row.channel}>
            <header><span className="grab-marketing-channel-icon"><Icon name={config.icon} size={22} /></span><div><small>HẠNG {index + 1}</small><h3>{config.label}</h3></div><b>{recommendationForChannel(row.channel, index)}</b></header>
            <div className="grab-marketing-channel-primary"><span>Chi phí cho 1 đơn</span><strong>{money(row.costPerOrder)}</strong></div>
            <div className="grab-marketing-score"><span style={{ width: `${score}%` }} /></div>
            <dl>
              <div><dt>Chi phí</dt><dd>{money(row.spendAmount)}</dd></div>
              <div><dt>Đơn quy gán</dt><dd>{number(row.ordersCount)}</dd></div>
              <div><dt>Doanh số/chi phí</dt><dd>{ratio(row.roas)}</dd></div>
              <div><dt>Giá trị đơn TB</dt><dd>{aov == null ? "--" : money(aov)}</dd></div>
            </dl>
            {row.channel === "keyword_ads" ? <p className="grab-marketing-channel-foot">Hiển thị {number(row.impressionsCount)} · CTR {percent(row.ctr)}</p> : <p className="grab-marketing-channel-foot">Grab không trả lượt hiển thị cho hình thức này.</p>}
          </article>;
        })}
      </section>

      <section className="grab-marketing-action-card">
        <div className="grab-marketing-section-heading"><div><small>BƯỚC 2</small><h2>Việc nên làm theo từng quán</h2><p>Đề xuất dựa trên chênh lệch chi phí/đơn trong cùng kỳ.</p></div></div>
        <div className="grab-marketing-action-list">
          {branchDecisions.map((item) => <article key={item.sourceId}>
            <span className={`grab-marketing-action-status is-${item.level}`}><Icon name={item.level === "warning" ? "warning" : "check"} size={18} /></span>
            <div><h3>{item.displayName}</h3><p>{item.action}</p></div>
            <div className="grab-marketing-action-best"><span>Kênh tốt nhất</span><strong>{item.best ? CHANNELS[item.best.channel]?.shortLabel : "--"}</strong><small>{item.best ? `${money(item.best.costPerOrder)}/đơn` : "Chưa đủ dữ liệu"}</small></div>
          </article>)}
        </div>
      </section>

      <section className="grab-marketing-insight-grid">
        <article><Icon name="warning" size={22} /><div><strong>Không cộng các cột đơn</strong><p>Một đơn có thể được Grab quy cho nhiều kênh. Đây không phải số đơn tài chính thực tế.</p></div></article>
        <article><Icon name="wallet" size={22} /><div><strong>Hiệu quả chưa đồng nghĩa có lãi</strong><p>Cần đối chiếu thêm giá vốn, hoa hồng và tiền giảm giá trong thẻ Tài chính Grab.</p></div></article>
        <article><Icon name="eye" size={22} /><div><strong>{spotlightSavings > 0 ? `Xế tối/Siêu Deal rẻ hơn từ khóa ${spotlightSavings}%` : "Theo dõi từng kênh riêng"}</strong><p>Thử giảm ngân sách từ khóa theo từng bước nhỏ, không tắt toàn bộ ngay một lúc.</p></div></article>
      </section>

      <details className="grab-marketing-raw-details">
        <summary>Xem bảng số liệu chi tiết</summary>
        <p>Sử dụng phần này khi cần kiểm tra lại con số, không phải để ra quyết định nhanh.</p>
        <div className="grab-marketing-table-wrap"><table><thead><tr><th>Gian hàng</th><th>Hình thức</th><th>Chi phí</th><th>Đơn quy gán</th><th>Chi phí/đơn</th><th>Doanh số quy gán</th><th>Doanh số/chi phí</th></tr></thead><tbody>{(report.campaigns || []).map((row, index) => <tr key={`${row.sourceId}-${row.channel}-${index}`}><td>{row.displayName}</td><td><strong>{CHANNELS[row.channel]?.label || row.campaignName}</strong></td><td>{money(row.spendAmount)}</td><td>{number(row.ordersCount)}</td><td>{row.costPerOrder == null ? "--" : money(row.costPerOrder)}</td><td>{money(row.salesAmount)}</td><td>{ratio(row.roas)}</td></tr>)}</tbody></table></div>
      </details>
    </> : null}
  </div>;
}
