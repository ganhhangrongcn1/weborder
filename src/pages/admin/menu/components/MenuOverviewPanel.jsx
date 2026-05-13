import { ALL_CATEGORY } from "../menuManager.utils.js";
import { formatMoney } from "../../../../utils/format.js";
import { AdminButton, AdminCard, AdminIconButton, AdminInput, AdminSelect } from "../../ui/index.js";

export default function MenuOverviewPanel({
  createMenuOpen,
  setCreateMenuOpen,
  addProduct,
  addCategory,
  viewFilter,
  setViewFilter,
  selectedAdminCategory,
  setSelectedAdminCategory,
  adminCategories,
  productSearch,
  setProductSearch,
  products,
  categoryStats,
  setCategoryVisibility,
  openCategoryEditor,
  filteredAdminProducts,
  setProductVisibility,
  onEditProduct
}) {
  return (
    <AdminCard className="admin-panel admin-menu-section">
      <div className="admin-menu-filter-row admin-menu-sticky-toolbar">
        <div className="admin-menu-left-actions">
          <div className="admin-menu-create-wrap">
            <AdminButton className="admin-menu-filter-btn" onClick={() => setCreateMenuOpen((current) => !current)}>
              Thêm mới
            </AdminButton>
            {createMenuOpen ? (
              <div className="admin-menu-create-dropdown">
                <AdminButton variant="ghost" onClick={() => { addProduct(); setCreateMenuOpen(false); }}>Thêm món</AdminButton>
                <AdminButton variant="ghost" onClick={() => { addCategory(); setCreateMenuOpen(false); }}>Thêm danh mục</AdminButton>
              </div>
            ) : null}
          </div>
          <AdminSelect className="admin-input" value={viewFilter} onChange={(event) => setViewFilter(event.target.value)}>
            <option value="all">Tất cả lịch bán</option>
            <option value="visible">Đang hiển thị</option>
            <option value="hidden">Đang ẩn</option>
          </AdminSelect>
          <AdminSelect className="admin-input" value={selectedAdminCategory} onChange={(event) => setSelectedAdminCategory(event.target.value)}>
            <option value={ALL_CATEGORY}>Xem tất cả các món</option>
            {adminCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </AdminSelect>
        </div>
        <AdminInput className="admin-input admin-menu-search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Tìm theo tên món" />
      </div>

      <div className="admin-menu-board admin-menu-overview-board">
        <div className="admin-menu-col">
          <div className="admin-menu-col-head"><strong>Danh mục</strong></div>
          <div className="admin-menu-categories">
            <button type="button" className={`admin-menu-category-item ${selectedAdminCategory === ALL_CATEGORY ? "active" : ""}`} onClick={() => setSelectedAdminCategory(ALL_CATEGORY)}>
              <span>{ALL_CATEGORY}</span>
              <em>{products.length}</em>
            </button>
            {adminCategories.map((category) => {
              const stat = categoryStats.get(category) || { total: 0, hidden: 0 };
              const categoryActive = stat.total > 0 ? stat.hidden < stat.total : true;
              return (
                <div
                  key={category}
                  className={`admin-menu-category-item admin-menu-preset-item ${selectedAdminCategory === category ? "active" : ""}`}
                  onClick={() => setSelectedAdminCategory(category)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedAdminCategory(category);
                    }
                  }}
                >
                  <span>{category}</span>
                  <div className="admin-menu-preset-actions">
                    <em>{stat.total}{stat.hidden > 0 ? <small>{` • ẩn ${stat.hidden}`}</small> : null}</em>
                    <label className="admin-switch" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={categoryActive} onChange={(event) => { event.stopPropagation(); setCategoryVisibility(category, event.target.checked); }} />
                      <span />
                    </label>
                    <AdminIconButton label="Chỉnh sửa danh mục" className="admin-menu-preset-edit-btn" onClick={(event) => { event.stopPropagation(); openCategoryEditor(category); }}>✎</AdminIconButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-menu-col admin-menu-products">
          <div className="admin-menu-col-head"><strong>Món</strong></div>
          <div className="admin-menu-product-list">
            {filteredAdminProducts.map((product) => (
              <button key={product.id} type="button" onClick={() => onEditProduct?.(product)} className="admin-menu-product-row">
                <img src={product.image} alt={product.name} />
                <span>
                  <strong>{product.name}</strong>
                  <em>{formatMoney(product.price)}</em>
                </span>
                <div className="flex items-center gap-2">
                  <i>{product.visible === false ? "Đang ẩn" : "Đang bán"}</i>
                  <label className="admin-switch" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={product.visible !== false} onChange={(event) => { event.stopPropagation(); setProductVisibility(product.id, event.target.checked); }} />
                    <span />
                  </label>
                </div>
              </button>
            ))}
            {!filteredAdminProducts.length ? <p className="admin-help-text">Không có món phù hợp bộ lọc hiện tại.</p> : null}
          </div>
        </div>
      </div>
    </AdminCard>
  );
}
