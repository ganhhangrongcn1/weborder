import { formatMoney } from "../../../utils/format.js";
import Icon from "../../../components/Icon.jsx";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";
import { addDaysToVietnamDateInput, toVietnamDateInputValue } from "../../../utils/adminDateRange.js";
import AdminBusinessAnalyticsSection, { AdminSettlementSummary } from "./AdminBusinessAnalyticsSection.jsx";
import {
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminStatCard
} from "../ui/index.js";

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return new Intl.NumberFormat("vi-VN").format(numeric);
}

function formatDashboardMoney(value) {
  return formatMoney(Math.round(Number(value || 0)));
}


function getChannelLabel(channel = "") {
  const normalized = String(channel || "").toLowerCase();
  if (normalized === "grabfood") return "Grab";
  if (normalized === "shopeefood") return "ShopeeFood";
  if (normalized === "xanhngon") return "Xanh Ngon";
  if (normalized === "qr_counter") return "QR";
  if (normalized === "pos" || normalized === "posmobile" || normalized === "pos_mobile") return "POS";
  if (normalized === "website") return "Web";
  if (normalized === "unknown") return "Chưa xác định";
  if (normalized === "other") return "Khác";
  return channel || "Chưa xác định";
}

function buildRpcChannels(channels = []) {
  return channels.map((channel) => ({
    name: getChannelLabel(channel.channel),
    count: Number(channel.totalOrders || 0),
    revenueOrderCount: Number(channel.revenueOrderCount || 0),
    revenue: Number(channel.netRevenue || 0)
  }));
}

function formatComparison(currentValue = 0, previousValue = 0) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (!previous) return current ? "+100%" : "0%";
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function formatDateLabel(value = "") {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function buildTrafficDailyBars(daily = []) {
  const items = (Array.isArray(daily) ? daily : []).slice(-7);
  return items.map((item) => ({
    date: item.date,
    label: formatDateLabel(item.date),
    pageViews: Number(item.pageViews || 0),
    uniqueVisitors: Number(item.uniqueVisitors || 0)
  }));
}

function getChannelColor(name = "") {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("grab")) return "#16a34a";
  if (normalized.includes("shopee")) return "#f97316";
  if (normalized.includes("xanh")) return "#0f766e";
  if (normalized.includes("pos")) return "#334155";
  if (normalized === "web" || normalized.includes("website")) return "#2563eb";
  if (normalized.includes("qr")) return "#7c3aed";
  if (normalized.includes("lấy") || normalized.includes("pickup")) return "#d97706";
  if (normalized.includes("chưa xác định")) return "#dc2626";
  if (normalized === "khác") return "#94a3b8";
  return "#64748b";
}

function buildDonutSegments(channels = [], total = 0) {
  let offset = 0;
  return channels.map((channel) => {
    const value = total ? channel.count / total : 0;
    const segment = {
      ...channel,
      color: getChannelColor(channel.name),
      dashArray: `${value} ${Math.max(0, 1 - value)}`,
      dashOffset: -offset
    };
    offset += value;
    return segment;
  });
}

