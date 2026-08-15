import { useMemo } from "react";
import { formatMoney } from "../../../utils/format.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value || 0);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getLocalDateKey(value) {
  const date = startOfLocalDay(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildActivitySeries(customers = []) {
  const today = startOfLocalDay(new Date());
  const rows = Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date(today.getTime() - (TREND_DAYS - index - 1) * DAY_IN_MS);
    return {
      key: getLocalDateKey(date),
      label: formatShortDate(date),
      firstPurchase: 0,
      returning: 0,
      isToday: index === TREND_DAYS - 1
    };
  });
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));

  customers.forEach((customer) => {
    const firstPurchaseRow = rowsByKey.get(getLocalDateKey(customer?.firstOrderAt));
    if (firstPurchaseRow) firstPurchaseRow.firstPurchase += 1;

    if (Number(customer?.totalOrders || 0) < 2) return;
    const returningRow = rowsByKey.get(getLocalDateKey(customer?.lastOrderAt));
    if (returningRow) returningRow.returning += 1;
  });

  return rows;
}

function buildLinePoints(rows, field, width, height, padding, maxValue) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  return rows.map((row, index) => {
    const x = padding.left + (chartWidth * index) / Math.max(1, rows.length - 1);
    const y = padding.top + chartHeight - (Number(row[field] || 0) / maxValue) * chartHeight;
    return { x, y, value: Number(row[field] || 0), row };
  });
}

