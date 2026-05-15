import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { getCustomerKey } from "../../../services/storageService.js";
import { getCustomerLoyaltyDetailAsync } from "../../../services/crmService.js";
import { formatMoney } from "../../../utils/format.js";

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

function getOrderStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") return "Hoàn tất";
  if (normalized === "confirmed") return "Đã xác nhận";
  if (normalized === "delivering") return "Đang giao";
  return "Chờ xác nhận";
}

function getInitials(name, phone) {
  const source = String(name || phone || "KH").trim();
  return source
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function isVipCustomer(customer) {
  return Number(customer.totalSpent || 0) >= 1000000 || Number(customer.totalOrders || 0) >= 10;
}

function needsCare(customer) {
  return Number(customer.daysSinceLastOrder || 0) >= 30;
}

function getTierTone(tier) {
  const normalized = String(tier || "").toLowerCase();
  if (normalized.includes("kim")) return "diamond";
  if (normalized.includes("vàng")) return "gold";
  if (normalized.includes("bạc")) return "silver";
  return "bronze";
}

function isGuestCustomer(customer) {
  return !customer.registeredCustomer;
}

function getCustomerTypeLabel(customer) {
  return isGuestCustomer(customer) ? "Vãng lai" : "Đã đăng ký";
}

function getCustomerTypeClass(customer) {
  return isGuestCustomer(customer) ? "crm-soft-badge--guest" : "crm-soft-badge--registered";
}

function formatVoucherDiscount(voucher) {
  if (voucher.discountType === "percent") return `${Number(voucher.value || 0)}%`;
  return formatMoney(Number(voucher.value || 0));
}

function getVoucherStatus(voucher) {
  if (voucher.canceled) return { label: "Đã hủy", className: "crm-status-canceled" };
  if (voucher.used) return { label: "Đã dùng", className: "crm-status-used" };
  return { label: "Chưa dùng", className: "crm-status-active" };
}

function getVoucherSortWeight(voucher) {
  if (voucher?.canceled) return 2;
  if (voucher?.used) return 1;
  return 0;
}

function CrmStatCard({ icon, title, value, subtitle, tone }) {
  return (
    <article className={`crm-stat-card crm-stat-card--${tone}`}>
      <span className="crm-stat-icon"><Icon name={icon} size={20} /></span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <em>{subtitle}</em>
      </div>
    </article>
  );
}

function CustomerIdentity({ customer, compact = false }) {
  return (
    <div className={`crm-customer-identity ${compact ? "crm-customer-identity--compact" : ""}`}>
      <span className="crm-avatar">{getInitials(customer.name, customer.phone)}</span>
      <div>
        <strong>{customer.name || "Khách hàng"}</strong>
        <small>{customer.phone || "--"}</small>
      </div>
    </div>
  );
}

export default function CustomerCRM({
  crmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  refreshCrm,
  giftVoucherToCustomer,
  cancelCustomerVoucher,
  showCustomerTier,
  coupons = [],
  customersDateFrom,
  setCustomersDateFrom,
  customersDateTo,
  setCustomersDateTo,
  customersDatePreset,
  setCustomersDatePreset
}) {
  const [keyword, setKeyword] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [showAllOrdersByPhone, setShowAllOrdersByPhone] = useState({});
  const [voucherPickerOpen, setVoucherPickerOpen] = useState(false);
  const [loyaltyDetailByPhone, setLoyaltyDetailByPhone] = useState({});

  const filteredCustomers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const phoneKey = getCustomerKey(q);
    const all = crmSnapshot.customers || [];
    const next = all.filter((customer) => {
      const name = String(`${customer.name || ""} ${customer.registeredCustomerName || ""} ${customer.orderCustomerName || ""}`).toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      const matchKeyword = !q || name.includes(q) || phone.includes(q) || (phoneKey && phone.includes(phoneKey));
      const matchFilter =
        customerFilter === "all" ||
        (customerFilter === "vip" && isVipCustomer(customer)) ||
        (customerFilter === "care" && needsCare(customer)) ||
        (customerFilter === "inactive7" && Number(customer.daysSinceLastOrder || 0) >= 7) ||
        (customerFilter === "inactive15" && Number(customer.daysSinceLastOrder || 0) >= 15) ||
        (customerFilter === "inactive30" && Number(customer.daysSinceLastOrder || 0) >= 30);
      return matchKeyword && matchFilter;
    });
    next.sort((a, b) => {
      if (sortBy === "spent") return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
      if (sortBy === "orders") return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
      return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
    });
    return next;
  }, [crmSnapshot.customers, keyword, customerFilter, sortBy]);

  const visibleCustomers = useMemo(() => filteredCustomers.slice(0, 5), [filteredCustomers]);

  const summary = useMemo(() => {
    const customers = crmSnapshot.customers || [];
    const repeatCustomers30 = customers.filter((customer) => {
      const totalOrders = Number(customer.totalOrders || 0);
      const daysSinceLastOrder = Number(customer.daysSinceLastOrder || 9999);
      return totalOrders >= 2 && daysSinceLastOrder <= 30;
    }).length;
    return {
      totalCustomers: customers.length,
      repeatCustomers30,
      vipCount: customers.filter(isVipCustomer).length,
      careCount: customers.filter(needsCare).length
    };
  }, [crmSnapshot.customers]);

  const selectedCustomer = useMemo(
    () => (crmSnapshot.customers || []).find((customer) => customer.phone === selectedCustomerPhone) || null,
    [crmSnapshot.customers, selectedCustomerPhone]
  );

  const loyaltyVouchers = useMemo(() => {
    return (coupons || [])
      .filter((coupon) => coupon.active !== false && String(coupon.voucherType || "checkout") === "loyalty")
      .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  }, [coupons]);

  const selectedOrders = useMemo(() => {
    const orders = Array.isArray(selectedCustomer?.orders) ? selectedCustomer.orders : [];
    return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [selectedCustomer]);

  const visibleDetailOrders = selectedCustomer
    ? (showAllOrdersByPhone[selectedCustomer.phone] ? selectedOrders : selectedOrders.slice(0, 4))
    : [];

  useEffect(() => {
    let disposed = false;
    const phone = selectedCustomer?.phone ? getCustomerKey(selectedCustomer.phone) : "";
    if (!phone) return () => {
      disposed = true;
    };
    (async () => {
      const result = await getCustomerLoyaltyDetailAsync(phone, { limit: 100, offset: 0 });
      if (disposed) return;
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const orderEarn = rows
        .filter((item) => String(item?.type || "").toUpperCase() === "ORDER_EARN")
        .reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const checkin = rows
        .filter((item) => ["CHECKIN", "MILESTONE"].includes(String(item?.type || "").toUpperCase()))
        .reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const spend = Math.abs(
        rows
          .filter((item) => String(item?.type || "").toUpperCase() === "ORDER_SPEND")
          .reduce((sum, item) => sum + Number(item?.points || 0), 0)
      );
      const total = rows.reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const other = total - orderEarn - checkin + spend;
      setLoyaltyDetailByPhone((current) => ({
        ...current,
        [phone]: {
          rows,
          total: Number(result?.total || rows.length),
          orderEarn,
          checkin,
          spend,
          other,
          totalPoints: Math.max(0, total)
        }
      }));
    })();
    return () => {
      disposed = true;
    };
  }, [selectedCustomer?.phone]);

  const selectedLoyaltyDetail = selectedCustomer?.phone
    ? loyaltyDetailByPhone[getCustomerKey(selectedCustomer.phone)] || null
    : null;

  const sortedSelectedVouchers = useMemo(() => {
    const vouchers = Array.isArray(selectedCustomer?.vouchers) ? selectedCustomer.vouchers : [];
    return [...vouchers].sort((a, b) => {
      const weightDiff = getVoucherSortWeight(a) - getVoucherSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [selectedCustomer?.vouchers]);

  const resetFilters = () => {
    setKeyword("");
    setCustomerFilter("all");
    setSortBy("latest");
  };

  return (
    <section className="crm-page">
      <div className="crm-page-hero">
        <div>
          <p>Quản lý khách hàng</p>
          <h2>Khách hàng / CRM</h2>
          <span>Theo dõi lịch sử mua hàng, điểm tích lũy và chăm sóc khách quay lại.</span>
        </div>
        <button type="button" className="crm-refresh-btn" onClick={refreshCrm}>
          <Icon name="back" size={16} />
          Tải lại dữ liệu
        </button>
      </div>

      <div className="crm-stat-grid">
        <CrmStatCard icon="user" tone="orange" title="Tổng khách hàng" value={summary.totalCustomers.toLocaleString("vi-VN")} subtitle="Từ dữ liệu đơn hàng" />
        <CrmStatCard icon="cart" tone="green" title="Khách quay lại (30 ngày)" value={summary.repeatCustomers30.toLocaleString("vi-VN")} subtitle="Từ 2 đơn trở lên trong 30 ngày" />
        <CrmStatCard icon="star" tone="purple" title="Khách VIP" value={summary.vipCount.toLocaleString("vi-VN")} subtitle="Theo ngưỡng hiện tại" />
        <CrmStatCard icon="heart" tone="blue" title="Cần chăm sóc" value={summary.careCount.toLocaleString("vi-VN")} subtitle="Chưa quay lại từ 30 ngày" />
      </div>

      <div className="crm-workspace">
        <div className="crm-list-panel">
          <div className="crm-filter-bar">
            <label className="crm-search">
              <Icon name="search" size={17} />
              <input placeholder="Tìm theo tên hoặc số điện thoại..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="latest">Mua gần nhất</option>
              <option value="spent">Chi tiêu cao nhất</option>
              <option value="orders">Nhiều đơn nhất</option>
            </select>
            <div className="crm-filter-tabs">
              <button type="button" className={customerFilter === "all" ? "active" : ""} onClick={() => setCustomerFilter("all")}>Tất cả</button>
              <button type="button" className={customerFilter === "vip" ? "active" : ""} onClick={() => setCustomerFilter("vip")}>VIP</button>
              <button type="button" className={customerFilter === "inactive7" ? "active" : ""} onClick={() => setCustomerFilter("inactive7")}>7 ngày chưa mua</button>
              <button type="button" className={customerFilter === "inactive15" ? "active" : ""} onClick={() => setCustomerFilter("inactive15")}>15 ngày chưa mua</button>
              <button type="button" className={customerFilter === "inactive30" ? "active" : ""} onClick={() => setCustomerFilter("inactive30")}>30 ngày chưa mua</button>
              <button type="button" className={customerFilter === "care" ? "active" : ""} onClick={() => setCustomerFilter("care")}>Cần chăm sóc</button>
            </div>
            <button type="button" className="crm-reset-btn" onClick={resetFilters}>Xóa lọc</button>
          </div>
          <p style={{ margin: "0 4px 10px", fontSize: 12, color: "#6b778c" }}>
            Hiển thị {Math.min(5, filteredCustomers.length)} / {filteredCustomers.length} khách theo bộ lọc hiện tại.
          </p>

          <div className="crm-table">
            <div className="crm-table-head">
              <span>Khách hàng</span>
              <span>Nhóm</span>
              <span>Tổng đơn</span>
              <span>Tổng chi tiêu</span>
              <span>Lần mua cuối</span>
              <span>Điểm</span>
            </div>

            <div className="crm-table-body">
              {visibleCustomers.map((customer) => {
                const isSelected = selectedCustomerPhone === customer.phone;
                return (
                  <button
                    type="button"
                    key={customer.phone}
                    className={`crm-table-row ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedCustomerPhone(isSelected ? "" : customer.phone)}
                  >
                    <CustomerIdentity customer={customer} />
                    <span>
                      <span className="crm-badge-stack">
                        <em className={`crm-soft-badge ${getCustomerTypeClass(customer)}`}>{getCustomerTypeLabel(customer)}</em>
                        {customer.nameMismatch ? <em className="crm-soft-badge crm-soft-badge--care">Khác tên</em> : null}
                        {showCustomerTier ? <em className={`crm-tier-badge crm-tier-badge--${getTierTone(customer.tier)}`}>{customer.tier}</em> : null}
                      </span>
                    </span>
                    <strong>{Number(customer.totalOrders || 0).toLocaleString("vi-VN")}</strong>
                    <strong>{formatMoney(customer.totalSpent)}</strong>
                    <small>{formatDateTime(customer.lastOrderAt)}</small>
                    <strong>{Number(customer.currentPoints || 0).toLocaleString("vi-VN")}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="crm-empty-state">
              <Icon name="user" size={28} />
              <p>Chưa có khách hàng phù hợp với bộ lọc.</p>
            </div>
          )}
        </div>

        <aside className={`crm-detail-panel ${selectedCustomer ? "is-open" : ""}`}>
          {selectedCustomer ? (
            <>
              <div className="crm-detail-head">
                <button type="button" className="crm-detail-close" onClick={() => setSelectedCustomerPhone("")}>×</button>
                <CustomerIdentity customer={selectedCustomer} compact />
                <div className="crm-detail-badges">
                  {showCustomerTier ? <em className={`crm-tier-badge crm-tier-badge--${getTierTone(selectedCustomer.tier)}`}>{selectedCustomer.tier}</em> : null}
                  <em className={`crm-soft-badge ${getCustomerTypeClass(selectedCustomer)}`}>{getCustomerTypeLabel(selectedCustomer)}</em>
                  {selectedCustomer.nameMismatch ? <em className="crm-soft-badge crm-soft-badge--care">Tên đặt đơn khác tài khoản</em> : null}
                  {isVipCustomer(selectedCustomer) ? <em className="crm-soft-badge">VIP</em> : null}
                  {needsCare(selectedCustomer) ? <em className="crm-soft-badge crm-soft-badge--care">Cần chăm sóc</em> : null}
                </div>
              </div>

              <div className="crm-detail-scroll">
                <div className="crm-detail-metrics">
                  <article><small>Tổng đơn hàng</small><strong>{Number(selectedCustomer.totalOrders || 0).toLocaleString("vi-VN")}</strong></article>
                  <article><small>Tổng chi tiêu</small><strong>{formatMoney(selectedCustomer.totalSpent)}</strong></article>
                  <article><small>Lần mua cuối</small><strong>{formatDateTime(selectedCustomer.lastOrderAt)}</strong></article>
                  <article><small>Chưa quay lại</small><strong>{selectedCustomer.daysSinceLastOrder ?? "--"} ngày</strong></article>
                </div>

                <section className="crm-detail-card crm-loyalty-card">
                  <div className="crm-card-title">
                    <Icon name="gift" size={17} />
                    <h3>Loyalty</h3>
                  </div>
                  {selectedCustomer.registeredCustomerName && selectedCustomer.orderCustomerName ? (
                    <div className="crm-points-grid">
                      <span>Tên tài khoản: {selectedCustomer.registeredCustomerName}</span>
                      <span>Tên đơn gần nhất: {selectedCustomer.orderCustomerName}</span>
                    </div>
                  ) : null}
                  <div className="crm-points-line">
                    <span>Điểm hiện tại</span>
                    <strong>{Number((selectedLoyaltyDetail?.totalPoints ?? selectedCustomer.currentPoints) || 0).toLocaleString("vi-VN")}</strong>
                  </div>
                  <div className="crm-points-grid">
                    <span>Từ đơn hàng: {Number((selectedLoyaltyDetail?.orderEarn ?? selectedCustomer.autoPoints) || 0).toLocaleString("vi-VN")}</span>
                    <span>Điểm danh/thưởng: {Number((selectedLoyaltyDetail?.checkin ?? selectedCustomer.checkinAndRewardPoints) || 0).toLocaleString("vi-VN")}</span>
                    <span>Đã dùng điểm: -{Number((selectedLoyaltyDetail?.spend ?? selectedCustomer.spentPoints) || 0).toLocaleString("vi-VN")}</span>
                    <span>Điều chỉnh khác: {Number((selectedLoyaltyDetail?.other ?? selectedCustomer.otherAdjustPoints) || 0).toLocaleString("vi-VN")}</span>
                  </div>
                </section>

                <section className="crm-detail-card">
                  <div className="crm-card-title">
                    <Icon name="bag" size={17} />
                    <h3>Lịch sử đơn gần đây</h3>
                  </div>
                  <div className="crm-mini-list">
                    {visibleDetailOrders.map((order) => (
                      <article key={order.id || order.orderCode}>
                        <div>
                          <strong>{order.orderCode || order.id}</strong>
                          <small>{formatDateTime(order.createdAt)}</small>
                        </div>
                        <div>
                          <strong>{formatMoney(Number(order.totalAmount || order.total || 0))}</strong>
                          <em>{getOrderStatusLabel(order.status)}</em>
                        </div>
                      </article>
                    ))}
                    {selectedOrders.length === 0 && <p>Chưa có đơn hàng.</p>}
                  </div>
                  {selectedOrders.length > 4 && (
                    <button
                      type="button"
                      className="crm-link-btn"
                      onClick={() => setShowAllOrdersByPhone((current) => ({ ...current, [selectedCustomer.phone]: !current[selectedCustomer.phone] }))}
                    >
                      {showAllOrdersByPhone[selectedCustomer.phone] ? "Thu gọn đơn hàng" : `Xem thêm ${selectedOrders.length - 4} đơn`}
                    </button>
                  )}
                </section>

                <section className="crm-detail-card">
                  <div className="crm-card-title">
                    <Icon name="tag" size={17} />
                    <h3>Voucher đã tặng</h3>
                  </div>
                  <div className="crm-mini-list">
                    {sortedSelectedVouchers.map((voucher) => {
                      const status = getVoucherStatus(voucher);
                      return (
                        <article key={voucher.id}>
                          <div>
                            <strong>{voucher.code ? `${voucher.code} - ${voucher.title}` : voucher.title}</strong>
                            <small>HSD: {voucher.expiredAt || "--"}</small>
                          </div>
                          <div className="crm-voucher-row-actions">
                            <em className={status.className}>{status.label}</em>
                            {!voucher.used && !voucher.canceled ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await cancelCustomerVoucher?.(selectedCustomer.phone, voucher);
                                }}
                              >
                                Hủy
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                    {sortedSelectedVouchers.length === 0 && <p>Chưa có voucher.</p>}
                  </div>
                </section>
              </div>

              <div className="crm-detail-actions">
                <button type="button" onClick={() => setVoucherPickerOpen(true)}>Tặng voucher</button>
              </div>

              {voucherPickerOpen ? (
                <div className="crm-voucher-picker-backdrop" role="presentation" onClick={() => setVoucherPickerOpen(false)}>
                  <section className="crm-voucher-picker" role="dialog" aria-modal="true" aria-label="Chọn voucher loyalty" onClick={(event) => event.stopPropagation()}>
                    <div className="crm-voucher-picker-head">
                      <div>
                        <h3>Chọn voucher loyalty</h3>
                        <p>Tặng voucher đã tạo trong Khuyến mãi / Mã giảm giá.</p>
                      </div>
                      <button type="button" onClick={() => setVoucherPickerOpen(false)}>×</button>
                    </div>
                    <div className="crm-voucher-picker-list">
                      {loyaltyVouchers.map((voucher) => (
                        <button
                          key={voucher.id || voucher.code}
                          type="button"
                          onClick={async () => {
                            await giftVoucherToCustomer(selectedCustomer.phone, voucher);
                            setVoucherPickerOpen(false);
                          }}
                        >
                          <span>
                            <strong>{voucher.code}</strong>
                            <small>{voucher.name || "Voucher loyalty"}</small>
                          </span>
                          <em>{formatVoucherDiscount(voucher)}</em>
                        </button>
                      ))}
                      {!loyaltyVouchers.length ? (
                        <p>Chưa có voucher loyalty. Bạn tạo trong Khuyến mãi / Mã giảm giá / Voucher loyalty trước nhé.</p>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          ) : (
            <div className="crm-detail-empty">
              <Icon name="user" size={34} />
              <h3>Chọn một khách hàng</h3>
              <p>Thông tin chi tiết, loyalty, voucher và lịch sử đơn sẽ hiển thị tại đây.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
