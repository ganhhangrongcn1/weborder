import { useMemo, useState } from "react";
import { formatMoney } from "../../../utils/format.js";
import { buildCampaignHistoryOverview } from "../../../services/crmCampaignAnalyticsService.js";

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatShortDate(value = "") {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}` : "--";
}

function RedemptionDonut({ analytics }) {
  const granted = Math.max(0, Number(analytics.grantedCount || 0));
  const usedRate = granted ? (Number(analytics.usedCount || 0) / granted) * 100 : 0;
  const expiredRate = granted ? (Number(analytics.expiredCount || 0) / granted) * 100 : 0;
  return (
    <div className="crm-campaign-redemption-chart">
      <svg viewBox="0 0 42 42" role="img" aria-label={`${analytics.redemptionRate}% voucher đã được sử dụng`}>
        <circle className="is-active" cx="21" cy="21" r="15.9155" pathLength="100" transform="rotate(-90 21 21)" />
        {expiredRate > 0 ? <circle className="is-expired" cx="21" cy="21" r="15.9155" pathLength="100" transform="rotate(-90 21 21)" strokeDasharray={`${expiredRate} ${100 - expiredRate}`} strokeDashoffset={-usedRate} /> : null}
        {usedRate > 0 ? <circle className="is-used" cx="21" cy="21" r="15.9155" pathLength="100" transform="rotate(-90 21 21)" strokeDasharray={`${usedRate} ${100 - usedRate}`} /> : null}
        <text x="21" y="20" textAnchor="middle">{analytics.redemptionRate}%</text>
        <text className="is-caption" x="21" y="25" textAnchor="middle">đã dùng</text>
      </svg>
      <div className="crm-campaign-redemption-legend">
        <span className="is-used"><b>{analytics.usedCount}</b> đã dùng</span>
        <span className="is-active"><b>{analytics.activeUnusedCount}</b> còn hạn</span>
        <span className="is-expired"><b>{analytics.expiredCount}</b> hết hạn</span>
      </div>
    </div>
  );
}

function DailyUsageChart({ rows = [], expiresAt = "" }) {
  const chartWidth = 360;
  const chartHeight = 92;
  const plotTop = 8;
  const plotHeight = 48;
  const safeRows = rows.length ? rows : [{ date: "", count: 0 }];
  const gap = safeRows.length > 30 ? 1 : safeRows.length > 14 ? 2 : 4;
  const barWidth = Math.max(1.5, (chartWidth - gap * (safeRows.length - 1)) / safeRows.length);
  const maxCount = Math.max(1, ...safeRows.map((item) => Number(item.count || 0)));
  const labelEvery = safeRows.length > 14 ? Math.ceil(safeRows.length / 7) : 1;
  return (
    <div className="crm-campaign-daily-chart">
      <div className="crm-campaign-daily-chart__head">
        <span>Lượt dùng theo ngày</span>
        <small>Hạn {formatShortDate(expiresAt)}</small>
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Số voucher được sử dụng theo từng ngày">
        <line x1="0" y1={plotTop + plotHeight} x2={chartWidth} y2={plotTop + plotHeight} />
        {safeRows.map((item, index) => {
          const height = item.count ? Math.max(4, (Number(item.count) / maxCount) * plotHeight) : 2;
          const x = index * (barWidth + gap);
          const showLabel = index % labelEvery === 0 || index === safeRows.length - 1;
          return (
            <g key={`${item.date}-${index}`}>
              <rect x={x} y={plotTop + plotHeight - height} width={barWidth} height={height} rx="2" />
              {item.count ? <text className="is-value" x={x + barWidth / 2} y={plotTop + plotHeight - height - 3} textAnchor="middle">{item.count}</text> : null}
              {showLabel ? <text x={x + barWidth / 2} y="74" textAnchor="middle">{formatShortDate(item.date)}</text> : null}
            </g>
          );
        })}
      </svg>
      {!rows.some((item) => item.count > 0) ? <p>Chưa có lượt sử dụng trong thời gian theo dõi.</p> : null}
    </div>
  );
}

export default function CampaignHistoryWorkspace({ history = [], customers = [] }) {
  const [expandedId, setExpandedId] = useState("");
  const [detailMode, setDetailMode] = useState("used");
  const overview = useMemo(
    () => buildCampaignHistoryOverview(history, customers),
    [customers, history]
  );

  if (!history.length) {
    return (
      <div className="crm-empty-state">
        <p>Chưa có lịch sử gửi voucher hàng loạt.</p>
      </div>
    );
  }

  return (
    <section className="crm-campaign-performance">
      <div className="crm-campaign-performance__kpis" aria-label="Hiệu quả voucher">
        <article><span>Đã cấp</span><strong>{overview.grantedCount.toLocaleString("vi-VN")}</strong><small>Voucher cấp thành công</small></article>
        <article><span>Đã sử dụng</span><strong>{overview.usedCount.toLocaleString("vi-VN")}</strong><small>Khách đã dùng vào đơn</small></article>
        <article><span>Tỷ lệ sử dụng</span><strong>{overview.redemptionRate.toLocaleString("vi-VN")}%</strong><small>Đã dùng / đã cấp</small></article>
        <article><span>Doanh thu từ voucher</span><strong>{formatMoney(overview.attributedRevenue)}</strong><small>Tổng đơn có dùng voucher</small></article>
      </div>

      <div className="crm-campaign-performance__list">
        {overview.entries.map(({ entry, analytics }) => {
          const isExpanded = expandedId === entry.id;
          const detailRows = detailMode === "used" ? analytics.usedRows : analytics.unusedRows;
          return (
            <article key={entry.id} className="crm-campaign-performance-card">
              <div className="crm-campaign-performance-card__head">
                <div>
                  <span>{entry.voucherCode || "VOUCHER"}</span>
                  <strong>{entry.campaignLabel || "Tặng theo bộ lọc CRM"}</strong>
                  <small>{formatDateTime(entry.createdAt)} · {entry.sourceLabel || "CRM - gửi theo nhóm"}</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(isExpanded ? "" : entry.id);
                    setDetailMode("used");
                  }}
                >
                  {isExpanded ? "Thu gọn" : "Xem khách sử dụng"}
                </button>
              </div>

              <div className="crm-campaign-performance-card__metrics">
                <span><b>{analytics.grantedCount.toLocaleString("vi-VN")}</b> đã cấp</span>
                <span><b>{analytics.usedCount.toLocaleString("vi-VN")}</b> đã dùng</span>
                <span><b>{analytics.redemptionRate.toLocaleString("vi-VN")}%</b> sử dụng</span>
                <span><b>{formatMoney(analytics.attributedRevenue)}</b> doanh thu</span>
              </div>

              <div className="crm-campaign-performance-card__visuals">
                <RedemptionDonut analytics={analytics} />
                <DailyUsageChart rows={analytics.dailyUsage} expiresAt={analytics.expiresAt} />
              </div>

              {analytics.coverageRate < 100 ? (
                <p className="crm-campaign-performance-card__coverage">
                  Đã đối chiếu {analytics.matchedCount.toLocaleString("vi-VN")}/{analytics.grantedCount.toLocaleString("vi-VN")} voucher. Dữ liệu còn lại sẽ cập nhật khi CRM đồng bộ xong.
                </p>
              ) : null}

              {isExpanded ? (
                <div className="crm-campaign-performance-detail">
                  <div className="crm-campaign-performance-detail__tabs">
                    <button type="button" className={detailMode === "used" ? "is-active" : ""} onClick={() => setDetailMode("used")}>
                      Đã dùng {analytics.usedCount.toLocaleString("vi-VN")}
                    </button>
                    <button type="button" className={detailMode === "unused" ? "is-active" : ""} onClick={() => setDetailMode("unused")}>
                      Chưa dùng {analytics.unusedCount.toLocaleString("vi-VN")}
                    </button>
                  </div>
                  <div className="crm-campaign-performance-table">
                    {detailRows.slice(0, 100).map((row) => (
                      <div key={`${entry.id}-${row.phone}`}>
                        <span><strong>{row.name}</strong><small>{row.phone}</small></span>
                        <span><small>{row.used ? "Dùng lúc" : row.expired ? "Đã hết hạn" : "Hạn dùng"}</small><strong>{row.used ? formatDateTime(row.usedAt) : row.expiredAt || "--"}</strong></span>
                        <span><small>{row.used ? row.orderCode || "Đơn đã dùng" : "Trạng thái"}</small><strong>{row.used ? formatMoney(row.orderRevenue) : row.expired ? "Hết hạn" : "Chưa sử dụng"}</strong></span>
                      </div>
                    ))}
                    {!detailRows.length ? <p>Chưa có khách trong nhóm này.</p> : null}
                    {detailRows.length > 100 ? <p>Đang hiển thị 100/{detailRows.length.toLocaleString("vi-VN")} khách.</p> : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="crm-campaign-performance__note">
        Doanh thu chỉ tính các đơn đã ghi nhận đúng voucher của đợt gửi; không phải lợi nhuận sau chi phí.
      </p>
    </section>
  );
}