function buildSmoothRevenuePath(points = []) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const segments = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[index + 2] || next;
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (nextNext.x - current.x) / 6;
    const cp2y = next.y - (nextNext.y - current.y) / 6;
    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`);
  }
  return segments.join(" ");
}

function buildRevenueChart(series = []) {
  const safeSeries = series.length ? series : [{ key: "empty", label: "--", value: 0 }];
  const width = 680;
  const height = 250;
  const padding = { top: 24, right: 22, bottom: 38, left: 48 };
  const maxValue = Math.max(...safeSeries.map((item) => item.value), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = safeSeries.length > 1 ? plotWidth / (safeSeries.length - 1) : plotWidth;
  const labelStep = Math.max(1, Math.ceil(safeSeries.length / 7));
  const points = safeSeries.map((item, index) => ({
    ...item,
    x: padding.left + index * step,
    y: padding.top + (1 - item.value / maxValue) * plotHeight,
    showLabel: index % labelStep === 0 || index === safeSeries.length - 1
  }));
  const linePath = buildSmoothRevenuePath(points);
  const areaPath = points.length
    ? `M ${points[0].x} ${height - padding.bottom} L ${points[0].x} ${points[0].y} ${linePath.replace(/^M\s+[\d.-]+\s+[\d.-]+/, "")} L ${points[points.length - 1].x} ${height - padding.bottom} Z`
    : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padding.top + ratio * plotHeight,
    value: Math.round(maxValue * (1 - ratio))
  }));
  return { width, height, padding, points, linePath, areaPath, gridLines };
}

function formatUpdatedTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getBranchShortLabel(label = "") {
  return String(label || "")
    .replace(/^Gánh Hàng Rong\s*[-–]\s*/i, "")
    .trim();
}

function getDashboardTrustMeta(statusMap = {}) {
  const requiredKeys = ["summary", "analytics", "revenue", "orders"];
  const states = requiredKeys.map((key) => statusMap?.[key]?.status || "idle");
  const hasError = states.includes("error");
  const isLoading = states.some((status) => status === "loading" || status === "idle");
  const updatedTimes = requiredKeys
    .map((key) => statusMap?.[key]?.updatedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (hasError) {
    return {
      tone: "danger",
      label: "Dữ liệu Supabase chưa đầy đủ",
      updatedAt: updatedTimes.length ? new Date(Math.min(...updatedTimes)).toISOString() : ""
    };
  }
  if (isLoading) {
    return {
      tone: "warning",
      label: "Đang tải dữ liệu Supabase",
      updatedAt: ""
    };
  }
  return {
    tone: "success",
    label: "Dữ liệu trực tiếp từ Supabase",
    updatedAt: updatedTimes.length ? new Date(Math.min(...updatedTimes)).toISOString() : ""
  };
}

export default function AdminDashboardSection({
  dashboardDateFrom,
  setDashboardDateFrom,
  dashboardDateTo,
  setDashboardDateTo,
  dashboardDatePreset,
  setDashboardDatePreset,
  openBranches,
  totalBranches,
  ordersTotal,
  ordersNew,
  ordersDoing,
  totalCustomers,
  periodCustomers,
  dashboardChartPreset,
  setDashboardChartPreset,
  dashboardSummary,
  dashboardRevenueSeries,
  businessAnalytics,
  siteTrafficSummary,
  dashboardDataStatus = {},
  selectedBranchFilter = "all",
  setSelectedBranchFilter,
  branches = []
}) {
  const branchOptions = buildBranchFilterOptions(branches);
  const rpcMetrics = dashboardSummary?.source === "rpc" ? dashboardSummary.current : null;
  const displayedOrdersTotal = rpcMetrics ? ordersTotal : null;
  const displayedOrdersNew = rpcMetrics ? ordersNew : null;
  const topProducts = businessAnalytics?.source === "rpc"
    ? businessAnalytics.topByQuantity.slice(0, 5).map((item, index) => ({
        id: `${item.name}-${index}`,
        name: item.name,
        quantity: Number(item.quantity || 0)
      }))
    : [];
  const topProductMax = Math.max(...topProducts.map((item) => item.quantity), 1);
  const channels = dashboardSummary?.source === "rpc"
    ? buildRpcChannels(dashboardSummary.channels)
    : [];
  const channelTotal = channels.reduce((sum, channel) => sum + channel.count, 0);
  const channelSegments = buildDonutSegments(channels, channelTotal);
  const averageOrder = rpcMetrics?.averageOrderValue ?? null;
  const completionCount = rpcMetrics?.completedOrders ?? null;
  const completionRate = rpcMetrics && displayedOrdersTotal
    ? Math.round((completionCount / displayedOrdersTotal) * 100)
    : rpcMetrics
      ? 0
      : null;
  const pendingOrders = rpcMetrics?.pendingOrders ?? displayedOrdersNew;
  const preparingOrders = rpcMetrics ? rpcMetrics.preparingOrders : ordersDoing;
  const deliveringOrders = rpcMetrics?.deliveringOrders ?? null;
  const cancelledOrders = rpcMetrics?.cancelledOrders ?? null;
  const cancelRate = rpcMetrics ? Math.round(Number(rpcMetrics.cancelRate || 0) * 100) : null;
  const displayedSitePageViews = siteTrafficSummary ? formatNumber(siteTrafficSummary.pageViews || 0) : "--";
  const displayedSiteVisitors = siteTrafficSummary ? formatNumber(siteTrafficSummary.uniqueVisitors || 0) : "--";
  const trafficDailyBars = buildTrafficDailyBars(siteTrafficSummary?.daily || []);
  const trafficComparison = siteTrafficSummary?.comparison || {};
  const trafficDelta = Number(trafficComparison.uniqueVisitorDelta || 0);
  const trafficPeriodLabel = trafficComparison.dayCount > 1 ? "kỳ trước" : "hôm qua";
  const trafficTrendLabel = siteTrafficSummary
    ? trafficDelta
      ? `${trafficDelta > 0 ? "+" : ""}${formatNumber(trafficDelta)} khách so với ${trafficPeriodLabel}`
      : `Không đổi so với ${trafficPeriodLabel}`
    : "Đang tải dữ liệu truy cập";
  const trafficAverageViews = Number(siteTrafficSummary?.averagePageViewsPerVisitor || 0);
  const operationalStats = [
    { label: "Đơn mới", value: pendingOrders ?? "--", detail: "chờ xác nhận", tone: pendingOrders ? "warning" : "success" },
    { label: "Đang làm", value: preparingOrders ?? "--", detail: "bếp xử lý", tone: "brand" },
    { label: "Đang giao", value: deliveringOrders ?? "--", detail: "trên đường", tone: "info" },
    { label: "Đơn hủy", value: cancelledOrders ?? "--", detail: cancelRate === null ? "chưa có dữ liệu" : `${cancelRate}% tổng đơn`, tone: cancelRate >= 10 ? "warning" : "neutral" }
  ];

  const chartMetrics = dashboardRevenueSeries?.source === "rpc" ? dashboardRevenueSeries.metrics : null;
  const chartOrdersTotal = chartMetrics?.totalOrders ?? null;
  const chartRevenueTotal = chartMetrics?.netRevenue ?? null;
  const chartAverageOrder = chartMetrics?.averageOrderValue ?? null;
  const revenueSeries = dashboardRevenueSeries?.source === "rpc"
    ? dashboardRevenueSeries.dailyRevenue.map((item) => ({
        key: item.date,
        label: formatDateLabel(item.date),
        value: item.netRevenue
      }))
    : [];
  const revenueChart = buildRevenueChart(revenueSeries);
  const chartDailyAverage = revenueSeries.length
    ? Math.round(Number(chartRevenueTotal || 0) / revenueSeries.length)
    : 0;
  const chartPeakDay = revenueSeries.length
    ? revenueSeries.reduce((best, item) => (item.value > best.value ? item : best), revenueSeries[0])
    : null;
  const trustMeta = getDashboardTrustMeta(dashboardDataStatus);
  const trustUpdatedLabel = formatUpdatedTime(trustMeta.updatedAt);
  const dashboardErrors = Object.values(dashboardDataStatus)
    .filter((item) => item?.status === "error" && item?.error)
    .map((item) => item.error);
  const todayText = toVietnamDateInputValue();

  const applyPreset = (preset) => {
    if (preset === "today") {
      setDashboardDateFrom(todayText);
      setDashboardDateTo(todayText);
    }
    if (preset === "yesterday") {
      const text = addDaysToVietnamDateInput(todayText, -1);
      setDashboardDateFrom(text);
      setDashboardDateTo(text);
    }
    if (preset === "week") {
      const day = new Date(`${todayText}T12:00:00+07:00`).getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      setDashboardDateFrom(addDaysToVietnamDateInput(todayText, -diff));
      setDashboardDateTo(todayText);
    }
    if (preset === "month") {
      setDashboardDateFrom(`${todayText.slice(0, 7)}-01`);
      setDashboardDateTo(todayText);
    }
    setDashboardDatePreset(preset);
  };

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-command-bar">
        <div className="admin-dashboard-command-title">
          <div>
            <h1>Tổng quan vận hành</h1>
            <small>
              <i className={openBranches === totalBranches ? "is-open" : "is-partial"} />
              {openBranches}/{totalBranches} chi nhánh đang mở
              <b>·</b>
              {trustUpdatedLabel ? `Cập nhật ${trustUpdatedLabel}` : "Đang cập nhật"}
            </small>
          </div>
        </div>

        <div className="admin-dashboard-branch-switcher">
          <span>Xem theo chi nhánh</span>
          <div role="group" aria-label="Chọn chi nhánh">
            <button
              type="button"
              className={selectedBranchFilter === "all" ? "is-active" : ""}
              aria-pressed={selectedBranchFilter === "all"}
              onClick={() => setSelectedBranchFilter?.("all")}
            >
              Tất cả
            </button>
            {branchOptions.map((branch) => (
              <button
                type="button"
                key={branch.value}
                className={branch.value === selectedBranchFilter ? "is-active" : ""}
                aria-pressed={branch.value === selectedBranchFilter}
                onClick={() => setSelectedBranchFilter?.(branch.value)}
                title={branch.label}
              >
                {getBranchShortLabel(branch.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-dashboard-period-controls">
          <label className="admin-dashboard-period-select">
            <Icon name="clock" size={16} />
            <AdminSelect
              value={dashboardDatePreset || "today"}
              onChange={(event) => {
                const nextPreset = event.target.value;
                if (nextPreset === "custom") {
                  setDashboardDatePreset("custom");
                  return;
                }
                applyPreset(nextPreset);
              }}
              options={[
                { value: "today", label: "Hôm nay" },
                { value: "yesterday", label: "Hôm qua" },
                { value: "week", label: "Tuần này" },
                { value: "month", label: "Tháng này" },
                { value: "custom", label: "Tùy chỉnh..." }
              ]}
            />
          </label>
          {dashboardDatePreset === "custom" ? (
            <>
              <label className="admin-dashboard-period-date">
                <span>Từ</span>
                <AdminInput type="date" value={dashboardDateFrom || ""} max={dashboardDateTo || todayText} onChange={(event) => { setDashboardDateFrom(event.target.value); setDashboardDatePreset("custom"); }} />
              </label>
              <label className="admin-dashboard-period-date">
                <span>Đến</span>
                <AdminInput type="date" value={dashboardDateTo || ""} min={dashboardDateFrom || ""} max={todayText} onChange={(event) => { setDashboardDateTo(event.target.value); setDashboardDatePreset("custom"); }} />
              </label>
            </>
          ) : null}
        </div>
      </header>

      {dashboardErrors.length ? (
        <div className="admin-dashboard-data-alert is-soft" role="status">
          <Icon name="warning" size={17} />
          <span>Một số báo cáo chi tiết đang tạm gián đoạn. Các chỉ số vận hành vẫn được cập nhật.</span>
        </div>
      ) : null}

      <AdminSettlementSummary
        analytics={businessAnalytics}
        status={dashboardDataStatus?.analytics?.status}
        fallbackNetRevenue={rpcMetrics?.netRevenue}
      >
        <div className="admin-dashboard-stat-grid">
          <AdminStatCard title="Tổng đơn" value={displayedOrdersTotal ?? "--"} subtitle={displayedOrdersNew === null ? "Đang cập nhật" : `${displayedOrdersNew} đơn mới`} icon={<Icon name="bag" size={22} />} tone="brand" />
          <AdminStatCard title="Đơn trung bình" value={averageOrder === null ? "--" : formatDashboardMoney(averageOrder)} subtitle="Doanh thu thực nhận trung bình mỗi đơn" icon={<Icon name="star" size={22} />} tone="amber" />
          <AdminStatCard title="Tỷ lệ hoàn tất" value={completionRate === null ? "--" : `${completionRate}%`} subtitle={completionCount === null ? "Đang cập nhật" : `${completionCount} đơn hoàn tất`} icon={<Icon name="check" size={22} />} tone="blue" />
        </div>
      </AdminSettlementSummary>

      <section className="admin-dashboard-traffic-strip" aria-label="Khách truy cập website">
        <div className="admin-dashboard-traffic-heading">
          <span>Website</span>
          <strong>{displayedSiteVisitors} khách vào trang</strong>
          <small>{trafficTrendLabel}</small>
        </div>
        {trafficDailyBars.length ? (
          <div className="admin-dashboard-traffic-inline">
            <article>
              <span>Lượt xem trang</span>
              <strong>{displayedSitePageViews}</strong>
            </article>
            <article>
              <span>Mỗi khách xem</span>
              <strong>{trafficAverageViews ? `${trafficAverageViews} trang` : "0 trang"}</strong>
            </article>
            <article className={trafficDelta > 0 ? "is-up" : trafficDelta < 0 ? "is-down" : ""}>
              <span>So với {trafficPeriodLabel}</span>
              <strong>{trafficDelta > 0 ? "+" : ""}{formatNumber(trafficDelta)} khách</strong>
            </article>
            <div className="admin-dashboard-traffic-days">
              {trafficDailyBars.map((item) => (
                <span key={item.date} title={`${item.label}: ${formatNumber(item.pageViews)} lượt, ${formatNumber(item.uniqueVisitors)} khách`}>
                  <b>{item.label}</b>
                  <strong>{formatNumber(item.uniqueVisitors)} khách</strong>
                  <small>{formatNumber(item.pageViews)} lượt xem</small>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="admin-dashboard-traffic-empty">
            {dashboardDataStatus?.traffic?.status === "error"
              ? "Dữ liệu truy cập đang tạm gián đoạn."
              : "Chưa có khách truy cập trong kỳ này."}
          </div>
        )}
      </section>

      <section className="admin-dashboard-ops-strip" aria-label="Trạng thái vận hành">
        <div className="admin-dashboard-ops-title">
          <div>
            <span>Vận hành</span>
            <strong>Trạng thái đơn</strong>
          </div>
        </div>
        <div className="admin-dashboard-ops-items">
          {operationalStats.map((item) => (
            <article key={item.label} className={`admin-dashboard-ops-item is-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-dashboard-main-grid">
        <AdminPanel
          title="Xu hướng doanh thu"
          description="Diễn biến doanh thu thực nhận trong khoảng thời gian đã chọn."
          className="admin-dashboard-revenue-card"
          action={
            <AdminSelect
              value={dashboardChartPreset || "7d"}
              onChange={(event) => setDashboardChartPreset(event.target.value)}
              options={[
                { value: "7d", label: "7 ngày gần nhất" },
                { value: "month", label: "Tháng này" },
                { value: "30d", label: "30 ngày gần nhất" }
              ]}
            />
          }
        >
          {chartMetrics ? (
            <>
              <div className="admin-dashboard-revenue-visual">
                <strong>{formatDashboardMoney(chartRevenueTotal)}</strong>
                <span>{chartOrdersTotal} đơn · {formatDashboardMoney(chartAverageOrder)} / đơn</span>
                <div className="admin-dashboard-revenue-chart">
                  <svg viewBox={`0 0 ${revenueChart.width} ${revenueChart.height}`} role="img" aria-label="Biểu đồ doanh thu thực nhận">
                    <defs>
                      <linearGradient id="adminRevenueArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#fb923c" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    {revenueChart.gridLines.map((line) => (
                      <g key={line.y}>
                        <line x1={revenueChart.padding.left} x2={revenueChart.width - revenueChart.padding.right} y1={line.y} y2={line.y} />
                        <text x="10" y={line.y + 4}>{formatDashboardMoney(line.value)}</text>
                      </g>
                    ))}
                    <path className="admin-dashboard-revenue-area" d={revenueChart.areaPath} />
                    <path className="admin-dashboard-revenue-line" d={revenueChart.linePath} />
                    {revenueChart.points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="5" />)}
                    {revenueChart.points.filter((point) => point.showLabel).map((point) => (
                      <text key={`${point.key}-label`} className="admin-dashboard-revenue-date" x={point.x} y={revenueChart.height - 10}>{point.label}</text>
                    ))}
                  </svg>
                </div>
              </div>
              <div className="admin-dashboard-mini-metrics">
                <span><b>{formatDashboardMoney(chartDailyAverage)}</b> trung bình / ngày</span>
                <span><b>{chartOrdersTotal}</b> đơn trong kỳ</span>
                <span><b>{dashboardSummary?.source === "rpc" ? formatComparison(dashboardSummary.current.netRevenue, dashboardSummary.previous.netRevenue) : "--"}</b> so với kỳ trước</span>
                <span><b>{chartPeakDay ? formatDashboardMoney(chartPeakDay.value) : "--"}</b> cao nhất{chartPeakDay ? ` · ${chartPeakDay.label}` : ""}</span>
              </div>
            </>
          ) : (
            <div className="admin-dashboard-empty-note">
              {dashboardDataStatus?.revenue?.status === "error"
                ? "Biểu đồ doanh thu đang tạm gián đoạn."
                : "Đang tải biểu đồ doanh thu..."}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Cơ cấu kênh bán" description="Tỷ trọng số đơn và doanh thu của từng kênh bán." className="admin-dashboard-channel-card">
          {channels.length ? (
            <div className="admin-dashboard-channel-donut-wrap">
              <div className="admin-dashboard-channel-donut">
                <svg viewBox="0 0 42 42" aria-label="Biểu đồ tỷ trọng đơn hàng theo kênh" role="img">
                  <circle className="admin-dashboard-channel-donut-bg" cx="21" cy="21" r="15.9155" pathLength="1" />
                  {channelSegments.map((channel) => (
                    <circle
                      key={channel.name}
                      className="admin-dashboard-channel-donut-segment"
                      cx="21"
                      cy="21"
                      r="15.9155"
                      pathLength="1"
                      stroke={channel.color}
                      strokeDasharray={channel.dashArray}
                      strokeDashoffset={channel.dashOffset}
                    />
                  ))}
                </svg>
                <div className="admin-dashboard-channel-donut-center">
                  <strong>{channelTotal}</strong>
                  <span>đơn</span>
                </div>
              </div>
              <div className="admin-dashboard-channel-legend">
                {channelSegments.map((channel) => {
                const percent = channelTotal ? Math.round((channel.count / channelTotal) * 100) : 0;
                return (
                  <div key={channel.name} className="admin-dashboard-channel-legend-row">
                    <i style={{ backgroundColor: channel.color }} />
                    <strong>{channel.name}</strong>
                    <span>{channel.count} đơn · {percent}%{channel.revenue !== undefined ? ` · ${formatDashboardMoney(channel.revenue)}` : ""}</span>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="admin-dashboard-empty-note">
              {dashboardDataStatus?.summary?.status === "error"
                ? "Cơ cấu kênh bán đang tạm gián đoạn."
                : "Chưa có đơn theo kênh trong kỳ đã chọn."}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Món bán chạy" description="Những món được gọi nhiều nhất trong kỳ đã chọn." className="admin-dashboard-top-products">
          {topProducts.length ? (
            <div className="admin-dashboard-product-list">
              {topProducts.map((item, index) => (
                <article key={item.id} className="admin-dashboard-product-row">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <em><i style={{ width: `${Math.max(8, (item.quantity / topProductMax) * 100)}%` }} /></em>
                  </div>
                  <small>{item.quantity}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-dashboard-empty-note">
              {dashboardDataStatus?.analytics?.status === "error"
                ? "Chưa có dữ liệu món bán trong kỳ này."
                : "Chưa có món bán trong kỳ đã chọn."}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminBusinessAnalyticsSection
        analytics={businessAnalytics}
        status={dashboardDataStatus?.analytics?.status}
      />
    </div>
  );
}