function toPolyline(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function buildSpendBuckets(customers = []) {
  const buckets = [
    { id: "none", label: "Chưa mua", count: 0 },
    { id: "under-100", label: "Dưới 100.000đ", count: 0 },
    { id: "100-300", label: "100.000đ – 300.000đ", count: 0 },
    { id: "300-700", label: "300.000đ – 700.000đ", count: 0 },
    { id: "over-700", label: "Trên 700.000đ", count: 0 }
  ];

  customers.forEach((customer) => {
    const totalOrders = Number(customer?.totalOrders || 0);
    const totalSpent = Number(customer?.totalSpent || 0);
    if (!totalOrders || totalSpent <= 0) buckets[0].count += 1;
    else if (totalSpent < 100000) buckets[1].count += 1;
    else if (totalSpent < 300000) buckets[2].count += 1;
    else if (totalSpent < 700000) buckets[3].count += 1;
    else buckets[4].count += 1;
  });

  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return buckets.map((bucket) => ({
    ...bucket,
    percentage: customers.length ? Math.round((bucket.count / customers.length) * 100) : 0,
    relativeWidth: Math.round((bucket.count / maxCount) * 100)
  }));
}

export function CrmActivityTrend({ customers = [] }) {
  const rows = useMemo(() => buildActivitySeries(customers), [customers]);
  const firstPurchaseTotal = rows.reduce((total, row) => total + row.firstPurchase, 0);
  const returningTotal = rows.reduce((total, row) => total + row.returning, 0);
  const hasData = firstPurchaseTotal > 0 || returningTotal > 0;
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 14, bottom: 34, left: 34 };
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.firstPurchase, row.returning]));
  const firstPurchasePoints = buildLinePoints(rows, "firstPurchase", width, height, padding, maxValue);
  const returningPoints = buildLinePoints(rows, "returning", width, height, padding, maxValue);
  const labelIndexes = new Set([0, 5, 11, 17, 23, 29]);

  return (
    <section className="crm-analysis-chart-card crm-analysis-chart-card--trend">
      <header className="crm-analysis-chart-head">
        <div>
          <span>Xu hướng 30 ngày</span>
          <h3>Khách mua lần đầu và quay lại</h3>
          <p>Dựa trên ngày mua đầu tiên và lần mua gần nhất đã đồng bộ.</p>
        </div>
        <div className="crm-analysis-chart-totals">
          <span><i className="is-new" />Mua lần đầu <b>{firstPurchaseTotal.toLocaleString("vi-VN")}</b></span>
          <span><i className="is-returning" />Quay lại <b>{returningTotal.toLocaleString("vi-VN")}</b></span>
        </div>
      </header>

      {hasData ? (
        <div className="crm-trend-chart" aria-label="Biểu đồ xu hướng khách mua trong 30 ngày">
          <svg viewBox={`0 0 ${width} ${height}`} role="img">
            <title>Xu hướng khách mua lần đầu và khách quay lại trong 30 ngày</title>
            {[0, 0.33, 0.66, 1].map((ratio) => {
              const y = padding.top + (height - padding.top - padding.bottom) * ratio;
              const value = Math.round(maxValue * (1 - ratio));
              return (
                <g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="crm-chart-grid-line" />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" className="crm-chart-axis-label">{value}</text>
                </g>
              );
            })}
            <polyline points={toPolyline(firstPurchasePoints)} className="crm-chart-line crm-chart-line--new" />
            <polyline points={toPolyline(returningPoints)} className="crm-chart-line crm-chart-line--returning" />
            {firstPurchasePoints.map((point, index) => (
              <g key={point.row.key}>
                {labelIndexes.has(index) ? (
                  <text x={point.x} y={height - 10} textAnchor="middle" className="crm-chart-axis-label">{point.row.label}</text>
                ) : null}
                {point.value ? (
                  <circle cx={point.x} cy={point.y} r="3" className="crm-chart-dot crm-chart-dot--new">
                    <title>{`${point.row.label}: ${point.value} khách mua lần đầu`}</title>
                  </circle>
                ) : null}
                {returningPoints[index].value ? (
                  <circle cx={returningPoints[index].x} cy={returningPoints[index].y} r="3" className="crm-chart-dot crm-chart-dot--returning">
                    <title>{`${point.row.label}: ${returningPoints[index].value} khách quay lại`}</title>
                  </circle>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="crm-analysis-chart-empty">
          <strong>Chưa có dữ liệu xu hướng</strong>
          <span>Cần có ngày mua đầu hoặc lần mua gần nhất để dựng biểu đồ.</span>
        </div>
      )}

      <footer className="crm-analysis-chart-foot">
        <span>30 ngày gần nhất</span>
        <em>Hôm nay chưa hoàn tất</em>
      </footer>
    </section>
  );
}

export function CrmSpendDistribution({ customers = [] }) {
  const buckets = useMemo(() => buildSpendBuckets(customers), [customers]);
  const spendingCustomers = customers.filter((customer) => Number(customer?.totalSpent || 0) > 0);
  const totalSpent = spendingCustomers.reduce((total, customer) => total + Number(customer?.totalSpent || 0), 0);
  const averageSpent = spendingCustomers.length ? totalSpent / spendingCustomers.length : 0;

  return (
    <section className="crm-analysis-chart-card crm-analysis-chart-card--spend">
      <header className="crm-analysis-chart-head">
        <div>
          <span>Phân bổ giá trị</span>
          <h3>Khách theo mức chi tiêu</h3>
          <p>Tổng chi tiêu trong toàn bộ lịch sử đã đồng bộ.</p>
        </div>
        <strong>{formatMoney(Math.round(averageSpent))}<small>TB / khách đã mua</small></strong>
      </header>

      <div className="crm-spend-distribution" aria-label="Phân bổ khách hàng theo mức chi tiêu">
        {buckets.map((bucket) => (
          <div className="crm-spend-row" key={bucket.id}>
            <div>
              <span>{bucket.label}</span>
              <b>{bucket.count.toLocaleString("vi-VN")} khách · {bucket.percentage}%</b>
            </div>
            <span className="crm-spend-track">
              <i style={{ width: `${bucket.relativeWidth}%` }} />
            </span>
          </div>
        ))}
      </div>

      <footer className="crm-analysis-chart-foot">
        <span>{customers.length.toLocaleString("vi-VN")} hồ sơ được phân tích</span>
        <em>Toàn thời gian</em>
      </footer>
    </section>
  );
}

export default {
  CrmActivityTrend,
  CrmSpendDistribution
};
