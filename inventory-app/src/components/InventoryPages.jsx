import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Package,
  Plus,
  Trash,
  Truck,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import CatalogManager from "./CatalogManager.jsx";
import { getInventoryStatus } from "../utils/inventoryNorms.js";

const DOCUMENT_LABELS = {
  purchase_receipt: "Nhập mua",
  transfer: "Điều chuyển",
  stock_adjustment: "Điều chỉnh",
  stock_count: "Kiểm kê",
  waste: "Hủy hàng"
};

const ITEM_TYPE_LABELS = {
  ingredient: "Nguyên vật liệu",
  finished_good: "Thành phẩm",
  semi_finished: "Bán thành phẩm",
  direct_sale: "Hàng bán thẳng",
  other: "Khác",
  note: "Ghi chú"
};

function PageHeader({ eyebrow, title, description, actionLabel }) {
  return (
    <header className="operations-page-header">
      <div>
        <p className="operations-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionLabel ? <button className="primary-button compact"><Plus weight="bold" />{actionLabel}</button> : null}
    </header>
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
  const trackedBalances = data.balances.filter((balance) => balance.inventory_items?.tracks_inventory !== false);
  const totalQuantity = trackedBalances.reduce((sum, balance) => sum + Number(balance.quantity || 0), 0);
  const lowStock = trackedBalances.filter((balance) => {
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
  const [search, setSearch] = useState("");
  const balances = useMemo(() => data.balances.filter((balance) => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return !keyword || `${balance.inventory_items?.code || ""} ${balance.inventory_items?.name || ""}`.toLocaleLowerCase("vi").includes(keyword);
  }), [data.balances, search]);
  return (
    <div className="operations-page">
      <PageHeader eyebrow="Sổ kho" title="Tồn kho hiện tại" description="Tìm nhanh số lượng đang có và thời điểm cập nhật gần nhất." />
      <section className="operations-surface">
        <div className="operations-toolbar"><label className="search-field"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hoặc tên hàng hóa" /></label><button className="secondary-button">Xuất Excel</button></div>
        {balances.length ? (
          <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Hàng hóa</th><th>Phân loại</th><th>Đơn vị</th><th className="right">Tồn hiện tại</th><th className="right">Định mức</th><th>Trạng thái</th></tr></thead><tbody>{balances.map((balance) => { const inventoryStatus = getInventoryStatus(balance, data.itemWarehouseNorms); return <tr key={`${balance.warehouse_id}-${balance.item_id}`}><td><strong>{balance.inventory_items?.name || "Không xác định"}</strong><small>{balance.inventory_items?.code}</small></td><td>{ITEM_TYPE_LABELS[balance.inventory_items?.item_type] || "—"}</td><td>{balance.inventory_items?.inventory_units?.name || "—"}</td><td className="right quantity">{Number(balance.quantity || 0).toLocaleString("vi-VN")}</td><td className="right quantity">{inventoryStatus.minimum > 0 ? inventoryStatus.minimum.toLocaleString("vi-VN") : "—"}</td><td><span className={`norm-status ${inventoryStatus.key}`}>{inventoryStatus.label}</span></td></tr>; })}</tbody></table></div>
        ) : <EmptyState title="Kho chưa có số tồn" description="Tồn kho sẽ xuất hiện sau khi nhập tồn đầu hoặc hoàn thành phiếu nhập." />}
      </section>
    </div>
  );
}

const EMPTY_RECEIPT_LINE = { itemId: "", unitId: "", quantity: "", unitPrice: "" };

function PurchaseReceiptForm({ data, onClose, onCreate }) {
  const [form, setForm] = useState({ warehouseId: "", supplierId: "", referenceNo: "", notes: "", lines: [] });
  const [itemQuery, setItemQuery] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const updateLine = (index, field, value) => setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }));
  const availableItems = data.items.filter((item) => {
    const keyword = itemQuery.trim().toLocaleLowerCase("vi");
    const matches = !keyword || `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(keyword);
    return item.tracks_inventory !== false && matches && !form.lines.some((line) => line.itemId === item.id);
  }).slice(0, 12);
  const addItem = (item) => {
    setForm((current) => ({ ...current, lines: [...current.lines, { ...EMPTY_RECEIPT_LINE, itemId: item.id, unitId: item.inventory_units?.id || "" }] }));
    setItemQuery("");
    setItemPickerOpen(false);
    setError("");
  };
  const total = form.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await onCreate(form);
      onClose(`Đã hoàn thành phiếu ${result.document_no || "nhập hàng"} và cập nhật tồn kho.`);
    } catch (saveError) {
      setError(saveError.message || "Chưa thể hoàn thành phiếu nhập.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop receipt-workbench-backdrop">
      <section className="receipt-workbench" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <header className="receipt-workbench-header">
          <div><p className="eyebrow">Nhập kho / Nhập mua hàng</p><h2 id="receipt-title">Tạo phiếu nhập hàng</h2></div>
          <button type="button" className="modal-close" onClick={() => onClose()} aria-label="Đóng">×</button>
        </header>
        <form className="receipt-workbench-form" onSubmit={submit}>
          <div className="receipt-workbench-body">
            <main className="receipt-entry-area">
              <div className="receipt-entry-toolbar"><div><h3>Hàng hóa nhập kho</h3><p>Tìm và chọn nguyên liệu, hệ thống sẽ tự thêm một dòng bên dưới.</p></div></div>
              <div className="receipt-item-picker">
                <MagnifyingGlass />
                <input value={itemQuery} onFocus={() => setItemPickerOpen(true)} onChange={(event) => { setItemQuery(event.target.value); setItemPickerOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && availableItems.length === 1) { event.preventDefault(); addItem(availableItems[0]); } if (event.key === "Escape") setItemPickerOpen(false); }} placeholder="Nhập mã hoặc tên nguyên liệu" aria-label="Tìm nguyên liệu để thêm" />
                {itemPickerOpen ? <div className="receipt-item-results">{availableItems.map((item) => <button type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addItem(item)}><span><strong>{item.name}</strong><small>{item.code}</small></span><span>{item.inventory_units?.name || "—"}<Plus /></span></button>)}{!availableItems.length ? <p>{form.lines.length === data.items.filter((item) => item.tracks_inventory !== false).length ? "Đã thêm tất cả hàng hóa." : "Không tìm thấy nguyên liệu phù hợp."}</p> : null}</div> : null}
              </div>
              <div className="receipt-grid-wrap">
                <div className="receipt-grid receipt-grid-head"><span>#</span><span>Hàng hóa</span><span>Đơn vị</span><span>Số lượng <b>*</b></span><span>Đơn giá</span><span>Thành tiền</span><span /></div>
                {form.lines.map((line, index) => {
                  const item = data.items.find((entry) => entry.id === line.itemId);
                  const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
                  return <div className="receipt-grid receipt-grid-row" key={line.itemId}><span className="receipt-row-number">{index + 1}</span><span className="receipt-item-cell"><strong>{item?.name}</strong><small>{item?.code}</small></span><span className="receipt-unit">{item?.inventory_units?.name || "—"}</span><label><span className="mobile-field-label">Số lượng</span><input aria-label={`Số lượng ${item?.name}`} type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} autoFocus={index === form.lines.length - 1} /></label><label><span className="mobile-field-label">Đơn giá</span><input aria-label={`Đơn giá ${item?.name}`} type="number" min="0" step="100" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} /></label><strong className="receipt-line-total">{lineTotal.toLocaleString("vi-VN")} đ</strong><button type="button" className="remove-line" onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))} aria-label={`Xóa ${item?.name}`}><Trash /></button></div>;
                })}
                {!form.lines.length ? <div className="receipt-grid-empty"><Package size={28} /><strong>Chưa có hàng hóa</strong><span>Tìm nguyên liệu ở ô phía trên để thêm vào phiếu.</span></div> : null}
              </div>
            </main>
            <aside className="receipt-info-panel">
              <section><h3>Thông tin nhập kho</h3><label>Nhà cung cấp<span className="required-mark">*</span><select value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}><option value="">Chọn nhà cung cấp</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Kho nhập<span className="required-mark">*</span><select value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))}><option value="">Chọn kho nhập</option>{data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>Thời gian nhập<input value={new Date().toLocaleString("vi-VN")} disabled readOnly /></label></section>
              <section><h3>Thông tin hóa đơn</h3><label>Số hóa đơn<input value={form.referenceNo} onChange={(event) => setForm((current) => ({ ...current, referenceNo: event.target.value }))} placeholder="Nhập số hóa đơn nếu có" /></label><label>Ghi chú<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows="4" /></label></section>
            </aside>
          </div>
          {error ? <p className="form-error receipt-workbench-error">{error}</p> : null}
          <footer className="receipt-workbench-footer"><div className="receipt-footer-summary"><span><small>Số mặt hàng</small><strong>{form.lines.filter((line) => line.itemId).length}</strong></span><span><small>Tổng số lượng</small><strong>{form.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0).toLocaleString("vi-VN")}</strong></span><span className="receipt-footer-total"><small>Tổng tiền</small><strong>{total.toLocaleString("vi-VN")} đ</strong></span></div><div className="receipt-footer-actions"><button type="button" className="secondary-button" onClick={() => onClose()}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? "Đang hoàn thành..." : "Hoàn thành & nhập kho"}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

export function WorkflowPage({ page, data, onCreateReceipt }) {
  const [search, setSearch] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const configs = {
    transfers: ["Giao nhận nội bộ", "Theo dõi hàng từ kho tổng đến từng chi nhánh và xe đẩy.", "Tạo phiếu giao", Truck],
    receipts: ["Nhập hàng", "Nhập từ nhà cung cấp, lưu đơn giá và ảnh chứng từ.", "Tạo phiếu nhập", ArrowDown],
    counts: ["Kiểm kê", "Đếm thực tế, đối chiếu và xử lý chênh lệch có phê duyệt.", "Tạo đợt kiểm kê", CheckCircle],
    reports: ["Báo cáo", "Nhập – xuất – tồn và chênh lệch theo từng kho.", null, ArrowUp]
  };
  const [title, description, action] = configs[page];
  const filtered = data.documents.filter((document) => {
    if (page === "transfers") return document.document_type === "transfer";
    if (page === "receipts") return document.document_type === "purchase_receipt";
    if (page === "counts") return document.document_type === "stock_count";
    return true;
  }).filter((document) => !search.trim() || document.document_no.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  return (
    <div className="operations-page">
      <header className="operations-page-header"><div><p className="operations-kicker">Vận hành</p><h1>{title}</h1><p>{description}</p></div>{action ? <button className="primary-button compact" onClick={() => page === "receipts" && setReceiptOpen(true)}><Plus weight="bold" />{action}</button> : null}</header>
      {notice ? <div className="success-banner"><CheckCircle weight="fill" />{notice}</div> : null}
      <section className="operations-surface">
        <div className="operations-toolbar"><label className="search-field"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm số phiếu" /></label><div className="operations-tabs"><button className="active">Tất cả <strong>{filtered.length}</strong></button></div></div>
        {filtered.length ? (
          <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Số phiếu</th><th>Loại phiếu</th><th>Ngày tạo</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead><tbody>{filtered.map((document) => <tr key={document.id}><td><strong>{document.document_no}</strong></td><td>{DOCUMENT_LABELS[document.document_type]}</td><td>{new Date(document.created_at).toLocaleDateString("vi-VN")}</td><td><span className={`status ${document.status}`}>{document.status === "completed" ? "Hoàn thành" : "Đang xử lý"}</span></td><td className="row-action"><button aria-label={`Xem ${document.document_no}`}><ArrowRight /></button></td></tr>)}</tbody></table></div>
        ) : <EmptyState title="Chưa có phiếu" description="Tạo phiếu đầu tiên khi bắt đầu vận hành kho." />}
      </section>
      {receiptOpen ? <PurchaseReceiptForm data={data} onCreate={onCreateReceipt} onClose={(message = "") => { setReceiptOpen(false); setNotice(message); }} /> : null}
    </div>
  );
}

export function CatalogPage({ data, onCreate, onSaveNorm }) {
  return <CatalogManager data={data} onCreate={onCreate} onSaveNorm={onSaveNorm} />;
}

export function StaffPage({ data }) {
  const [search, setSearch] = useState("");
  const staff = data.staff.filter((entry) => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return !keyword || `${entry.auth_user_id} ${entry.role} ${entry.inventory_warehouses?.name || ""}`.toLocaleLowerCase("vi").includes(keyword);
  });
  return (
    <div className="operations-page">
      <PageHeader eyebrow="Bảo mật" title="Nhân viên & phân quyền" description="Mỗi người dùng tài khoản riêng và chỉ thấy những kho được giao." actionLabel="Mời nhân viên" />
      <section className="operations-surface">
        <div className="operations-toolbar"><label className="search-field"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tài khoản hoặc vai trò" /></label><div className="operations-tabs"><button className="active">Đang hoạt động <strong>{data.staff.filter((entry) => entry.is_active).length}</strong></button><button>Đã khóa <strong>{data.staff.filter((entry) => !entry.is_active).length}</strong></button></div></div>
        {staff.length ? (
          <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Kho được giao</th><th>Trạng thái</th></tr></thead><tbody>{staff.map((entry) => <tr key={entry.id}><td><strong>{entry.auth_user_id.slice(0, 8)}…</strong><small>Tài khoản Supabase</small></td><td>{entry.role}</td><td>{entry.inventory_warehouses?.name || "Toàn hệ thống"}</td><td><span className="status completed">{entry.is_active ? "Hoạt động" : "Đã khóa"}</span></td></tr>)}</tbody></table></div>
        ) : <EmptyState title="Chưa có nhân viên được phân quyền" description="Mời quản lý kho hoặc nhân viên chi nhánh để bắt đầu." />}
      </section>
    </div>
  );
}

