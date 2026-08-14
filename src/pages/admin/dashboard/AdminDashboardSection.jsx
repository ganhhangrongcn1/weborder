import { useState } from "react";
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

function formatDashboardDateLabel(value = "") {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "--/--/----";
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

function getRevenueInsight(current = {}, previous = {}) {
  const currentRevenue = Number(current.netRevenue || 0);
  const previousRevenue = Number(previous.netRevenue || 0);
  const currentOrders = Number(current.totalOrders || 0);
  const previousOrders = Number(previous.totalOrders || 0);
  const currentAverage = Number(current.averageOrderValue || 0);
  const previousAverage = Number(previous.averageOrderValue || 0);

  if (!previousRevenue) {
    return "Chưa đủ dữ liệu kỳ trước để xác định nguyên nhân tăng giảm.";
  }

  const revenueChange = Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100);
  const orderChange = previousOrders ? Math.round(((currentOrders - previousOrders) / previousOrders) * 100) : 0;
  const averageChange = previousAverage ? Math.round(((currentAverage - previousAverage) / previousAverage) * 100) : 0;
  const direction = revenueChange >= 0 ? "tăng" : "giảm";
  const mainDriver = Math.abs(orderChange) >= Math.abs(averageChange)
    ? `số đơn ${orderChange >= 0 ? "tăng" : "giảm"} ${Math.abs(orderChange)}%`
    : `giá trị đơn trung bình ${averageChange >= 0 ? "tăng" : "giảm"} ${Math.abs(averageChange)}%`;

  return `Doanh thu ${direction} ${Math.abs(revenueChange)}% so với kỳ trước, chủ yếu do ${mainDriver}.`;
}

