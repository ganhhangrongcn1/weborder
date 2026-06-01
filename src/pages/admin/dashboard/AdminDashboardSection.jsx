import { formatMoney } from "../../../utils/format.js";
import Icon from "../../../components/Icon.jsx";
import { resolveOrderSourceKey } from "../../../services/partnerOrderService.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../../services/branchIdentityService.js";
import { getSettlement } from "../orders/orderManager.utils.js";
import { addDaysToVietnamDateInput, toVietnamDateInputValue } from "../../../utils/adminDateRange.js";
import AdminBusinessAnalyticsSection from "./AdminBusinessAnalyticsSection.jsx";
import {
  AdminBadge,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminStatCard,
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTableRow
} from "../ui/index.js";

function getOrderStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending_zalo" || normalized === "new") return { label: "Đơn mới", tone: "warning" };
  if (normalized === "confirmed") return { label: "Đang làm", tone: "info" };
  if (normalized === "delivering") return { label: "Đang giao", tone: "info" };
  if (normalized === "done" || normalized === "completed") return { label: "Hoàn tất", tone: "success" };
  return { label: status || "Đang xử lý", tone: "neutral" };
}

function formatOrderTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function getOrderBranch(order) {
  return [order.deliveryBranchName, order.pickupBranchName, order.branchName, order.branch_name, order.nexposSiteName, order.nexposHubName]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "--";
}

function getOrderCustomerKey(order = {}) {
  return String(
    order.customerPhoneKey ||
    order.customerPhone ||
    order.phone ||
    order.orderCustomerPhone ||
    ""
  ).trim();
}

function getOrderChannel(order) {
  return resolveOrderSourceKey(order);
}

function getOrderSourceMeta(order) {
  const rawSource = getOrderChannel(order);
  const normalized = rawSource.toLowerCase();

  if (normalized.includes("grab")) return { label: "Grab", tone: "success", className: "is-grab" };
  if (normalized.includes("shopee")) return { label: "Shopee", tone: "warning", className: "is-shopee" };
  if (normalized.includes("xanh")) return { label: "Xanh Ngon", tone: "info", className: "is-xanh-ngon" };
  if (normalized.includes("website")) return { label: "Website", tone: "brand", className: "is-website" };
  if (normalized.includes("pickup") || normalized.includes("đến lấy") || normalized.includes("den lay")) {
    return { label: "Đến lấy", tone: "brand", className: "is-pickup" };
  }
  if (normalized.includes("ship") || normalized.includes("delivery") || normalized.includes("giao")) {
    return { label: "Ship", tone: "info", className: "is-ship" };
  }
  if (rawSource) return { label: rawSource, tone: "neutral", className: "is-other" };

  const fulfillmentType = String(order.fulfillmentType || "").toLowerCase();
  if (fulfillmentType === "pickup") return { label: "Đến lấy", tone: "brand", className: "is-pickup" };
  if (fulfillmentType === "delivery") return { label: "Ship", tone: "info", className: "is-ship" };

  return { label: "Chưa rõ", tone: "neutral", className: "is-unknown" };
}

function buildTopProducts(orders = []) {
  const map = new Map();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = String(item.id || item.name || "").trim();
      if (!key) return;
      const current = map.get(key) || { id: key, name: item.name || "Món", image: item.image || item.thumbnail || "", quantity: 0 };
      current.quantity += Number(item.quantity || 1);
      map.set(key, current);
    });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
}

