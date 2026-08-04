import {
  ArrowRight,
  ChartBar,
  CheckCircle,
  Package,
  Plus,
  Receipt,
  Truck,
  WarningCircle
} from "@phosphor-icons/react";
import "./dashboard.css";
import { getWarehouseMinimumStock } from "../utils/inventoryNorms.js";

const DOCUMENT_LABELS = {
  purchase_receipt: "Nhập mua",
  transfer: "Điều chuyển",
  stock_adjustment: "Điều chỉnh",
  stock_count: "Kiểm kê",
  waste: "Hủy hàng"
};

export default function DashboardPage({ data, onNavigate }) {
  const trackedBalances = data.balances.filter((row) => row.inventory_items?.tracks_inventory !== false);
  const totalQuantity = trackedBalances.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const outOfStock = trackedBalances.filter((row) => Number(row.quantity || 0) <= 0).length;
  const lowStock = trackedBalances.filter((row) => {
    const minimum = getWarehouseMinimumStock(row, data.itemWarehouseNorms);
    const quantity = Number(row.quantity || 0);
    return minimum > 0 && quantity > 0 && quantity <= minimum;
  }).length;
  const overStock = trackedBalances.filter((row) => {
    const minimum = getWarehouseMinimumStock(row, data.itemWarehouseNorms);
    return minimum > 0 && Number(row.quantity || 0) >= minimum * 3;
  }).length;
  const countDocuments = (type) => data.documents.filter((row) => row.document_type === type).length;
  const pendingTransfers = data.documents.filter((row) => row.document_type === "transfer" && row.status !== "completed").length;
  const now = new Date();
  const chartData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const value = data.documents.filter((document) => {
      const createdAt = new Date(document.created_at);
      return createdAt.getFullYear() === date.getFullYear() && createdAt.getMonth() === date.getMonth();
    }).length;
    return { label: `Tháng ${date.getMonth() + 1}`, value };
  });
  const chartMax = Math.max(1, ...chartData.map((entry) => entry.value));

  const tasks = [
    { icon: Truck, label: "Giao nhận", value: pendingTransfers, detail: "Phiếu chờ chi nhánh nhận", page: "transfers" },
    { icon: Receipt, label: "Nhập hàng", value: countDocuments("purchase_receipt"), detail: "Phiếu nhập gần đây", page: "receipts" },
    { icon: CheckCircle, label: "Kiểm kê", value: countDocuments("stock_count"), detail: "Lượt kiểm kê gần đây", page: "counts" },
    { icon: WarningCircle, label: "Hàng dưới định mức", value: lowStock, detail: "Mặt hàng cần xử lý", page: "inventory" }
  ];

  return (
    <div className="dashboard-page">
      <header className="operations-page-header dashboard-page-header">
        <div><p className="operations-kicker">Tổng quan hôm nay</p><h1>Kho hàng</h1><p>Nắm nhanh sức khỏe tồn kho và những việc cần xử lý.</p></div>
        <button className="primary-button compact" onClick={() => onNavigate("receipts")}><Plus weight="bold" />Tạo phiếu nhập</button>
      </header>

      <section className="dashboard-summary" aria-label="Sức khỏe tồn kho">
        <button onClick={() => onNavigate("inventory")}><span>Tổng lượng tồn</span><strong>{totalQuantity.toLocaleString("vi-VN")}</strong><small>Trên phạm vi đang xem</small></button>
        <button onClick={() => onNavigate("inventory")}><span>Hết hàng</span><strong className="danger">{outOfStock}</strong><small>Mặt hàng</small></button>
        <button onClick={() => onNavigate("inventory")}><span>Dưới định mức</span><strong className="warning">{lowStock}</strong><small>Mặt hàng</small></button>
        <button onClick={() => onNavigate("inventory")}><span>Vượt định mức</span><strong>{overStock}</strong><small>Mặt hàng</small></button>
      </section>

      <div className="dashboard-main-grid">
        <section className="dashboard-surface dashboard-chart-panel">
          <header className="dashboard-section-header"><div><h2>Nhịp vận hành</h2><p>{data.documents.length} phiếu trong dữ liệu gần đây</p></div><ChartBar size={24} /></header>
          <div className="mini-chart" aria-label="Biểu đồ hoạt động sáu tháng gần nhất">
            {chartData.map((entry) => <div key={entry.label} className="chart-column"><span className={entry.value ? "" : "empty"} style={{ height: `${Math.max(3, Math.round((entry.value / chartMax) * 100))}%` }} title={`${entry.value} phiếu`} /><small>{entry.label}</small></div>)}
          </div>
        </section>

        <aside className="dashboard-surface dashboard-tasks">
          <header className="dashboard-section-header"><div><h2>Việc đang chờ</h2><p>Ưu tiên theo luồng vận hành</p></div></header>
          <div className="dashboard-task-list">{tasks.map(({ icon: Icon, label, value, detail, page }) => <button key={label} onClick={() => onNavigate(page)}><span className="dashboard-task-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span><b>{value}</b><ArrowRight /></button>)}</div>
        </aside>
      </div>

      <section className="dashboard-surface dashboard-recent">
        <header className="dashboard-section-header"><div><h2>Hoạt động gần đây</h2><p>Phiếu mới nhất trên phạm vi đang xem</p></div><button className="dashboard-text-button" onClick={() => onNavigate("reports")}>Xem báo cáo <ArrowRight /></button></header>
        {data.documents.length ? <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Số phiếu</th><th>Loại phiếu</th><th>Ngày tạo</th><th>Trạng thái</th></tr></thead><tbody>{data.documents.slice(0, 6).map((document) => <tr key={document.id}><td><strong>{document.document_no}</strong></td><td>{DOCUMENT_LABELS[document.document_type] || document.document_type}</td><td>{new Date(document.created_at).toLocaleDateString("vi-VN")}</td><td><span className={`status ${document.status}`}>{document.status === "completed" ? "Hoàn thành" : "Đang xử lý"}</span></td></tr>)}</tbody></table></div> : <p className="dashboard-empty">Chưa có hoạt động kho.</p>}
      </section>
    </div>
  );
}
