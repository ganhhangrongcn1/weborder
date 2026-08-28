import { Link } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import { getInventoryRoute } from "./inventoryNavigation.js";

const ACTION_TONES = {
  expired: "danger",
  out_of_stock: "danger",
  expiring: "warning",
  reorder: "warning",
  pending_document: "info"
};

const ACTION_ICONS = {
  expired: "warning",
  out_of_stock: "warning",
  expiring: "clock",
  reorder: "bell",
  pending_document: "folder"
};

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMoney(value) {
  return `${formatNumber(value)} đ`;
}

function formatDate(value = "") {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function getActionHref(action = {}) {
  const isExpiryAction = action.kind === "expired" || action.kind === "expiring";
  const route = getInventoryRoute(isExpiryAction ? "lots" : action.routePage || "reports");
  const params = new URLSearchParams();
  if (action.documentNo && action.kind === "pending_document") params.set("q", action.documentNo);
  if (action.warehouseId) params.set("warehouse", action.warehouseId);
  if (action.itemId) params.set("item", action.itemId);
  if (action.stockState && action.stockState !== "all") params.set("stock", action.stockState);
  if (isExpiryAction) params.set("expiry", action.kind);
  if (action.lotNumber) params.set("lot", action.lotNumber);
  const query = params.toString();
  return `${route.path}${query ? `?${query}` : ""}`;
}

function KpiCard({ icon, label, value, note, tone = "default", href = "" }) {
  const content = (
    <>
      <span className="inventory-dashboard-kpi__icon"><Icon name={icon} size={20} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
      <Icon name="back" size={15} className="inventory-dashboard-kpi__arrow" />
    </>
  );
  return href.startsWith("#")
    ? <a className={`inventory-dashboard-kpi is-${tone}`} href={href}>{content}</a>
    : <Link className={`inventory-dashboard-kpi is-${tone}`} to={href}>{content}</Link>;
}

export default function InventoryDashboard({ data = {}, warehouseScoped = false }) {
  const kpis = data.kpis || {};
  const activity = data.activity7d || {};
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const warehouses = Array.isArray(data.warehouses) ? data.warehouses : [];
  const expiryCount = Number(kpis.expiredCount || 0) + Number(kpis.expiringCount || 0);

  return (
    <div className="inventory-dashboard">
      <section className="inventory-dashboard-kpis" aria-label="Chỉ số kho quan trọng">
        <KpiCard icon="wallet" label="Giá trị tồn hiện tại" value={formatMoney(kpis.inventoryValue)} note="Theo giá vốn bình quân" href={getInventoryRoute("reports").path} />
        <KpiCard icon="warning" label="Nguyên vật liệu hết" value={formatNumber(kpis.outOfStockCount)} note="Cần xử lý ngay" tone="danger" href={`${getInventoryRoute("reports").path}?stock=out`} />
        <KpiCard icon="bell" label="Cần đặt hàng" value={formatNumber(kpis.reorderCount)} note="Đã chạm điểm đặt hàng" tone="warning" href={`${getInventoryRoute("reports").path}?stock=low`} />
        <KpiCard icon="clock" label="Lô sắp / đã hết hạn" value={formatNumber(expiryCount)} note={`${formatNumber(kpis.expiredCount)} lô đã hết hạn`} tone={Number(kpis.expiredCount) > 0 ? "danger" : "warning"} href={`${getInventoryRoute("lots").path}?expiry=alert`} />
        <KpiCard icon="folder" label="Phiếu đang chờ" value={formatNumber(kpis.pendingCount)} note="Duyệt, giao, nhận hoặc đối chiếu" tone="info" href="#inventory-dashboard-actions" />
      </section>

      <div className="inventory-dashboard-main">
        <section id="inventory-dashboard-actions" className="inventory-dashboard-panel inventory-dashboard-actions">
          <header>
            <div><span><Icon name="bell" size={19} /></span><div><strong>Cần xử lý hôm nay</strong><small>Hiển thị tối đa 20 việc ưu tiên; tổng cảnh báo xem tại các thẻ phía trên.</small></div></div>
            <span className="inventory-dashboard-count">{actions.length} việc ưu tiên</span>
          </header>
          <div className="inventory-dashboard-actions__list">
            {actions.map((action, index) => {
              const tone = ACTION_TONES[action.kind] || "info";
              return (
                <Link key={`${action.kind}-${action.documentId || action.itemId || index}-${action.lotNumber || ""}`} className={`inventory-dashboard-action is-${tone}`} to={getActionHref(action)}>
                  <span className="inventory-dashboard-action__icon"><Icon name={ACTION_ICONS[action.kind] || "bell"} size={17} /></span>
                  <div>
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                    {action.expiresOn ? <small>Hạn dùng: {formatDate(action.expiresOn)}</small> : null}
                  </div>
                  <span className="inventory-dashboard-action__go">Mở <Icon name="back" size={13} /></span>
                </Link>
              );
            })}
            {!actions.length ? (
              <div className="inventory-dashboard-empty">
                <span><Icon name="check" size={22} /></span>
                <div><strong>Chưa có việc tồn đọng</strong><small>Không có cảnh báo tồn, hạn sử dụng hoặc chứng từ cần xử lý trong phạm vi của tài khoản.</small></div>
              </div>
            ) : null}
          </div>
        </section>

        {!warehouseScoped ? <section className="inventory-dashboard-panel inventory-dashboard-activity">
          <header><div><span><Icon name="refresh" size={19} /></span><div><strong>Hoạt động 7 ngày</strong><small>Chỉ giữ các chỉ số giúp kiểm soát dòng hàng.</small></div></div></header>
          <div className="inventory-dashboard-activity__grid">
            <div><span>Giá trị nhập</span><strong>{formatMoney(activity.receiptValue)}</strong></div>
            <div><span>Xuất & hủy</span><strong>{formatMoney(activity.issueValue)}</strong></div>
            <div><span>Lệch sau kiểm kê</span><strong>{formatMoney(activity.countVarianceValue)}</strong></div>
            <div><span>Chuyển kho chưa xong</span><strong>{formatNumber(activity.incompleteTransfers)}</strong></div>
          </div>
        </section> : <section className="inventory-dashboard-panel inventory-dashboard-activity"><header><div><span><Icon name="store" size={19} /></span><div><strong>Đang xem riêng một kho</strong><small>Chỉ số tồn và danh sách cần xử lý đã lọc theo kho đang chọn. Muốn xem hoạt động 7 ngày toàn hệ thống, hãy chọn “Tất cả kho được phép”.</small></div></div></header></section>}
      </div>

      <section className="inventory-dashboard-panel inventory-dashboard-warehouses">
        <header><div><span><Icon name="store" size={19} /></span><div><strong>Tổng hợp theo kho</strong><small>Admin xem toàn hệ thống; tài khoản chi nhánh chỉ thấy kho được phân quyền.</small></div></div></header>
        <div className="inventory-table-scroll">
          <table className="inventory-data-table inventory-dashboard-warehouse-table">
            <thead><tr><th>Kho</th><th className="is-number">Giá trị tồn</th><th className="is-number">Hết hàng</th><th className="is-number">Cần đặt</th><th className="is-number">Sắp / hết hạn</th><th className="is-number">Phiếu chờ</th><th></th></tr></thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td><strong>{warehouse.name}</strong><small>{warehouse.code}</small></td>
                  <td className="is-number"><strong>{formatMoney(warehouse.inventoryValue)}</strong></td>
                  <td className="is-number"><span className={warehouse.outOfStockCount > 0 ? "inventory-dashboard-number is-danger" : "inventory-dashboard-number"}>{formatNumber(warehouse.outOfStockCount)}</span></td>
                  <td className="is-number"><span className={warehouse.reorderCount > 0 ? "inventory-dashboard-number is-warning" : "inventory-dashboard-number"}>{formatNumber(warehouse.reorderCount)}</span></td>
                  <td className="is-number"><span className={warehouse.expiryCount > 0 ? "inventory-dashboard-number is-warning" : "inventory-dashboard-number"}>{formatNumber(warehouse.expiryCount)}</span></td>
                  <td className="is-number"><span className={warehouse.pendingCount > 0 ? "inventory-dashboard-number is-info" : "inventory-dashboard-number"}>{formatNumber(warehouse.pendingCount)}</span></td>
                  <td><Link className="inventory-dashboard-warehouse-link" to={`${getInventoryRoute("reports").path}?warehouse=${warehouse.id}`}>Xem kho <span>→</span></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!warehouses.length ? <div className="inventory-dashboard-empty"><span><Icon name="store" size={22} /></span><div><strong>Chưa có kho trong phạm vi</strong><small>Hãy kiểm tra cấu hình kho hoặc quyền của tài khoản.</small></div></div> : null}
      </section>
    </div>
  );
}