function formatDateLabel(value = "") {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatWeekdayLabel(value = "") {
  if (!value) return "--";
  const date = new Date(`${value}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return "--";
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getUTCDay()];
}

function getBestWeekdayInsight(series = []) {
  const weekdayMap = new Map();
  series.forEach((item) => {
    const current = weekdayMap.get(item.weekday) || { revenue: 0, days: 0 };
    weekdayMap.set(item.weekday, {
      revenue: current.revenue + Number(item.revenue || 0),
      days: current.days + 1
    });
  });
  const ranked = [...weekdayMap.entries()]
    .map(([weekday, value]) => ({ weekday, average: value.days ? value.revenue / value.days : 0 }))
    .sort((a, b) => b.average - a.average);
  if (!ranked.length || !ranked[0].average) return "Chưa đủ dữ liệu để xác định ngày bán tốt nhất.";
  return `${ranked[0].weekday} đang là ngày bán tốt nhất, tính theo doanh thu trung bình trong kỳ.`;
}

function formatTrafficPointLabel(value = "", period = "24h", detailed = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  if (period === "24h") {
    return date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: detailed ? "2-digit" : undefined,
      month: detailed ? "2-digit" : undefined,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit"
  });
}

function buildTrafficChart(series = [], period = "24h") {
  const width = 820;
  const height = 210;
  const padding = { top: 18, right: 24, bottom: 34, left: 48 };
  const safeSeries = series.length ? series : [{ bucketStart: "", uniqueVisitors: 0, pageViews: 0 }];
  const maxValue = Math.max(...safeSeries.map((item) => Number(item.uniqueVisitors || 0)), 1);
  const roundedMax = Math.max(4, Math.ceil(maxValue / 4) * 4);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = safeSeries.length > 1 ? plotWidth / (safeSeries.length - 1) : plotWidth;
  const labelStep = period === "30d" ? 5 : period === "24h" ? 4 : 1;
  const points = safeSeries.map((item, index) => ({
    ...item,
    x: padding.left + index * step,
    y: padding.top + (1 - Number(item.uniqueVisitors || 0) / roundedMax) * plotHeight,
    label: formatTrafficPointLabel(item.bucketStart, period),
    detailLabel: formatTrafficPointLabel(item.bucketStart, period, true),
    showLabel: index % labelStep === 0 || index === safeSeries.length - 1
  }));
  const linePath = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padding.top + ratio * plotHeight,
    value: Math.round(roundedMax * (1 - ratio))
  }));
  return { width, height, padding, points, linePath, areaPath, gridLines };
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
  siteTrafficPreset = "24h",
  setSiteTrafficPreset,
  openAdminNav,
  dashboardDataStatus = {},
  selectedBranchFilter = "all",
  setSelectedBranchFilter,
  dashboardBranchFilters = [],
  setDashboardBranchFilters,
  branches = []
}) {
  const [activeTrafficPoint, setActiveTrafficPoint] = useState(null);
  const [revenueMetric, setRevenueMetric] = useState("revenue");
  const [activeRevenuePoint, setActiveRevenuePoint] = useState(null);
  const branchOptions = buildBranchFilterOptions(branches);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const selectedBranchCount = dashboardBranchFilters.length || branchOptions.length;
  const allBranchesSelected = !dashboardBranchFilters.length || dashboardBranchFilters.length === branchOptions.length;
  const selectedBranchLabel = allBranchesSelected
    ? "Tất cả chi nhánh"
    : dashboardBranchFilters.length === 1
      ? getBranchShortLabel(branchOptions.find((branch) => branch.value === dashboardBranchFilters[0])?.label || "Chi nhánh")
      : `${selectedBranchCount}/${branchOptions.length} chi nhánh`;

  const toggleDashboardBranch = (branchValue) => {
    if (branchValue === "all") {
      setDashboardBranchFilters?.([]);
      return;
    }
    const allValues = branchOptions.map((branch) => branch.value);
    const currentValues = allBranchesSelected ? allValues : dashboardBranchFilters;
    const nextValues = currentValues.includes(branchValue)
      ? currentValues.filter((value) => value !== branchValue)
      : [...currentValues, branchValue];
    if (!nextValues.length) return;
    setDashboardBranchFilters?.(nextValues.length === allValues.length ? [] : nextValues);
  };
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
  const trafficPoints = Array.isArray(siteTrafficSummary?.points) ? siteTrafficSummary.points : [];
  const trafficComparison = siteTrafficSummary?.comparison || {};
  const trafficDelta = Number(trafficComparison.uniqueVisitorDelta || 0);
  const trafficPeriodLabel = siteTrafficPreset === "24h" ? "24 giờ trước" : `${siteTrafficPreset.replace("d", " ngày")} trước`;
  const trafficTrendLabel = siteTrafficSummary
    ? trafficDelta
      ? `${trafficDelta > 0 ? "+" : ""}${formatNumber(trafficDelta)} khách so với ${trafficPeriodLabel}`
      : `Không đổi so với ${trafficPeriodLabel}`
    : "Đang tải dữ liệu truy cập";
  const trafficAverageViews = Number(siteTrafficSummary?.averagePageViewsPerVisitor || 0);
  const trafficChart = buildTrafficChart(trafficPoints, siteTrafficPreset);
  const operationalStats = [
    { label: "Đơn mới", value: pendingOrders ?? "--", detail: "chờ xác nhận", tone: pendingOrders ? "warning" : "success" },
    { label: "Đang làm", value: preparingOrders ?? "--", detail: "bếp xử lý", tone: "brand" },
    { label: "Đang giao", value: deliveringOrders ?? "--", detail: "trên đường", tone: "info" },
    { label: "Đơn hủy", value: cancelledOrders ?? "--", detail: cancelRate === null ? "chưa có dữ liệu" : `${cancelRate}% tổng đơn`, tone: cancelRate >= 10 ? "warning" : "neutral" }
  ];

  const chartMetrics = dashboardRevenueSeries?.source === "rpc" ? dashboardRevenueSeries.metrics : null;
  const chartComparisonMetrics = dashboardRevenueSeries?.source === "rpc"
    ? dashboardRevenueSeries.comparisonMetrics
    : null;
  const chartOrdersTotal = chartMetrics?.totalOrders ?? null;
  const chartRevenueTotal = chartMetrics?.netRevenue ?? null;
  const chartAverageOrder = chartMetrics?.averageOrderValue ?? null;
  const revenueSeries = dashboardRevenueSeries?.source === "rpc"
    ? dashboardRevenueSeries.dailyRevenue.map((item) => ({
        key: item.date,
        label: formatDateLabel(item.date),
        weekday: formatWeekdayLabel(item.date),
        revenue: Number(item.netRevenue || 0),
        orders: Number(item.totalOrders || 0),
        averageOrder: Number(item.totalOrders || 0) ? Math.round(Number(item.netRevenue || 0) / Number(item.totalOrders || 0)) : 0
      }))
    : [];
  const revenueMetricConfig = {
    revenue: { label: "Doanh thu", format: formatDashboardMoney },
    orders: { label: "Số đơn", format: (value) => `${formatNumber(value)} đơn` },
    averageOrder: { label: "Đơn trung bình", format: formatDashboardMoney }
  }[revenueMetric];
  const revenueMetricMax = Math.max(...revenueSeries.map((item) => Number(item[revenueMetric] || 0)), 1);
  const chartPeakDay = revenueSeries.length
    ? revenueSeries.reduce((best, item) => (item.revenue > best.revenue ? item : best), revenueSeries[0])
    : null;
  const revenueInsight = chartMetrics && chartComparisonMetrics
    ? getRevenueInsight(chartMetrics, chartComparisonMetrics)
    : "Chưa đủ dữ liệu kỳ trước để xác định nguyên nhân tăng giảm.";
  const bestWeekdayInsight = getBestWeekdayInsight(revenueSeries);
  const previousRevenue = Number(chartComparisonMetrics?.netRevenue || 0);
  const revenueDifference = Number(chartRevenueTotal || 0) - previousRevenue;
  const revenueDifferencePercent = previousRevenue
    ? Math.round((revenueDifference / previousRevenue) * 100)
    : null;
  const orderDifferencePercent = chartMetrics && chartComparisonMetrics
    ? formatComparison(chartMetrics.totalOrders, chartComparisonMetrics.totalOrders)
    : "--";
  const averageDifferencePercent = chartMetrics && chartComparisonMetrics
    ? formatComparison(chartMetrics.averageOrderValue, chartComparisonMetrics.averageOrderValue)
    : "--";
  const trustMeta = getDashboardTrustMeta(dashboardDataStatus);
  const trustUpdatedLabel = formatUpdatedTime(trustMeta.updatedAt);
  const dashboardErrors = Object.values(dashboardDataStatus)
    .filter((item) => item?.status === "error" && item?.error)
    .map((item) => item.error);
  const operationalAlerts = [
    dashboardErrors.length
      ? { tone: "danger", title: "Dữ liệu báo cáo gián đoạn", detail: "Một số nguồn chưa cập nhật đầy đủ.", icon: "warning" }
      : null,
    Number(pendingOrders || 0) > 0
      ? { tone: "warning", title: `${pendingOrders} đơn đang chờ xác nhận`, detail: "Kiểm tra để tránh khách phải đợi lâu.", icon: "clock" }
      : null,
    Number(cancelRate || 0) >= 10
      ? { tone: "danger", title: `Tỷ lệ hủy đang ở mức ${cancelRate}%`, detail: "Nên xem nguyên nhân hủy theo chi nhánh.", icon: "warning" }
      : null,
    openBranches < totalBranches
      ? { tone: "neutral", title: `${totalBranches - openBranches} chi nhánh chưa mở`, detail: "Kiểm tra lịch hoạt động hoặc trạng thái ca.", icon: "store" }
      : null
  ].filter(Boolean).slice(0, 3);
  const todayText = toVietnamDateInputValue();
  const isCurrentPeriodOpen = dashboardRevenueSeries?.comparisonIsProvisional === true;
  const provisionalTime = new Date().toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit"
  });

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
    if (preset === "7d") {
      setDashboardDateFrom(addDaysToVietnamDateInput(todayText, -6));
      setDashboardDateTo(todayText);
    }
    if (preset === "30d") {
      setDashboardDateFrom(addDaysToVietnamDateInput(todayText, -29));
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
            <span className="admin-dashboard-greeting">Xin chào, Chủ cửa hàng!</span>
            <h1>Tổng quan Gánh Hàng Rong hôm nay</h1>
            <p>Nắm nhanh doanh thu, đơn hàng và tình hình vận hành toàn hệ thống.</p>
            <small>
              <i className={openBranches === totalBranches ? "is-open" : "is-partial"} />
              {openBranches}/{totalBranches} chi nhánh đang mở
              <b>·</b>
              {trustUpdatedLabel ? `Cập nhật ${trustUpdatedLabel}` : "Đang cập nhật"}
            </small>
          </div>
        </div>

        <div className="admin-dashboard-filter-cluster">
          <div
            className="admin-dashboard-branch-switcher"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsBranchMenuOpen(false);
            }}
          >
            <button
              type="button"
              className={`admin-dashboard-branch-select${isBranchMenuOpen ? " is-open" : ""}`}
              aria-haspopup="listbox"
              aria-expanded={isBranchMenuOpen}
              onClick={() => setIsBranchMenuOpen((current) => !current)}
            >
              <Icon name="store" size={16} />
              <span>{selectedBranchLabel}</span>
              <span className="admin-dashboard-select-chevron" aria-hidden="true" />
            </button>
            {isBranchMenuOpen ? (
              <div className="admin-dashboard-branch-menu" role="listbox" aria-label="Chọn chi nhánh xem báo cáo">
                <div className="admin-dashboard-branch-menu-head">
                  <Icon name="store" size={15} />
                  <span>Gánh Hàng Rong</span>
                  <small>{branchOptions.length} chi nhánh</small>
                </div>
                {[{ value: "all", label: "Tất cả chi nhánh" }, ...branchOptions.map((branch) => ({ value: branch.value, label: getBranchShortLabel(branch.label) }))].map((branch) => {
                  const isSelected = branch.value === "all" ? allBranchesSelected : allBranchesSelected || dashboardBranchFilters.includes(branch.value);
                  return (
                  <button
                    key={branch.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => {
                      toggleDashboardBranch(branch.value);
                    }}
                  >
                    <i className="admin-dashboard-branch-check" aria-hidden="true">{isSelected ? <Icon name="check" size={12} /> : null}</i>
                    <span>{branch.label}</span>
                    {branch.value === "all" && isSelected ? <Icon name="check" size={15} /> : null}
                  </button>
                  );
                })}
                <small className="admin-dashboard-branch-hint">Chọn ít nhất 1 chi nhánh · Có thể chọn nhiều</small>
              </div>
            ) : null}
          </div>

          <div
            className="admin-dashboard-period-controls"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsPeriodMenuOpen(false);
            }}
          >
            <button
              type="button"
              className={`admin-dashboard-period-trigger${isPeriodMenuOpen ? " is-open" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={isPeriodMenuOpen}
              onClick={() => setIsPeriodMenuOpen((current) => !current)}
            >
              <Icon name="calendar" size={16} />
              <span>
                <strong>{dashboardDatePreset === "today" ? "Hôm nay" : dashboardDatePreset === "yesterday" ? "Hôm qua" : dashboardDatePreset === "7d" ? "7 ngày" : dashboardDatePreset === "30d" ? "30 ngày" : dashboardDatePreset === "month" ? "Tháng này" : "Tùy chỉnh"}</strong>
                <small>{dashboardDateFrom === dashboardDateTo ? formatDashboardDateLabel(dashboardDateFrom) : `${formatDashboardDateLabel(dashboardDateFrom)} – ${formatDashboardDateLabel(dashboardDateTo)}`}</small>
              </span>
              <span className="admin-dashboard-select-chevron" aria-hidden="true" />
            </button>
            {isPeriodMenuOpen ? (
              <div className="admin-dashboard-period-menu" role="dialog" aria-label="Chọn khoảng thời gian báo cáo">
                <div className="admin-dashboard-period-presets">
                  {[
                    { value: "today", label: "Hôm nay" },
                    { value: "yesterday", label: "Hôm qua" },
                    { value: "7d", label: "7 ngày" },
                    { value: "30d", label: "30 ngày" },
                    { value: "month", label: "Tháng này" }
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={dashboardDatePreset === preset.value ? "is-selected" : ""}
                      onClick={() => applyPreset(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="admin-dashboard-period-month">
                  <span>Chọn tháng</span>
                  <input
                    type="month"
                    value={(dashboardDateFrom || todayText).slice(0, 7)}
                    max={todayText.slice(0, 7)}
                    onChange={(event) => {
                      const month = event.target.value;
                      if (!month) return;
                      const monthEnd = new Date(`${month}-01T12:00:00+07:00`);
                      monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
                      const endText = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
                      setDashboardDateFrom(`${month}-01`);
                      setDashboardDateTo(endText > todayText ? todayText : endText);
                      setDashboardDatePreset("custom");
                    }}
                  />
                </div>
                <div className="admin-dashboard-period-range">
                  <label>
                    <span>Từ ngày</span>
                    <AdminInput type="date" value={dashboardDateFrom || ""} max={dashboardDateTo || todayText} onChange={(event) => { setDashboardDateFrom(event.target.value); setDashboardDatePreset("custom"); }} />
                  </label>
                  <i aria-hidden="true">→</i>
                  <label>
                    <span>Đến ngày</span>
                    <AdminInput type="date" value={dashboardDateTo || ""} min={dashboardDateFrom || ""} max={todayText} onChange={(event) => { setDashboardDateTo(event.target.value); setDashboardDatePreset("custom"); }} />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
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

      <section className="admin-dashboard-traffic-card admin-dashboard-traffic-legacy" aria-label="Khách truy cập website">
        <div className="admin-dashboard-traffic-toolbar">
          {[{ value: "24h", label: "24 giờ qua" }, { value: "7d", label: "7 ngày qua" }, { value: "30d", label: "30 ngày qua" }].map((option) => (
            <button
              key={option.value}
              type="button"
              className={siteTrafficPreset === option.value ? "is-active" : ""}
              onClick={() => setSiteTrafficPreset?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {trafficPoints.length ? (
          <>
            <div className="admin-dashboard-traffic-summary">
              <div>
                <span>Khách truy cập</span>
                <strong>Tổng cộng: {displayedSiteVisitors}</strong>
              </div>
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
            </div>

            <div className="admin-dashboard-traffic-chart" onMouseLeave={() => setActiveTrafficPoint(null)}>
              <svg viewBox={`0 0 ${trafficChart.width} ${trafficChart.height}`} role="img" aria-label={`Biểu đồ khách truy cập ${siteTrafficPreset}`}>
                <defs>
                  <linearGradient id="adminTrafficArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {trafficChart.gridLines.map((line) => (
                  <g key={line.y}>
                    <line x1={trafficChart.padding.left} x2={trafficChart.width - trafficChart.padding.right} y1={line.y} y2={line.y} />
                    <text x="8" y={line.y + 4}>{formatNumber(line.value)}</text>
                  </g>
                ))}
                <path className="admin-dashboard-traffic-area" d={trafficChart.areaPath} />
                <path className="admin-dashboard-traffic-line" d={trafficChart.linePath} />
                {trafficChart.points.map((point, index) => (
                  <g key={`${point.bucketStart}-${index}`}>
                    <circle className="admin-dashboard-traffic-point" cx={point.x} cy={point.y} r="4" />
                    <circle
                      className="admin-dashboard-traffic-hit"
                      cx={point.x}
                      cy={point.y}
                      r="13"
                      tabIndex="0"
                      onMouseEnter={() => setActiveTrafficPoint(point)}
                      onFocus={() => setActiveTrafficPoint(point)}
                      onBlur={() => setActiveTrafficPoint(null)}
                    />
                  </g>
                ))}
                {trafficChart.points.filter((point) => point.showLabel).map((point) => (
                  <text key={`${point.bucketStart}-label`} className="admin-dashboard-traffic-axis-label" x={point.x} y={trafficChart.height - 12}>{point.label}</text>
                ))}
              </svg>
              {activeTrafficPoint ? (
                <div
                  className="admin-dashboard-traffic-tooltip"
                  style={{
                    left: `${(activeTrafficPoint.x / trafficChart.width) * 100}%`,
                    top: `${(activeTrafficPoint.y / trafficChart.height) * 100}%`
                  }}
                >
                  <span>{activeTrafficPoint.detailLabel}</span>
                  <strong>{formatNumber(activeTrafficPoint.uniqueVisitors)} khách</strong>
                  <small>{formatNumber(activeTrafficPoint.pageViews)} lượt xem</small>
                </div>
              ) : null}
            </div>
            <small className="admin-dashboard-traffic-trend">{trafficTrendLabel}</small>
          </>
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

      <div className="admin-dashboard-action-grid">
        <section className={`admin-dashboard-alert-center is-compact${operationalAlerts.length ? " has-alerts" : " is-clear"}`} aria-labelledby="dashboard-alert-title">
          <header>
            <div className="admin-dashboard-alert-summary">
              <i><Icon name={operationalAlerts.length ? "warning" : "check"} size={18} /></i>
              <div>
                <h2 id="dashboard-alert-title">{operationalAlerts.length ? `${operationalAlerts.length} cảnh báo cần chú ý` : "Vận hành đang ổn định"}</h2>
                <small>{operationalAlerts.length ? "Kiểm tra các vấn đề dưới đây để xử lý kịp thời." : "Chưa có vấn đề cần xử lý ngay."}</small>
              </div>
            </div>
            <button type="button" onClick={() => openAdminNav?.({ id: "orders-main", label: "Đơn hàng", section: "orders" })}>Xem đơn hàng</button>
          </header>
          {operationalAlerts.length ? (
            <div className="admin-dashboard-alert-list">
              {operationalAlerts.map((alert) => (
              <article key={alert.title} className={`is-${alert.tone}`}>
                <span><Icon name={alert.icon} size={17} /></span>
                <div><strong>{alert.title}</strong><small>{alert.detail}</small></div>
              </article>
              ))}
            </div>
          ) : null}
        </section>

      </div>

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
                <div className="admin-dashboard-revenue-heading">
                  <div>
                    <strong>{formatDashboardMoney(chartRevenueTotal)}</strong>
                    <span>{chartOrdersTotal} đơn · {formatDashboardMoney(chartAverageOrder)} / đơn</span>
                  </div>
                  <div className="admin-dashboard-revenue-metric-tabs" role="group" aria-label="Chọn chỉ số biểu đồ">
                    {[
                      { id: "revenue", label: "Doanh thu" },
                      { id: "orders", label: "Số đơn" },
                      { id: "averageOrder", label: "Đơn TB" }
                    ].map((metric) => (
                      <button
                        key={metric.id}
                        type="button"
                        className={revenueMetric === metric.id ? "is-active" : ""}
                        aria-pressed={revenueMetric === metric.id}
                        onClick={() => { setRevenueMetric(metric.id); setActiveRevenuePoint(null); }}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="admin-dashboard-revenue-insight">
                  <Icon name="star" size={17} />
                  <span><b>{revenueInsight}</b><small>{bestWeekdayInsight}</small></span>
                </div>
                <div className="admin-dashboard-revenue-bars" role="img" aria-label={`Biểu đồ ${revenueMetricConfig.label.toLowerCase()} theo ngày`} onMouseLeave={() => setActiveRevenuePoint(null)}>
                  <div className="admin-dashboard-revenue-scale"><span>{revenueMetricConfig.format(revenueMetricMax)}</span><span>{revenueMetricConfig.format(Math.round(revenueMetricMax / 2))}</span><span>0</span></div>
                  <div className="admin-dashboard-revenue-bar-grid">
                    {revenueSeries.map((point) => {
                      const height = Math.max(point[revenueMetric] ? 7 : 2, (Number(point[revenueMetric] || 0) / revenueMetricMax) * 100);
                      const isPeak = point.key === chartPeakDay?.key && revenueMetric === "revenue";
                      return (
                        <button
                          key={point.key}
                          type="button"
                          className={`${isPeak ? "is-peak " : ""}${activeRevenuePoint?.key === point.key ? "is-active" : ""}`.trim()}
                          onMouseEnter={() => setActiveRevenuePoint(point)}
                          onFocus={() => setActiveRevenuePoint(point)}
                          onBlur={() => setActiveRevenuePoint(null)}
                          aria-label={`${point.label}: ${revenueMetricConfig.format(point[revenueMetric])}`}
                        >
                          {isPeak ? <em>Cao nhất</em> : null}
                          <i style={{ height: `${height}%` }} />
                          <span><b>{point.weekday}</b><small>{point.label}</small></span>
                        </button>
                      );
                    })}
                  </div>
                  {activeRevenuePoint ? (
                    <div className="admin-dashboard-revenue-tooltip">
                      <strong>{activeRevenuePoint.label}</strong>
                      <span>{formatDashboardMoney(activeRevenuePoint.revenue)}</span>
                      <small>{activeRevenuePoint.orders} đơn · {formatDashboardMoney(activeRevenuePoint.averageOrder)} / đơn</small>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="admin-dashboard-mini-metrics">
                <span className={revenueDifference < 0 ? "is-negative" : "is-positive"}>
                  <small>Chênh lệch doanh thu</small>
                  <b>{revenueDifferencePercent === null ? "--" : `${revenueDifference >= 0 ? "+" : "−"}${formatDashboardMoney(Math.abs(revenueDifference))} · ${revenueDifferencePercent > 0 ? "+" : ""}${revenueDifferencePercent}%`}</b>
                </span>
                <span>
                  <small>Biến động số đơn</small>
                  <b>{orderDifferencePercent}</b>
                </span>
                <span>
                  <small>Biến động đơn trung bình</small>
                  <b>{averageDifferencePercent}</b>
                </span>
                <span className="is-provisional">
                  <small>Trạng thái dữ liệu</small>
                  <b>{isCurrentPeriodOpen ? `Tạm tính đến ${provisionalTime}` : "Đã đủ kỳ"}</b>
                </span>
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

      <section className="admin-dashboard-secondary-section" aria-labelledby="dashboard-secondary-title">
        <header className="admin-dashboard-secondary-heading">
          <div>
            <span>Thông tin tham khảo</span>
            <h2 id="dashboard-secondary-title">Hiệu quả website</h2>
            <p>Theo dõi mức độ quan tâm của khách; không dùng thay cho doanh thu và đơn hàng.</p>
          </div>
          <select value={siteTrafficPreset} onChange={(event) => setSiteTrafficPreset?.(event.target.value)} aria-label="Khoảng thời gian truy cập website">
            <option value="24h">24 giờ</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
          </select>
        </header>
        <div className="admin-dashboard-secondary-metrics">
          <article><span>Khách truy cập</span><strong>{displayedSiteVisitors}</strong></article>
          <article><span>Lượt xem trang</span><strong>{displayedSitePageViews}</strong></article>
          <article><span>Mỗi khách xem</span><strong>{trafficAverageViews ? `${trafficAverageViews} trang` : "0 trang"}</strong></article>
          <footer className={trafficDelta > 0 ? "is-up" : trafficDelta < 0 ? "is-down" : ""}>
            <Icon name={trafficDelta < 0 ? "warning" : "eye"} size={16} />
            <span>{trafficTrendLabel}</span>
          </footer>
        </div>
      </section>
    </div>
  );
}



