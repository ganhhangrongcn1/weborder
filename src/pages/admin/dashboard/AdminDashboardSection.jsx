import { formatMoney } from "../../../utils/format.js";
import Icon from "../../../components/Icon.jsx";
import { getSettlement } from "../orders/orderManager.utils.js";
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
  return [order.deliveryBranchName, order.pickupBranchName, order.branchName]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "--";
}

function getOrderChannel(order) {
  return String(order.source || order.channel || order.platform || "").trim();
}

function getOrderSourceMeta(order) {
  const rawSource = getOrderChannel(order);
  const normalized = rawSource.toLowerCase();

  if (normalized.includes("grab")) return { label: "Grab", tone: "success", className: "is-grab" };
  if (normalized.includes("shopee")) return { label: "Shopee", tone: "warning", className: "is-shopee" };
  if (normalized.includes("xanh")) return { label: "Xanh Ngon", tone: "info", className: "is-xanh-ngon" };
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
    const channel = String(order.source || order.channel || order.platform || "").trim();
    if (!channel) return;
    map.set(channel, (map.get(channel) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatChartDate(date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function buildRevenueSeries(orders = []) {
  const dayMap = new Map();
  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const key = getDateKey(createdAt);
    if (!dayMap.has(key)) {
      dayMap.set(key, { key, label: formatChartDate(createdAt), value: 0, date: new Date(createdAt) });
    }
    const totalAmount = Number(order.totalAmount || order.total || 0);
    const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
    dayMap.get(key).value += Math.max(totalAmount - shippingFee, 0);
  });

  return [...dayMap.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => ({ key: item.key, label: item.label, value: item.value }));
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
  setDashboardChartPreset
}) {
  const topProducts = buildTopProducts(ordersSnapshot);
  const topProductMax = Math.max(...topProducts.map((item) => item.quantity), 1);
  const channels = buildChannels(ordersSnapshot);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.count, 0);
  const averageOrder = ordersTotal ? Math.round(todayRevenue / ordersTotal) : 0;
  const completionCount = ordersSnapshot.filter((order) => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const completionRate = ordersTotal ? Math.round((completionCount / ordersTotal) * 100) : 0;

  const chartOrdersTotal = chartOrdersSnapshot.length;
  const chartRevenueTotal = chartOrdersSnapshot.reduce((sum, order) => {
    const totalAmount = Number(order.totalAmount || order.total || 0);
    const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
    return sum + Math.max(totalAmount - shippingFee, 0);
  }, 0);
  const chartAverageOrder = chartOrdersTotal ? Math.round(chartRevenueTotal / chartOrdersTotal) : 0;
  const chartCompletionCount = chartOrdersSnapshot.filter((order) => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const chartOrdersNew = chartOrdersSnapshot.filter((order) => String(order.status || "").toLowerCase() === "pending_zalo").length;
  const chartOrdersDoing = chartOrdersSnapshot.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "delivering";
  }).length;
  const revenueSeries = buildRevenueSeries(chartOrdersSnapshot);
  const revenueChart = buildRevenueChart(revenueSeries);
  const todayText = new Date().toISOString().slice(0, 10);

  const applyPreset = (preset) => {
    const now = new Date();
    const toDateText = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    if (preset === "today") {
      const today = toDateText(now);
      setDashboardDateFrom(today);
      setDashboardDateTo(today);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const text = toDateText(yesterday);
      setDashboardDateFrom(text);
      setDashboardDateTo(text);
    }
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      setDashboardDateFrom(toDateText(monday));
      setDashboardDateTo(toDateText(now));
    }
    if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDashboardDateFrom(toDateText(firstDay));
      setDashboardDateTo(toDateText(now));
    }
    setDashboardDatePreset(preset);
  };

  return (
    <div className="admin-dashboard-page">
      <section className="admin-dashboard-hero">
        <div>
          <AdminBadge tone="warning">Chi nhánh mở: {openBranches}/{totalBranches}</AdminBadge>
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
        <AdminStatCard title="Doanh thu thực nhận" value={formatMoney(todayRevenue)} subtitle="Đã loại phí ship" icon={<Icon name="tag" size={22} />} tone="green" />
        <AdminStatCard title="Tổng đơn" value={ordersTotal} subtitle={`${ordersNew} đơn mới`} icon={<Icon name="bag" size={22} />} tone="brand" />
        <AdminStatCard title="Khách hàng" value={totalCustomers} subtitle="Từ CRM hiện có" icon={<Icon name="user" size={22} />} tone="blue" />
        <AdminStatCard title="Đơn trung bình" value={formatMoney(averageOrder)} subtitle={`${completionRate}% hoàn tất`} icon={<Icon name="star" size={22} />} tone="amber" />
      </div>

      <div className="admin-dashboard-main-grid">
        <AdminPanel
          title="Doanh thu thực nhận"
          description="Tổng tiền món đã thu, không tính phí ship."
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
          </div>
        </AdminPanel>

        <AdminPanel title="Đơn hàng theo kênh" description="Chỉ hiển thị khi đơn có dữ liệu kênh/source." className="admin-dashboard-channel-card">
          {channels.length ? (
            <div className="admin-dashboard-channel-list">
              {channels.map((channel) => {
                const percent = channelTotal ? Math.round((channel.count / channelTotal) * 100) : 0;
                return (
                  <div key={channel.name} className="admin-dashboard-channel-row">
                    <div>
                      <strong>{channel.name}</strong>
                      <span>{channel.count} đơn · {percent}%</span>
                    </div>
                    <em><i style={{ width: `${percent}%` }} /></em>
                  </div>
                );
              })}
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
          action={<AdminBadge tone="neutral">{filteredRecentOrders.length} đơn</AdminBadge>}
          className="admin-dashboard-recent-card"
        >
          {filteredRecentOrders.length ? (
            <AdminTable className="admin-dashboard-table">
              <AdminTableHead>
                <span>Mã đơn</span><span>Nguồn</span><span>Khách</span><span>Giờ</span><span>Chi nhánh</span><span>Doanh thu thực nhận</span><span>Trạng thái</span>
              </AdminTableHead>
              <AdminTableBody>
                {filteredRecentOrders.map((order) => {
                  const status = getOrderStatusMeta(order.status);
                  const source = getOrderSourceMeta(order);
                  const settlement = getSettlement(order);
                  return (
                    <AdminTableRow key={order.id || order.orderCode}>
                      <span className="admin-dashboard-order-code"><strong>{order.orderCode || order.id}</strong></span>
                      <AdminBadge tone={source.tone} className={`admin-dashboard-source-badge ${source.className}`}>{source.label}</AdminBadge>
                      <span>{order.orderCustomerName || order.customerName || order.phone || "Khách lẻ"}</span>
                      <span>{formatOrderTime(order.createdAt)}</span>
                      <span>{getOrderBranch(order)}</span>
                      <strong>{formatMoney(Number(settlement?.netRevenue || 0))}</strong>
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
    </div>
  );
}



