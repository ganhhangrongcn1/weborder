import { formatMoney } from "../../../utils/format.js";
import { AdminBadge, AdminPanel, AdminStatCard } from "../ui/index.js";

function ProductList({ rows = [], valueKey = "quantity", emptyText }) {
  const maxValue = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);

  if (!rows.length) {
    return <div className="admin-dashboard-empty-note">{emptyText}</div>;
  }

  return (
    <div className="admin-business-list">
      {rows.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        return (
          <article key={`${item.name}-${index}`} className="admin-business-row">
            <span>{index + 1}</span>
            <div>
              <strong>{item.name}</strong>
              <em><i style={{ width: `${Math.max(6, (value / maxValue) * 100)}%` }} /></em>
            </div>
            <small>{valueKey === "revenue" ? formatMoney(value) : `${value} món`}</small>
          </article>
        );
      })}
    </div>
  );
}

function HourlyRevenue({ rows = [] }) {
  const maxRevenue = Math.max(...rows.map((item) => Number(item.netRevenue || 0)), 1);

  if (!rows.length) {
    return <div className="admin-dashboard-empty-note">Chưa có doanh thu theo khung giờ trong kỳ đã chọn.</div>;
  }

  return (
    <div className="admin-business-hourly">
      {rows.map((item) => (
        <article key={item.hour}>
          <b>{String(item.hour).padStart(2, "0")}:00</b>
          <em><i style={{ width: `${Math.max(4, (item.netRevenue / maxRevenue) * 100)}%` }} /></em>
          <span>{formatMoney(item.netRevenue)} · {item.totalOrders} đơn</span>
        </article>
      ))}
    </div>
  );
}

function BranchList({ rows = [] }) {
  if (!rows.length) {
    return <div className="admin-dashboard-empty-note">Chưa có dữ liệu hiệu suất chi nhánh trong kỳ đã chọn.</div>;
  }

  return (
    <div className="admin-business-branches">
      {rows.map((item) => (
        <article key={item.branchName}>
          <div>
            <strong>{item.branchName}</strong>
            <small>{item.totalOrders} đơn · Trung bình {formatMoney(item.averageOrderValue)}</small>
          </div>
          <b>{formatMoney(item.netRevenue)}</b>
        </article>
      ))}
    </div>
  );
}

export default function AdminBusinessAnalyticsSection({ analytics, status = "idle" }) {
  if (!analytics) {
    const isError = status === "error";
    return (
      <AdminPanel
        title="Hiệu quả kinh doanh"
        description="Báo cáo món bán, khung giờ và chi nhánh lấy trực tiếp từ Supabase."
        className="admin-business-deploy-note"
      >
        <div className="admin-dashboard-empty-note">
          {isError
            ? "Không thể tải báo cáo hiệu quả kinh doanh từ Supabase."
            : "Đang tải báo cáo hiệu quả kinh doanh..."}
        </div>
      </AdminPanel>
    );
  }

  const finance = analytics.finance || {};

  return (
    <section className="admin-business-section">
      <div className="admin-business-heading">
        <div>
          <AdminBadge tone="success">Nguồn phân tích: Supabase RPC</AdminBadge>
          <h2>Hiệu quả kinh doanh</h2>
          <p>Nhìn nhanh món bán, khung giờ, chi nhánh và phần chênh lệch doanh thu trong kỳ đã chọn.</p>
        </div>
      </div>

      <div className="admin-dashboard-stat-grid">
        <AdminStatCard title="Doanh thu gộp" value={formatMoney(finance.grossRevenue)} subtitle="Tổng trước phần chênh lệch thực nhận" tone="brand" />
        <AdminStatCard title="Doanh thu thực nhận" value={formatMoney(finance.netRevenue)} subtitle="Ưu tiên số đối soát FoodApp" tone="green" />
        <AdminStatCard title="Chiết khấu & voucher" value={formatMoney(finance.discountAmount)} subtitle={`Voucher ghi nhận: ${formatMoney(finance.voucherAmount)}`} tone="amber" />
        <AdminStatCard title="Phí nền tảng" value={formatMoney(finance.platformFee)} subtitle={`Chênh lệch gộp / thực nhận: ${formatMoney(finance.revenueGap)}`} tone="blue" />
      </div>

      <div className="admin-business-grid">
        <AdminPanel title="Top món bán chạy" description="Xếp theo số lượng món trong kỳ đã chọn.">
          <ProductList rows={analytics.topByQuantity} emptyText="Chưa có dữ liệu món bán trong kỳ đã chọn." />
        </AdminPanel>

        <AdminPanel title="Top món theo doanh thu" description="Xếp theo doanh thu dòng món, chưa phân bổ phí nền tảng.">
          <ProductList rows={analytics.topByRevenue} valueKey="revenue" emptyText="Chưa có dữ liệu doanh thu theo món." />
        </AdminPanel>

        <AdminPanel title="Món bán chậm 30 ngày" description="Các món đã phát sinh nhưng có số lượng bán thấp nhất trong 30 ngày gần nhất.">
          <ProductList rows={analytics.slowProducts} emptyText="Chưa có dữ liệu món bán trong 30 ngày." />
        </AdminPanel>

        <AdminPanel title="Doanh thu theo khung giờ" description="Doanh thu thực nhận theo múi giờ Việt Nam.">
          <HourlyRevenue rows={analytics.hourlyRevenue} />
        </AdminPanel>

        <AdminPanel title="Hiệu suất chi nhánh" description="So sánh doanh thu thực nhận và giá trị đơn trung bình." className="admin-business-branch-card">
          <BranchList rows={analytics.branches} />
        </AdminPanel>
      </div>
    </section>
  );
}
