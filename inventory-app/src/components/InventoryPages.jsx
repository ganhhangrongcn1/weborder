import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Package,
  Plus,
  Truck,
} from "@phosphor-icons/react";
import CatalogManager from "./CatalogManager.jsx";

const DOCUMENT_LABELS = {
  purchase_receipt: "Nhập mua",
  transfer: "Điều chuyển",
  stock_adjustment: "Điều chỉnh",
  stock_count: "Kiểm kê",
  waste: "Hủy hàng"
};

function PageHeader({ eyebrow, title, description, actionLabel }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionLabel ? <button className="primary-button compact"><Plus weight="bold" />{actionLabel}</button> : null}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div><Package size={30} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function DashboardPage({ data }) {
  const totalQuantity = data.balances.reduce((sum, balance) => sum + Number(balance.quantity || 0), 0);
  const lowStock = data.balances.filter((balance) => {
    const minimum = Number(balance.inventory_items?.minimum_stock || 0);
    return minimum > 0 && Number(balance.quantity || 0) <= minimum;
  }).length;
  const pendingTransfers = data.documents.filter((document) => document.document_type === "transfer" && document.status !== "completed").length;

  return (
    <>
      <PageHeader eyebrow="Hôm nay" title="Vận hành kho trong một nhịp nhìn" description="Các việc cần xử lý được ưu tiên trước, số liệu chi tiết nằm phía sau." actionLabel="Tạo phiếu nhanh" />
      <section className="metric-grid">
        <article className="metric-card dark"><span>Tổng lượng tồn</span><strong>{totalQuantity.toLocaleString("vi-VN")}</strong><small>trên phạm vi kho đang xem</small></article>
        <article className="metric-card"><span>Đang giao</span><strong>{pendingTransfers}</strong><small>phiếu chờ chi nhánh nhận</small></article>
        <article className="metric-card warning"><span>Cần chú ý</span><strong>{lowStock}</strong><small>mặt hàng dưới định mức</small></article>
        <article className="metric-card"><span>Danh mục</span><strong>{data.items.length}</strong><small>mặt hàng đang hoạt động</small></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-title"><div><p className="eyebrow">Ưu tiên</p><h2>Việc cần làm</h2></div><Clock size={24} /></div>
          <div className="task-list">
            <button><span className="task-icon orange"><Truck /></span><span><strong>Xác nhận hàng đang giao</strong><small>Kiểm đếm trước khi nhập kho</small></span><ArrowRight /></button>
            <button><span className="task-icon green"><ArrowDown /></span><span><strong>Nhập hàng nhà cung cấp</strong><small>Ghi số lượng, đơn giá và chứng từ</small></span><ArrowRight /></button>
            <button><span className="task-icon cream"><CheckCircle /></span><span><strong>Kiểm kê cuối ngày</strong><small>Chỉ mất vài phút với mẫu có sẵn</small></span><ArrowRight /></button>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><div><p className="eyebrow">Mới nhất</p><h2>Hoạt động gần đây</h2></div></div>
          {data.documents.length ? (
            <div className="activity-list">
              {data.documents.slice(0, 6).map((document) => (
                <div key={document.id}>
                  <span className={document.status === "completed" ? "dot green" : "dot orange"} />
                  <span><strong>{DOCUMENT_LABELS[document.document_type] || document.document_type}</strong><small>{document.document_no}</small></span>
                  <time>{new Date(document.created_at).toLocaleDateString("vi-VN")}</time>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Chưa có hoạt động" description="Phiếu nhập, giao nhận và kiểm kê sẽ xuất hiện tại đây." />}
        </article>
      </section>
    </>
  );
}

export function InventoryPage({ data }) {
  return (
    <>
      <PageHeader eyebrow="Sổ kho" title="Tồn kho hiện tại" description="Tìm nhanh số lượng đang có và thời điểm cập nhật gần nhất." />
      <section className="panel">
        <div className="toolbar"><label className="search-field"><MagnifyingGlass /><input placeholder="Tìm mã hoặc tên hàng hóa" /></label><button className="secondary-button">Xuất Excel</button></div>
        {data.balances.length ? (
          <div className="data-table">
            <div className="table-row table-head"><span>Hàng hóa</span><span>Phân loại</span><span>Đơn vị</span><span className="right">Tồn hiện tại</span></div>
            {data.balances.map((balance) => (
              <div className="table-row" key={`${balance.warehouse_id}-${balance.item_id}`}>
                <span><strong>{balance.inventory_items?.name || "Không xác định"}</strong><small>{balance.inventory_items?.code}</small></span>
                <span>{balance.inventory_items?.item_type || "—"}</span>
                <span>{balance.inventory_items?.inventory_units?.name || "—"}</span>
                <span className="right quantity">{Number(balance.quantity || 0).toLocaleString("vi-VN")}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Kho chưa có số tồn" description="Tồn kho sẽ xuất hiện sau khi nhập tồn đầu hoặc hoàn thành phiếu nhập." />}
      </section>
    </>
  );
}

export function WorkflowPage({ page, data }) {
  const configs = {
    transfers: ["Giao nhận nội bộ", "Theo dõi hàng từ kho tổng đến từng chi nhánh và xe đẩy.", "Tạo phiếu giao", Truck],
    receipts: ["Nhập hàng", "Nhập từ nhà cung cấp, lưu đơn giá và ảnh chứng từ.", "Tạo phiếu nhập", ArrowDown],
    counts: ["Kiểm kê", "Đếm thực tế, đối chiếu và xử lý chênh lệch có phê duyệt.", "Tạo đợt kiểm kê", CheckCircle],
    reports: ["Báo cáo", "Nhập – xuất – tồn và chênh lệch theo từng kho.", null, ArrowUp]
  };
  const [title, description, action, Icon] = configs[page];
  const filtered = data.documents.filter((document) => {
    if (page === "transfers") return document.document_type === "transfer";
    if (page === "receipts") return document.document_type === "purchase_receipt";
    if (page === "counts") return document.document_type === "stock_count";
    return true;
  });
  return (
    <>
      <PageHeader eyebrow="Vận hành" title={title} description={description} actionLabel={action} />
      <section className="panel">
        <div className="panel-title"><div><p className="eyebrow">Danh sách</p><h2>Phiếu gần đây</h2></div><Icon size={25} /></div>
        {filtered.length ? (
          <div className="document-list">
            {filtered.map((document) => (
              <button key={document.id}>
                <span className="document-icon"><Icon /></span>
                <span><strong>{document.document_no}</strong><small>{DOCUMENT_LABELS[document.document_type]}</small></span>
                <span className={`status ${document.status}`}>{document.status === "completed" ? "Hoàn thành" : "Đang xử lý"}</span>
                <ArrowRight />
              </button>
            ))}
          </div>
        ) : <EmptyState title="Chưa có phiếu" description="Tạo phiếu đầu tiên khi bắt đầu vận hành kho." />}
      </section>
    </>
  );
}

export function CatalogPage({ data, onCreate }) {
  return (
    <>
      <PageHeader eyebrow="Thiết lập" title="Danh mục vận hành" description="Anh có thể chủ động thêm kho, hàng hóa và nhà cung cấp bất cứ lúc nào." />
      <CatalogManager data={data} onCreate={onCreate} />
    </>
  );
}

export function StaffPage({ data }) {
  return (
    <>
      <PageHeader eyebrow="Bảo mật" title="Nhân viên & phân quyền" description="Mỗi người dùng tài khoản riêng và chỉ thấy những kho được giao." actionLabel="Mời nhân viên" />
      <section className="panel">
        {data.staff.length ? (
          <div className="data-table">
            <div className="table-row table-head"><span>Tài khoản</span><span>Vai trò</span><span>Kho được giao</span><span>Trạng thái</span></div>
            {data.staff.map((entry) => (
              <div className="table-row" key={entry.id}>
                <span><strong>{entry.auth_user_id.slice(0, 8)}…</strong><small>Tài khoản Supabase</small></span>
                <span>{entry.role}</span><span>{entry.inventory_warehouses?.name || "Toàn hệ thống"}</span>
                <span className="status completed">{entry.is_active ? "Hoạt động" : "Đã khóa"}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Chưa có nhân viên được phân quyền" description="Mời quản lý kho hoặc nhân viên chi nhánh để bắt đầu." />}
      </section>
    </>
  );
}

