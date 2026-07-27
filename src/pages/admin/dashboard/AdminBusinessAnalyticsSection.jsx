import { formatMoney } from "../../../utils/format.js";
import { AdminPanel } from "../ui/index.js";

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

  const averageRevenue = rows.reduce((sum, item) => sum + Number(item.netRevenue || 0), 0) / rows.length;

  return (
    <div className="admin-business-branches">
      {rows.map((item, index) => {
        const difference = averageRevenue
          ? Math.round(((Number(item.netRevenue || 0) - averageRevenue) / averageRevenue) * 100)
          : 0;
        return (
        <article key={item.branchName}>
          <span className={`admin-business-branch-rank is-rank-${index + 1}`}>#{index + 1}</span>
          <div>
            <strong>{item.branchName}</strong>
            <small>
              {item.totalOrders} đơn · Đơn TB {formatMoney(item.averageOrderValue)} ·
              <b className={difference >= 0 ? "is-positive" : "is-negative"}>
                {difference > 0 ? " +" : " "}{difference}% so với TB
              </b>
            </small>
          </div>
          <b>{formatMoney(item.netRevenue)}</b>
        </article>
        );
      })}
    </div>
  );
}

export function AdminSettlementSummary({
  analytics,
  status = "idle",
  fallbackNetRevenue = null,
  children = null
}) {
  if (!analytics) {
    const hasFallbackRevenue = Number.isFinite(Number(fallbackNetRevenue));
    return (
      <div className="admin-settlement-summary is-loading">
        <div className="admin-settlement-overview">
          <header>
            <span>Thực thu cuối ngày</span>
            <strong>{hasFallbackRevenue ? formatMoney(Math.round(Number(fallbackNetRevenue))) : "--"}</strong>
            <small>
              {hasFallbackRevenue
                ? "Tổng thực thu trong kỳ đã chọn"
                : status === "error"
                  ? "Dữ liệu thực thu đang tạm gián đoạn"
                  : "Đang tổng hợp từ các kênh bán..."}
            </small>
          </header>
          {children}
        </div>
      </div>
    );
  }

  const finance = analytics.finance || {};
  const partner = analytics.channels?.find((item) => item.group === "partner") || {};
  const owned = analytics.channels?.find((item) => item.group === "owned") || {};
  const totalNetRevenue = Number(finance.netRevenue || 0);
  const partnerShare = totalNetRevenue
    ? Math.round((Number(partner.netRevenue || 0) / totalNetRevenue) * 100)
    : 0;
  const ownedShare = Math.max(0, 100 - partnerShare);

  return (
    <div className="admin-settlement-summary">
      <div className="admin-settlement-overview">
        <header>
          <span>Thực thu cuối ngày</span>
          <strong>{formatMoney(finance.netRevenue)}</strong>
          <small>Tiền thực nhận sau khuyến mãi và phí app</small>
        </header>
        {children}
      </div>
      <div className="admin-settlement-sources">
        <article className="is-partner">
          <span>App đối tác</span>
          <strong>{formatMoney(partner.netRevenue)}</strong>
          <small>{partnerShare}% tổng thực thu</small>
        </article>
        <article className="is-owned">
          <span>Kênh của quán · POS + Website + QR</span>
          <strong>{formatMoney(owned.netRevenue)}</strong>
          <small>{ownedShare}% tổng thực thu</small>
        </article>
      </div>
      <div className="admin-settlement-share" aria-label={`App đối tác ${partnerShare}%, kênh quán ${ownedShare}%`}>
        <i style={{ width: `${partnerShare}%` }} />
      </div>
      <div className="admin-settlement-share-labels">
        <span>App đối tác {partnerShare}%</span>
        <span>{ownedShare}% Kênh quán</span>
      </div>
      <details className="admin-settlement-details">
        <summary>Xem chi tiết khấu trừ</summary>
        <div>
          <article>
            <h3>App đối tác</h3>
            <p><span>Doanh số</span><b>{formatMoney(partner.grossRevenue)}</b></p>
            <p><span>− Khuyến mãi</span><b>{formatMoney(partner.promotionAmount)}</b></p>
            <p><span>− Phí và chiết khấu app</span><b>{formatMoney(partner.platformFee)}</b></p>
            <footer><span>= Thực nhận</span><strong>{formatMoney(partner.netRevenue)}</strong></footer>
          </article>
          <article>
            <h3>Kênh của quán</h3>
            <p><span>Doanh số</span><b>{formatMoney(owned.grossRevenue)}</b></p>
            <p><span>− Khuyến mãi</span><b>{formatMoney(owned.promotionAmount)}</b></p>
            <p><span>− Phí nền tảng</span><b>0đ</b></p>
            <footer><span>= Thực thu</span><strong>{formatMoney(owned.netRevenue)}</strong></footer>
          </article>
        </div>
      </details>
    </div>
  );
}

export default function AdminBusinessAnalyticsSection({ analytics, status = "idle" }) {
  if (!analytics) {
    if (status === "error") return null;
    const isError = status === "error";
    return (
      <AdminPanel
        title="Hiệu quả kinh doanh"
        description="Phân tích món bán, khung giờ và hiệu quả từng chi nhánh."
        className="admin-business-deploy-note"
      >
        <div className="admin-dashboard-empty-note">
          {isError
            ? "Báo cáo chi tiết đang tạm gián đoạn."
            : "Đang tải báo cáo hiệu quả kinh doanh..."}
        </div>
      </AdminPanel>
    );
  }

  return (
    <section className="admin-business-section">
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