function buildChannels(orders = []) {
  const map = new Map();
  orders.forEach((order) => {
    const channel = getOrderSourceMeta(order).label;
    if (!channel) return;
    map.set(channel, (map.get(channel) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function getChannelLabel(channel = "") {
  const normalized = String(channel || "").toLowerCase();
  if (normalized === "grabfood") return "Grab";
  if (normalized === "shopeefood") return "ShopeeFood";
  if (normalized === "xanhngon") return "Xanh Ngon";
  if (normalized === "qr_counter") return "QR";
  if (normalized === "website") return "Web";
  return channel || "Khác";
}

function buildRpcChannels(channels = []) {
  return channels.map((channel) => ({
    name: getChannelLabel(channel.channel),
    count: Number(channel.totalOrders || 0),
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

function getChannelColor(name = "") {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("grab")) return "#16a34a";
  if (normalized.includes("shopee")) return "#f97316";
  if (normalized.includes("xanh")) return "#0f766e";
  if (normalized.includes("website")) return "#2563eb";
  if (normalized.includes("qr")) return "#7c3aed";
  if (normalized.includes("lấy") || normalized.includes("pickup")) return "#d97706";
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

function formatChartDate(date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function buildRevenueSeries(orders = []) {
  const dayMap = new Map();
  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const key = toVietnamDateInputValue(createdAt);
    if (!dayMap.has(key)) {
      dayMap.set(key, { key, label: formatChartDate(createdAt), value: 0, date: new Date(createdAt) });
    }
    dayMap.get(key).value += getDashboardOrderRevenue(order);
  });

  return [...dayMap.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => ({ key: item.key, label: item.label, value: item.value }));
}

function getDashboardOrderRevenue(order = {}) {
  const partnerRevenue = Number(order.realReceived || order.netReceived || order.grossReceived || 0);
  if (String(order.sourceType || "").toLowerCase() === "partner" && partnerRevenue > 0) {
    return partnerRevenue;
  }
  const totalAmount = Number(order.totalAmount || order.total || 0);
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  return Math.max(totalAmount - shippingFee, 0);
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
  const points = safeSeries.map((item, index) => ({
    ...item,
    x: padding.left + index * step,
    y: padding.top + (1 - item.value / maxValue) * plotHeight
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

export default function AdminDashboardSection({
  dashboardSearch,
  setDashboardSearch,
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
  todayRevenue,
  totalCustomers,
  filteredRecentOrders,
  ordersSnapshot = [],
  chartOrdersSnapshot = [],
  dashboardChartPreset,
  setDashboardChartPreset,
  dashboardSummary,
  businessAnalytics,
  selectedBranchFilter = "all",
  branches = []
}) {
  const branchOptions = buildBranchFilterOptions(branches);
  const selectedBranchOption = branchOptions.find((branch) => {
    if (branch.value === selectedBranchFilter) return true;
    const rawBranch = (branches || []).find((item) => String(
      item?.branch_uuid ||
      item?.branchUuid ||
      item?.uuid ||
      item?.id ||
      ""
    ) === String(selectedBranchFilter));
    return rawBranch ? branch.label === rawBranch.name : false;
  }) || null;
  const branchScopedOrders = selectedBranchOption
    ? ordersSnapshot.filter((order) => branchOptionMatchesOrder(order, selectedBranchOption))
    : ordersSnapshot;
  const branchScopedChartOrders = selectedBranchOption
    ? chartOrdersSnapshot.filter((order) => branchOptionMatchesOrder(order, selectedBranchOption))
    : chartOrdersSnapshot;
  const branchScopedRecentOrders = selectedBranchOption
    ? filteredRecentOrders.filter((order) => branchOptionMatchesOrder(order, selectedBranchOption))
    : filteredRecentOrders;
  const branchScopedCustomers = new Set(branchScopedOrders.map((order) => getOrderCustomerKey(order)).filter(Boolean)).size;
  const branchScopedOrdersTotal = branchScopedOrders.length;
  const branchScopedOrdersNew = branchScopedOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "pending_zalo" || status === "pending" || status === "new";
  }).length;
  const branchScopedPreparingOrders = branchScopedOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "preparing";
  }).length;
  const branchScopedDeliveringOrders = branchScopedOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "delivering" || status === "shipping";
  }).length;
  const branchScopedCompletedOrders = branchScopedOrders.filter((order) => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const branchScopedCancelledOrders = branchScopedOrders.filter((order) => ["cancel", "cancelled", "canceled", "huy"].includes(String(order.status || "").toLowerCase())).length;
  const branchScopedRevenue = branchScopedOrders.reduce((sum, order) => sum + getDashboardOrderRevenue(order), 0);
  const rpcMetrics = dashboardSummary?.source === "rpc" && !selectedBranchOption ? dashboardSummary.current : null;
  const displayedOrdersTotal = rpcMetrics?.totalOrders ?? (selectedBranchOption ? branchScopedOrdersTotal : ordersTotal);
  const displayedOrdersNew = rpcMetrics?.pendingOrders ?? (selectedBranchOption ? branchScopedOrdersNew : ordersNew);
  const displayedRevenue = rpcMetrics?.netRevenue ?? (selectedBranchOption ? branchScopedRevenue : todayRevenue);
  const displayedCustomers = selectedBranchOption
    ? branchScopedCustomers
    : dashboardSummary?.source === "rpc"
      ? dashboardSummary.totalCustomers
      : totalCustomers;
  const topProducts = buildTopProducts(branchScopedOrders);
  const topProductMax = Math.max(...topProducts.map((item) => item.quantity), 1);
  const channels = dashboardSummary?.source === "rpc" && !selectedBranchOption
    ? buildRpcChannels(dashboardSummary.channels)
    : buildChannels(branchScopedOrders);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.count, 0);
  const channelSegments = buildDonutSegments(channels, channelTotal);
  const averageOrder = rpcMetrics?.averageOrderValue ?? (displayedOrdersTotal ? Math.round(displayedRevenue / displayedOrdersTotal) : 0);
  const completionCount = rpcMetrics?.completedOrders ?? branchScopedCompletedOrders;
  const completionRate = displayedOrdersTotal ? Math.round((completionCount / displayedOrdersTotal) * 100) : 0;
  const pendingOrders = rpcMetrics?.pendingOrders ?? displayedOrdersNew;
  const preparingOrders = rpcMetrics?.preparingOrders ?? (selectedBranchOption ? branchScopedPreparingOrders : ordersDoing);
  const deliveringOrders = rpcMetrics?.deliveringOrders ?? branchScopedDeliveringOrders;
  const cancelledOrders = rpcMetrics?.cancelledOrders ?? branchScopedCancelledOrders;
  const cancelRate = rpcMetrics
    ? Math.round(Number(rpcMetrics?.cancelRate || 0) * 100)
    : displayedOrdersTotal
      ? Math.round((cancelledOrders / displayedOrdersTotal) * 100)
      : 0;

  const chartOrdersTotal = branchScopedChartOrders.length;
  const chartRevenueTotal = branchScopedChartOrders.reduce((sum, order) => sum + getDashboardOrderRevenue(order), 0);
  const chartAverageOrder = chartOrdersTotal ? Math.round(chartRevenueTotal / chartOrdersTotal) : 0;
  const chartCompletionCount = branchScopedChartOrders.filter((order) => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const chartOrdersNew = branchScopedChartOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "pending_zalo" || status === "pending" || status === "new";
  }).length;
  const chartOrdersDoing = branchScopedChartOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "delivering";
  }).length;
  const revenueSeries = buildRevenueSeries(branchScopedChartOrders);
  const revenueChart = buildRevenueChart(revenueSeries);
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
      <section className="admin-dashboard-hero">
        <div>
          <AdminBadge tone="warning">Chi nhánh mở: {openBranches}/{totalBranches}</AdminBadge>
          <AdminBadge tone={dashboardSummary?.source === "rpc" && !selectedBranchOption ? "success" : "warning"}>
            {dashboardSummary?.source === "rpc" && !selectedBranchOption ? "Nguồn KPI: Supabase RPC" : "Nguồn KPI: feed theo chi nhánh"}
          </AdminBadge>
          {selectedBranchOption ? <AdminBadge tone="brand">Đang xem: {selectedBranchOption.label}</AdminBadge> : null}
          <h2>Chào mừng quay trở lại!</h2>
          <p>Tổng quan hoạt động kinh doanh và vận hành đơn hàng hôm nay.</p>
        </div>
      </section>

      <div className="admin-dashboard-toolbar">
        <label className="admin-dashboard-search">
          <span>⌕</span>
          <AdminInput
            value={dashboardSearch}
            onChange={(event) => setDashboardSearch(event.target.value)}
            placeholder="Tìm mã đơn, tên khách, số điện thoại..."
          />
        </label>
        <label className="admin-dashboard-search admin-dashboard-preset">
          <span>🗂</span>
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
            <label className="admin-dashboard-search">
              <span>📅</span>
              <AdminInput type="date" value={dashboardDateFrom || ""} max={dashboardDateTo || todayText} onChange={(event) => { setDashboardDateFrom(event.target.value); setDashboardDatePreset("custom"); }} placeholder="Từ ngày" />
            </label>
            <label className="admin-dashboard-search">
              <span>📅</span>
              <AdminInput type="date" value={dashboardDateTo || ""} min={dashboardDateFrom || ""} max={todayText} onChange={(event) => { setDashboardDateTo(event.target.value); setDashboardDatePreset("custom"); }} placeholder="Đến ngày" />
            </label>
          </>
        ) : null}
      </div>

      <div className="admin-dashboard-stat-grid">
        <AdminStatCard title="Doanh thu thực nhận" value={formatMoney(displayedRevenue)} subtitle="Web: trừ ship · FoodApp: ưu tiên số đối soát" icon={<Icon name="tag" size={22} />} tone="green" />
        <AdminStatCard title="Tổng đơn" value={displayedOrdersTotal} subtitle={`${displayedOrdersNew} đơn mới`} icon={<Icon name="bag" size={22} />} tone="brand" />
        <AdminStatCard title="Khách hàng" value={displayedCustomers ?? "--"} subtitle={selectedBranchOption ? "Khách có đơn trong chi nhánh đã chọn" : "Tổng hồ sơ lifetime từ Supabase"} icon={<Icon name="user" size={22} />} tone="blue" />
        <AdminStatCard title="Đơn trung bình" value={formatMoney(averageOrder)} subtitle={`${completionRate}% hoàn tất`} icon={<Icon name="star" size={22} />} tone="amber" />
      </div>

      <div className="admin-dashboard-stat-grid">
        <AdminStatCard title="Đơn mới chờ xử lý" value={pendingOrders} subtitle="Cần xác nhận sớm" icon={<Icon name="star" size={22} />} tone="amber" />
        <AdminStatCard title="Đang làm" value={preparingOrders} subtitle="Bếp đang xử lý" icon={<Icon name="bag" size={22} />} tone="brand" />
        <AdminStatCard title="Đang giao" value={deliveringOrders} subtitle="Đang trên đường giao khách" icon={<Icon name="user" size={22} />} tone="blue" />
        <AdminStatCard title="Đơn hủy" value={cancelledOrders} subtitle={`${cancelRate}% tổng đơn`} icon={<Icon name="tag" size={22} />} tone="red" />
      </div>

      <div className="admin-dashboard-main-grid">
        <AdminPanel
          title="Doanh thu thực nhận"
          description="Web: tổng thanh toán trừ phí ship. FoodApp: ưu tiên số thực nhận từ dữ liệu đối soát; nếu thiếu sẽ dùng số doanh thu gần nhất có sẵn."
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
          <div className="admin-dashboard-revenue-visual">
            <strong>{formatMoney(chartRevenueTotal)}</strong>
            <span>{chartOrdersTotal} đơn · {formatMoney(chartAverageOrder)} / đơn</span>
            <div className="admin-dashboard-revenue-chart">
              <svg viewBox={`0 0 ${revenueChart.width} ${revenueChart.height}`} role="img" aria-label="Revenue chart">
                <defs>
                  <linearGradient id="adminRevenueArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {revenueChart.gridLines.map((line) => (
                  <g key={line.y}>
                    <line x1={revenueChart.padding.left} x2={revenueChart.width - revenueChart.padding.right} y1={line.y} y2={line.y} />
                    <text x="10" y={line.y + 4}>{formatMoney(line.value)}</text>
                  </g>
                ))}
                <path className="admin-dashboard-revenue-area" d={revenueChart.areaPath} />
                <path className="admin-dashboard-revenue-line" d={revenueChart.linePath} />
                {revenueChart.points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="5" />)}
                {revenueChart.points.map((point) => (
                  <text key={`${point.key}-label`} className="admin-dashboard-revenue-date" x={point.x} y={revenueChart.height - 10}>{point.label}</text>
                ))}
              </svg>
            </div>
          </div>
          <div className="admin-dashboard-mini-metrics">
            <span><b>{chartOrdersNew}</b> đơn mới</span>
            <span><b>{chartOrdersDoing}</b> đang xử lý</span>
            <span><b>{chartCompletionCount}</b> hoàn tất</span>
            {dashboardSummary?.source === "rpc" && !selectedBranchOption ? (
              <>
                <span><b>{formatComparison(dashboardSummary.current.netRevenue, dashboardSummary.previous.netRevenue)}</b> so với kỳ trước</span>
                <span><b>{formatComparison(dashboardSummary.current.netRevenue, dashboardSummary.week.netRevenue)}</b> so với cùng kỳ tuần trước</span>
                <span><b>{formatComparison(dashboardSummary.current.totalOrders, dashboardSummary.previous.totalOrders)}</b> số đơn so với kỳ trước</span>
                <span><b>{formatComparison(dashboardSummary.current.totalOrders, dashboardSummary.week.totalOrders)}</b> số đơn so với cùng kỳ tuần trước</span>
              </>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Đơn hàng theo kênh" description="Chỉ hiển thị khi đơn có dữ liệu kênh/source." className="admin-dashboard-channel-card">
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
                    <span>{channel.count} đơn · {percent}%{channel.revenue !== undefined ? ` · ${formatMoney(channel.revenue)}` : ""}</span>
                  </div>
                );
              })}
              </div>
            </div>
          ) : <div className="admin-dashboard-empty-note">Chưa có dữ liệu kênh bán hàng trong đơn.</div>}
        </AdminPanel>

        <AdminPanel title="Top món bán chạy" description="Tính từ món trong các đơn hiện có." className="admin-dashboard-top-products">
          {topProducts.length ? (
            <div className="admin-dashboard-product-list">
              {topProducts.map((item, index) => (
                <article key={item.id} className="admin-dashboard-product-row">
                  <span>{item.image ? <img src={item.image} alt="" /> : index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <em><i style={{ width: `${Math.max(8, (item.quantity / topProductMax) * 100)}%` }} /></em>
                  </div>
                  <small>{item.quantity}</small>
                </article>
              ))}
            </div>
          ) : <div className="admin-dashboard-empty-note">Chưa có món nào trong đơn hàng.</div>}
        </AdminPanel>
      </div>

      <div className="admin-dashboard-bottom-grid">
        <AdminPanel
          title="Đơn hàng gần đây"
          description="Danh sách compact theo bộ lọc tìm kiếm hiện tại."
          action={<AdminBadge tone="neutral">{branchScopedRecentOrders.length} đơn</AdminBadge>}
          className="admin-dashboard-recent-card"
        >
          {branchScopedRecentOrders.length ? (
            <AdminTable className="admin-dashboard-table">
              <AdminTableHead>
                <span>Mã đơn</span><span>Nguồn</span><span>Khách</span><span>Giờ</span><span>Chi nhánh</span><span>Doanh thu thực nhận</span><span>Trạng thái</span>
              </AdminTableHead>
              <AdminTableBody>
                {branchScopedRecentOrders.map((order) => {
                  const status = getOrderStatusMeta(order.status);
                  const source = getOrderSourceMeta(order);
                  const netRevenue = getDashboardOrderRevenue(order) || Number(getSettlement(order)?.netRevenue || 0);
                  return (
                    <AdminTableRow key={order.id || order.orderCode}>
                      <span className="admin-dashboard-order-code"><strong>{order.displayOrderCode || order.orderCode || order.id}</strong></span>
                      <AdminBadge tone={source.tone} className={`admin-dashboard-source-badge ${source.className}`}>{source.label}</AdminBadge>
                      <span>{order.orderCustomerName || order.customerName || order.phone || "Khách lẻ"}</span>
                      <span>{formatOrderTime(order.createdAt)}</span>
                      <span>{getOrderBranch(order)}</span>
                      <strong>{formatMoney(netRevenue)}</strong>
                      <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>
          ) : (
            <div className="admin-order-empty"><strong>Không tìm thấy đơn phù hợp.</strong></div>
          )}
        </AdminPanel>
      </div>

      <AdminBusinessAnalyticsSection analytics={businessAnalytics} />
    </div>
  );
}



