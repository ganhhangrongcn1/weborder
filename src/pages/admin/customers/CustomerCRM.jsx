import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import {
  buildCustomerOrderPointStatusMap,
  getCustomerOrderPointStatuses,
  resolveCustomerOrderPointStatus
} from "../../../services/customerOrderPointStatusService.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { getCustomerLoyaltyDetailAsync, getCustomerRecentOrdersAsync } from "../../../services/crmService.js";
import { getOrderSourceBadge } from "../../../services/partnerOrderService.js";
import {
  buildLoyaltyOrderPointLookup,
  resolveOrderPointStatus
} from "../../../services/loyaltyLedgerUtils.js";
import {
  getCouponManagementGroup,
  getCouponManagementGroupDefinition,
  listCrmGiftableCoupons
} from "../../../services/voucherManagementGroupService.js";
import { getVoucherAudienceDefinition } from "../../../services/voucherCampaignPresetService.js";
import { getBulkGiftHistoryAsync, getCampaignPresetsAsync } from "../../../services/crmCampaignService.js";
import { formatMoney } from "../../../utils/format.js";

const INITIAL_DETAIL_ORDER_LIMIT = 3;
const DETAIL_ORDER_PAGE_SIZE = 10;
const DETAIL_ORDER_FETCH_LIMIT = 100;
const CUSTOMER_PAGE_SIZE = 12;
const CRM_VIEW_TABS = [
  {
    id: "customers",
    label: "Danh sách khách",
    eyebrow: "CRM khách hàng",
    description: "Tìm khách, lọc nhóm, chọn nhiều khách và xử lý tặng tay ngay trên danh sách."
  },
  {
    id: "campaigns",
    label: "Gửi voucher",
    eyebrow: "Gửi theo nhóm",
    description: "Chọn nhóm khách, kiểm tra người nhận rồi chọn voucher để gửi ngay trong một luồng."
  },
  {
    id: "history",
    label: "Lịch sử gửi",
    eyebrow: "CRM lịch sử",
    description: "Theo dõi các đợt gửi voucher hàng loạt gần đây, số thành công, số trùng và số lỗi."
  }
];

function getCompactPageItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("start-ellipsis");

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) items.push("end-ellipsis");

  items.push(totalPages);
  return items;
}

function CrmCompactPagination({ page, totalPages, totalItems, pageSize, onChange }) {
  const [draftPage, setDraftPage] = useState(String(page));
  const pageItems = useMemo(() => getCompactPageItems(page, totalPages), [page, totalPages]);
  const firstItem = totalItems > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const lastItem = Math.min(totalItems, page * pageSize);

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  const goToPage = (value) => {
    const nextPage = Math.min(totalPages, Math.max(1, Number(value) || 1));
    onChange(nextPage);
    setDraftPage(String(nextPage));
  };

  return (
    <div className="crm-pagination-row crm-pagination-row--compact">
      <div className="crm-pagination-summary">
        <strong>Trang {page}/{totalPages}</strong>
        <span>{firstItem}-{lastItem} trong {totalItems.toLocaleString("vi-VN")} khách</span>
      </div>

      <div className="crm-pagination-controls" aria-label="Phân trang khách hàng">
        <button type="button" className="crm-page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
          Trước
        </button>
        <div className="crm-pagination-pages">
          {pageItems.map((item) => (
            typeof item === "number" ? (
              <button
                type="button"
                key={item}
                className={`crm-page-btn ${item === page ? "is-active" : ""}`}
                onClick={() => goToPage(item)}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="crm-page-ellipsis">...</span>
            )
          ))}
        </div>
        <button type="button" className="crm-page-btn" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
          Sau
        </button>
      </div>

      <form className="crm-pagination-jump" onSubmit={(event) => {
        event.preventDefault();
        goToPage(draftPage);
      }}>
        <span>Đến trang</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={draftPage}
          onChange={(event) => setDraftPage(event.target.value)}
          onBlur={() => goToPage(draftPage)}
          aria-label="Nhập số trang"
        />
      </form>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

function formatListDateTime(value) {
  if (!value) return "Chưa mua";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa mua";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCustomerInsight(customer = {}) {
  const days = Number(customer.daysSinceLastOrder);
  const totalOrders = Number(customer.totalOrders || 0);
  if (totalOrders <= 0) return "Chưa có đơn";
  if (!Number.isFinite(days)) return "Có lịch sử mua";
  if (days === 0) return "Mua gần nhất hôm nay";
  if (days < 7) return `Mua lại ${days} ngày trước`;
  if (days >= 30) return `Chưa quay lại ${days} ngày`;
  return `${days} ngày chưa mua`;
}

function getCustomerActionLabel(customer = {}) {
  if (needsCare(customer)) return "Gửi ưu đãi";
  const days = Number(customer.daysSinceLastOrder);
  if (Number.isFinite(days) && days >= 7) return "Gọi lại";
  if (Number(customer.totalOrders || 0) <= 0) return "Tạo đơn đầu";
  return "Xem chi tiết";
}

function getCustomerReturnLabel(customer = {}) {
  const totalOrders = Number(customer.totalOrders || 0);
  const days = Number(customer.daysSinceLastOrder);
  if (totalOrders <= 0) return "Chưa có đơn";
  if (!Number.isFinite(days)) return "--";
  if (days <= 0) return "Mua hôm nay";
  return `${days} ngày`;
}

function getCustomerCarePlan(customer = {}) {
  const days = Number(customer.daysSinceLastOrder);
  const totalOrders = Number(customer.totalOrders || 0);
  const tierName = getCustomerTierName(customer);

  if (totalOrders <= 0) {
    return {
      tone: "new",
      label: "Khách mới",
      title: "Chưa có đơn",
      actionLabel: "Tặng voucher đơn đầu"
    };
  }

  if (tierName) {
    return {
      tone: "tier",
      label: "Hạng thành viên",
      title: tierName,
      actionLabel: "Tặng voucher loyalty"
    };
  }

  if (needsCare(customer) || (Number.isFinite(days) && days >= 30)) {
    return {
      tone: "care",
      label: "Cần kéo lại",
      title: Number.isFinite(days) ? `Chưa quay lại ${days} ngày` : "Đã lâu chưa mua",
      actionLabel: "Tặng voucher kéo lại"
    };
  }

  if (Number.isFinite(days) && days >= 7) {
    return {
      tone: "follow",
      label: "Theo dõi",
      title: `${days} ngày chưa mua`,
      actionLabel: "Tặng voucher"
    };
  }

  if (Number.isFinite(days) && days <= 0) {
    return {
      tone: "ok",
      label: "Ổn định",
      title: "Mua hôm nay",
      actionLabel: "Tặng voucher"
    };
  }

  return {
    tone: "ok",
    label: "Ổn định",
    title: "Đang hoạt động",
    actionLabel: "Tặng voucher"
  };
}

function isNewMemberCustomer(customer = {}) {
  return !isGuestCustomer(customer) && Number(customer.totalOrders || 0) <= 0;
}

function hasTierMember(customer = {}) {
  return Boolean(getCustomerTierName(customer));
}

function isWinbackCustomer(customer = {}, minDays = 7) {
  const days = Number(customer.daysSinceLastOrder);
  return Number(customer.totalOrders || 0) > 0 && Number.isFinite(days) && days >= minDays;
}

function getCustomerCampaignAudiences(customer = {}) {
  const audiences = ["all"];
  if (isNewMemberCustomer(customer)) audiences.unshift("new_member");
  if (hasTierMember(customer)) audiences.unshift("tier_member");
  if (isWinbackCustomer(customer, 15)) {
    audiences.unshift("winback_15d");
    audiences.unshift("winback_7d");
  } else if (isWinbackCustomer(customer, 7)) {
    audiences.unshift("winback_7d");
  }
  return Array.from(new Set(audiences));
}

function getPrimaryCustomerAudience(customer = {}) {
  return getCustomerCampaignAudiences(customer).find((audience) => audience !== "all") || "all";
}

function getCustomerSegmentBadges(customer = {}) {
  const badges = [];
  if (isNewMemberCustomer(customer)) {
    badges.push({ key: "new_member", label: "Mới đăng ký chưa có đơn" });
  }
  if (isWinbackCustomer(customer, 15)) {
    badges.push({ key: "winback_15d", label: "Chưa quay lại 15+ ngày" });
  } else if (isWinbackCustomer(customer, 7)) {
    badges.push({ key: "winback_7d", label: "Chưa quay lại 7+ ngày" });
  }
  return badges;
}

function getVoucherAudienceRank(voucher = {}, customer = {}) {
  const audience = String(voucher?.campaignAudience || "all");
  const priorities = [...getCustomerCampaignAudiences(customer), "event_special"];
  const index = priorities.indexOf(audience);
  if (index >= 0) return index;
  return priorities.length + 1;
}

function isRecommendedVoucherForCustomer(voucher = {}, customer = {}) {
  const primaryAudience = getPrimaryCustomerAudience(customer);
  const voucherAudience = String(voucher?.campaignAudience || "all");
  if (primaryAudience === "all") return voucherAudience === "all";
  return voucherAudience === primaryAudience || voucherAudience === "all";
}

function getCampaignAudienceFromCustomerFilter(filter = "all") {
  if (filter === "new_member") return "new_member";
  if (filter === "tier_member" || String(filter || "").startsWith("tier:")) return "tier_member";
  if (filter === "inactive7") return "winback_7d";
  if (filter === "inactive15" || filter === "inactive30" || filter === "care") return "winback_15d";
  return "all";
}

function isRecommendedVoucherForAudience(voucher = {}, audience = "all") {
  const voucherAudience = String(voucher?.campaignAudience || "all");
  if (audience === "all") return voucherAudience === "all";
  return voucherAudience === audience || voucherAudience === "all";
}

function getCustomerFilterLabel(filter = "all", tierOptions = []) {
  if (filter === "all") return "Tất cả nhóm khách";
  if (filter === "new_member") return "Mới đăng ký chưa có đơn";
  if (filter === "registered") return "Khách đã đăng ký";
  if (filter === "tier_member") return "Khách có hạng thành viên";
  if (filter === "care") return "Cần chăm sóc";
  if (filter === "inactive7") return "Chưa quay lại 7+ ngày";
  if (filter === "inactive15") return "Chưa quay lại 15+ ngày";
  if (filter === "inactive30") return "Chưa quay lại 30+ ngày";
  if (String(filter || "").startsWith("tier:")) {
    const matchedTier = tierOptions.find((tier) => `tier:${tier.id}` === filter);
    return matchedTier?.label || "Theo hạng thành viên";
  }
  return "Tệp khách đã chọn";
}

function matchesCustomerFilterSelection(customer = {}, filter = "all", tierOptions = []) {
  const tierFilterName = String(filter || "").startsWith("tier:")
    ? normalizeTierText(tierOptions.find((tier) => `tier:${tier.id}` === filter)?.label || "")
    : "";

  return (
    filter === "all" ||
    (tierFilterName && normalizeTierText(getCustomerTierName(customer)) === tierFilterName) ||
    (filter === "registered" && !isGuestCustomer(customer)) ||
    (filter === "new_member" && isNewMemberCustomer(customer)) ||
    (filter === "tier_member" && hasTierMember(customer)) ||
    (filter === "care" && needsCare(customer)) ||
    (filter === "inactive7" && isWinbackCustomer(customer, 7)) ||
    (filter === "inactive15" && isWinbackCustomer(customer, 15)) ||
    (filter === "inactive30" && isWinbackCustomer(customer, 30))
  );
}

function getOrderStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") return "Hoàn tất";
  if (normalized === "confirmed") return "Đã xác nhận";
  if (normalized === "delivering") return "Đang giao";
  return "Chờ xác nhận";
}

function getOrderPointStatus(order = {}, statusMap = new Map(), loyaltyLookup = {}) {
  const rpcStatus = resolveCustomerOrderPointStatus(statusMap, order);
  const status = rpcStatus || resolveOrderPointStatus(order, loyaltyLookup);
  if (status === "claimed") return { key: "claimed", label: "Đã tích điểm" };
  if (status === "blocked") return { key: "blocked", label: "Không tích điểm" };
  if (status === "pending") return { key: "pending", label: "Chờ tích điểm" };
  return { key: "unknown", label: "Chưa rõ" };
}

function getOrderPointSummary(orders = [], statusMap = new Map(), loyaltyLookup = {}) {
  return orders.reduce((summary, order) => {
    const status = getOrderPointStatus(order, statusMap, loyaltyLookup).key;
    if (status === "claimed") return { ...summary, claimed: summary.claimed + 1 };
    if (status === "pending") return { ...summary, pending: summary.pending + 1 };
    if (status === "blocked") return { ...summary, blocked: summary.blocked + 1 };
    return { ...summary, unknown: summary.unknown + 1 };
  }, { claimed: 0, pending: 0, blocked: 0, unknown: 0 });
}

function OrderSourceBadge({ order }) {
  const badge = getOrderSourceBadge(order);
  return <em className={`crm-soft-badge ${badge.className || ""}`}>{badge.label}</em>;
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

function needsCare(customer) {
  const daysSinceLastOrder = Number(customer.daysSinceLastOrder);
  return Number(customer.totalOrders || 0) > 0 &&
    Number.isFinite(daysSinceLastOrder) &&
    daysSinceLastOrder >= 30;
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

function normalizeTierText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCustomerTierName(customer = {}) {
  const rawTier = customer?.tier;
  if (rawTier && typeof rawTier === "object") {
    return String(rawTier.name || rawTier.label || "").trim();
  }
  return String(rawTier || customer?.tierName || "").trim();
}

function getCustomerTierBadgeClass(customer = {}, tierOptions = []) {
  const tierName = normalizeTierText(getCustomerTierName(customer));
  const tierIndex = tierOptions.findIndex((tier) => normalizeTierText(tier.label) === tierName);
  if (tierIndex >= 4) return "crm-tier-badge--diamond";
  if (tierIndex >= 3) return "crm-tier-badge--gold";
  if (tierIndex >= 2) return "crm-tier-badge--silver";
  return "crm-tier-badge--bronze";
}

function formatVoucherDiscount(voucher) {
  if (voucher.discountType === "percent") return `${Number(voucher.value || 0)}%`;
  return formatMoney(Number(voucher.value || 0));
}

function getCouponRefCandidates(coupon = {}) {
  const refs = [];
  const id = String(coupon?.id || "").trim();
  const code = String(coupon?.code || "").trim().toUpperCase();
  if (id) refs.push(id);
  if (code) refs.push(code);
  return refs;
}

function getGrantedVoucherRefCandidates(voucher = {}) {
  const refs = [];
  const couponId = String(voucher?.couponId || "").trim();
  const code = String(voucher?.code || "").trim().toUpperCase();
  if (couponId) refs.push(couponId);
  if (code) refs.push(code);
  return refs;
}

function getGiftableVoucherTypeLabel(voucher, loyaltyConfig = {}) {
  if (String(voucher?.voucherType || "checkout") !== "loyalty") return "Mã giảm giá";
  const managementGroup = getCouponManagementGroup(voucher, loyaltyConfig);
  return getCouponManagementGroupDefinition(managementGroup).label;
}

function resolveGrantedVoucherMeta(voucher = {}, couponMetaByRef = new Map()) {
  const refs = getGrantedVoucherRefCandidates(voucher);
  for (let index = 0; index < refs.length; index += 1) {
    const resolved = couponMetaByRef.get(refs[index]);
    if (resolved) return resolved;
  }
  if (String(voucher?.voucherType || "") !== "loyalty") return null;
  const fallbackGroup = String(voucher?.managementGroup || "").trim() || "loyalty_crm";
  const definition = getCouponManagementGroupDefinition(fallbackGroup);
  return {
    label: definition.label,
    value: definition.value
  };
}

function getVoucherGrantSourceLabel(voucher = {}) {
  const grantSourceLabel = String(voucher?.grantSourceLabel || "").trim();
  const grantCampaignLabel = String(voucher?.grantCampaignLabel || "").trim();
  if (grantSourceLabel && grantCampaignLabel && grantCampaignLabel !== grantSourceLabel) {
    return `${grantSourceLabel} · ${grantCampaignLabel}`;
  }
  if (grantSourceLabel) return grantSourceLabel;
  if (grantCampaignLabel) return grantCampaignLabel;
  if (String(voucher?.type || "").trim().toUpperCase() === "WELCOME_REGISTER") {
    return "Tự động - đăng ký mới";
  }
  if (String(voucher?.grantSourceType || "").trim() === "crm_bulk") {
    return "CRM - gửi theo nhóm";
  }
  if (String(voucher?.grantSourceType || "").trim() === "crm_single") {
    return "CRM - tặng tay";
  }
  return "";
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

function getVoucherKey(voucher) {
  return String(
    voucher?.id ||
    `${voucher?.code || ""}-${voucher?.createdAt || ""}-${voucher?.title || ""}`
  ).trim();
}

function mergeVoucherLists(...lists) {
  const merged = new Map();
  lists.flat().forEach((voucher) => {
    if (!voucher) return;
    const key = getVoucherKey(voucher);
    if (!key) return;
    merged.set(key, {
      ...(merged.get(key) || {}),
      ...voucher
    });
  });
  return Array.from(merged.values());
}

function formatCustomerPoints(customer) {
  const points = Number(customer?.currentPoints || 0);
  return points > 0 ? points.toLocaleString("vi-VN") : "";
}

function getChannelLabel(channel = "") {
  const normalized = String(channel || "").toLowerCase();
  if (normalized === "grabfood") return "Grab";
  if (normalized === "shopeefood") return "ShopeeFood";
  if (normalized === "xanhngon") return "Xanh Ngon";
  if (normalized === "qr_counter") return "QR";
  if (normalized === "website") return "Web";
  return channel || "Chưa xác định";
}

function getVoucherSegmentLabel(segment = "") {
  const labels = {
    winback_30: "Quay lại sau 30 ngày",
    winback_15: "Nhắc quay lại sau 15 ngày",
    winback_7: "Gợi ý mua lại sau 7 ngày",
    vip_thank_you: "Tri ân hạng cao",
    repeat_reward: "Thưởng khách quay lại",
    first_order_offer: "Khách chưa từng đặt đơn",
    excluded_order_only: "Chỉ có đơn hủy / đặt trước"
  };
  return labels[segment] || segment;
}

function getDateScopeLabel(preset = "", dateFrom = "", dateTo = "") {
  if (preset === "today") return "Hôm nay";
  if (preset === "yesterday") return "Hôm qua";
  if (preset === "week") return "Tuần này";
  if (preset === "month") return "Tháng này";
  if (dateFrom || dateTo) {
    return [dateFrom || "...", dateTo || "..."].join(" -> ");
  }
  return "Theo bộ lọc";
}

function isVisibleBranchOption(branch = "") {
  const normalized = String(branch || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return normalized && normalized !== "chuaxacdinh" && normalized !== "chinhanhtest" && normalized !== "test";
}

function CrmStatCard({ icon, title, value, subtitle, tone, scope }) {
  return (
    <article className={`crm-stat-card crm-stat-card--${tone}`}>
      <span className="crm-stat-icon"><Icon name={icon} size={20} /></span>
      <div>
        <small>
          {title}
          {scope ? <span>{scope}</span> : null}
        </small>
        <strong>{value}</strong>
        <em>{subtitle}</em>
      </div>
    </article>
  );
}

function formatCompactDate(value = "") {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  if (!year || !month || !day) return "--";
  return `${day}/${month}`;
}

function formatSignedNumber(value = 0) {
  const number = Number(value || 0);
  if (number > 0) return `+${number.toLocaleString("vi-VN")}`;
  return number.toLocaleString("vi-VN");
}

function formatSignedPercent(value = 0) {
  const number = Number(value || 0);
  if (number > 0) return `+${number}%`;
  return `${number}%`;
}

function CrmMemberRegistrationCard({ comparison = null }) {
  const todayCount = Number(comparison?.todayCount || 0);
  const yesterdayCount = Number(comparison?.yesterdayCount || 0);
  const delta = Number(comparison?.delta || 0);
  const trend = comparison?.trend || "flat";
  const todayWeight = Number(comparison?.todayWeight || 0);
  return (
    <section className="crm-ops-card crm-member-card">
      <div className="crm-ops-head">
        <div>
          <h3>Đăng ký thành viên</h3>
          <p>Đếm hồ sơ customer đã đăng ký theo ngày tạo trên profiles.</p>
        </div>
        <span>{formatCompactDate(comparison?.todayDate)}</span>
      </div>
      <div className="crm-member-kpi">
        <strong>{todayCount.toLocaleString("vi-VN")}</strong>
        <em className={`crm-member-change crm-member-change--${trend}`}>
          {formatSignedNumber(delta)} khách · {formatSignedPercent(comparison?.changePercent)}
        </em>
      </div>
      <div className="crm-member-table">
        <span>Ngày</span>
        <span>Số đăng ký</span>
        <span>Trọng số</span>
        <strong>Hôm nay</strong>
        <b>{todayCount.toLocaleString("vi-VN")}</b>
        <em>{todayWeight}%</em>
        <strong>Hôm qua</strong>
        <b>{yesterdayCount.toLocaleString("vi-VN")}</b>
        <em>{Math.max(0, 100 - todayWeight)}%</em>
      </div>
    </section>
  );
}

function CustomerIdentity({ customer, compact = false, insight = "" }) {
  return (
    <div className={`crm-customer-identity ${compact ? "crm-customer-identity--compact" : ""}`}>
      <span className="crm-avatar">{getInitials(customer.name, customer.phone)}</span>
      <div>
        <strong>{customer.name || "Khách hàng"}</strong>
        <small>{customer.phone || "--"}</small>
        {insight && !compact ? <em>{insight}</em> : null}
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
  bulkGiftVoucherToCustomers,
  cancelCustomerVoucher,
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
  const [branchFilter, setBranchFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [detailOrdersByPhone, setDetailOrdersByPhone] = useState({});
  const [detailOrderLimitByPhone, setDetailOrderLimitByPhone] = useState({});
  const [activeViewTab, setActiveViewTab] = useState("customers");
  const [voucherPickerOpen, setVoucherPickerOpen] = useState(false);
  const [voucherPickerMode, setVoucherPickerMode] = useState("single");
  const [isManualSelectionMode, setIsManualSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState([]);
  const [campaignSelectedPhones, setCampaignSelectedPhones] = useState([]);
  const [campaignPreviewKeyword, setCampaignPreviewKeyword] = useState("");
  const [campaignPresets, setCampaignPresets] = useState([]);
  const [bulkGiftHistory, setBulkGiftHistory] = useState([]);
  const [activeBulkCampaign, setActiveBulkCampaign] = useState(null);
  const [loyaltyDetailByPhone, setLoyaltyDetailByPhone] = useState({});
  const [orderPointStatusRowsByPhone, setOrderPointStatusRowsByPhone] = useState({});
  const [isLoyaltyDetailLoading, setIsLoyaltyDetailLoading] = useState(false);
  const [detailLoadingByPhone, setDetailLoadingByPhone] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkGifting, setIsBulkGifting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [topCustomerMode, setTopCustomerMode] = useState("spent");
  const crmAnalytics = crmSnapshot.crmAnalytics?.source === "rpc" ? crmSnapshot.crmAnalytics : null;
  const activeDateScope = getDateScopeLabel(customersDatePreset, customersDateFrom, customersDateTo);
  const loyaltyConfig = crmSnapshot.loyaltyConfig || {};
  const tierFilterOptions = useMemo(() => {
    const configTiers = Array.isArray(loyaltyConfig?.tiers)
      ? loyaltyConfig.tiers
      : [];
    const activeTiers = configTiers
      .filter((tier) => tier?.enabled !== false && String(tier?.name || "").trim())
      .map((tier) => ({
        id: String(tier.id || tier.name || "").trim(),
        label: String(tier.name || "").trim()
      }));
    if (activeTiers.length) return activeTiers;
    return Array.from(new Set(
      (crmSnapshot.customers || [])
        .map(getCustomerTierName)
        .filter(Boolean)
    )).map((label) => ({ id: label, label }));
  }, [crmSnapshot.customers, loyaltyConfig]);

  const filteredCustomers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const phoneKey = getCustomerKey(q);
    const all = crmSnapshot.customers || [];
    const next = all.filter((customer) => {
      const name = String(`${customer.name || ""} ${customer.registeredCustomerName || ""} ${customer.orderCustomerName || ""}`).toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      const matchKeyword = !q || name.includes(q) || phone.includes(q) || (phoneKey && phone.includes(phoneKey));
      const matchFilter = matchesCustomerFilterSelection(customer, customerFilter, tierFilterOptions);
      const matchBranch = branchFilter === "all" || customer.lastBranch === branchFilter;
      const matchChannel = channelFilter === "all" || customer.lastChannel === channelFilter;
      return matchKeyword && matchFilter && matchBranch && matchChannel;
    });
    next.sort((a, b) => {
      if (sortBy === "spent") return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
      if (sortBy === "orders") return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
      return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
    });
    return next;
  }, [crmSnapshot.customers, keyword, customerFilter, branchFilter, channelFilter, sortBy, tierFilterOptions]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleCustomers = useMemo(() => {
    const start = (safeCurrentPage - 1) * CUSTOMER_PAGE_SIZE;
    return filteredCustomers.slice(start, start + CUSTOMER_PAGE_SIZE);
  }, [filteredCustomers, safeCurrentPage]);

  const selectedPhoneSet = useMemo(
    () => new Set(selectedPhones),
    [selectedPhones]
  );

  const registeredCustomerPhoneSet = useMemo(
    () => new Set(
      (crmSnapshot.customers || [])
        .filter((customer) => Boolean(customer?.registeredCustomer))
        .map((customer) => String(customer?.phone || "").trim())
        .filter(Boolean)
    ),
    [crmSnapshot.customers]
  );

  const campaignSelectedPhoneSet = useMemo(
    () => new Set(campaignSelectedPhones),
    [campaignSelectedPhones]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, customerFilter, sortBy, branchFilter, channelFilter]);

  useEffect(() => {
    const availablePhones = new Set((crmSnapshot.customers || []).map((customer) => String(customer?.phone || "").trim()).filter(Boolean));
    setSelectedPhones((current) => current.filter((phone) => (
      availablePhones.has(String(phone || "").trim()) &&
      registeredCustomerPhoneSet.has(String(phone || "").trim())
    )));
    setCampaignSelectedPhones((current) => current.filter((phone) => (
      registeredCustomerPhoneSet.has(String(phone || "").trim())
    )));
  }, [crmSnapshot.customers, registeredCustomerPhoneSet]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [presets, history] = await Promise.all([
        getCampaignPresetsAsync(),
        getBulkGiftHistoryAsync()
      ]);
      if (disposed) return;
      setCampaignPresets(Array.isArray(presets) ? presets : []);
      setBulkGiftHistory(Array.isArray(history) ? history : []);
    })().catch((error) => {
      console.error("[crm] load campaign presets/history failed", error);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const summary = useMemo(() => {
    const customers = crmSnapshot.customers || [];
    const rawSupabaseProfileCount = crmSnapshot.supabaseProfileCount;
    const supabaseProfileCount = Number(rawSupabaseProfileCount);
    const repeatCustomers30 = customers.filter((customer) => {
      const totalOrders = Number(customer.totalOrders || 0);
      const daysSinceLastOrder = Number(customer.daysSinceLastOrder || 9999);
      return totalOrders >= 2 && daysSinceLastOrder <= 30;
    }).length;
    const rpcSummary = crmAnalytics?.summary;
    return {
      totalCustomers: rawSupabaseProfileCount !== null &&
        rawSupabaseProfileCount !== undefined &&
        Number.isFinite(supabaseProfileCount)
        ? supabaseProfileCount
        : null,
      repeatCustomers30: rpcSummary?.repeatCustomers30Days ?? repeatCustomers30,
      repeatRate30: rpcSummary ? Math.round(rpcSummary.repeatRate30Days * 100) : 0,
      newCustomers7: rpcSummary?.newCustomers7Days ?? 0,
      newCustomers30: rpcSummary?.newCustomers30Days ?? 0,
      careCount: rpcSummary?.inactive30Days ?? customers.filter(needsCare).length
    };
  }, [crmSnapshot.customers, crmSnapshot.supabaseProfileCount, crmAnalytics]);

  const segmentQuickFilters = useMemo(() => {
    const customers = crmSnapshot.customers || [];
    return [
      { value: "all", label: "Tất cả", count: customers.length },
      { value: "new_member", label: "Mới đăng ký", count: customers.filter(isNewMemberCustomer).length },
      { value: "tier_member", label: "Khách có hạng", count: customers.filter(hasTierMember).length },
      { value: "inactive7", label: "7+ ngày chưa quay lại", count: customers.filter((customer) => isWinbackCustomer(customer, 7)).length },
      { value: "inactive15", label: "15+ ngày chưa quay lại", count: customers.filter((customer) => isWinbackCustomer(customer, 15)).length },
      { value: "inactive30", label: "30+ ngày cần chăm sóc", count: customers.filter((customer) => isWinbackCustomer(customer, 30)).length }
    ];
  }, [crmSnapshot.customers]);

  const campaignPresetCards = useMemo(() => {
    const customers = (crmSnapshot.customers || []).filter((customer) => Boolean(customer?.registeredCustomer));
    return (campaignPresets || []).map((preset) => ({
      ...preset,
      count: customers.filter((customer) => matchesCustomerFilterSelection(customer, preset.filterValue, tierFilterOptions)).length
    }));
  }, [campaignPresets, crmSnapshot.customers, tierFilterOptions]);

  const campaignTargetCustomers = useMemo(() => {
    if (!activeBulkCampaign) return [];
    return (crmSnapshot.customers || []).filter((customer) => (
      Boolean(customer?.registeredCustomer) &&
      matchesCustomerFilterSelection(customer, activeBulkCampaign.filterValue, tierFilterOptions)
    ));
  }, [activeBulkCampaign, crmSnapshot.customers, tierFilterOptions]);

  const campaignSelectedCustomers = useMemo(
    () => campaignTargetCustomers.filter((customer) => campaignSelectedPhoneSet.has(String(customer?.phone || "").trim())),
    [campaignSelectedPhoneSet, campaignTargetCustomers]
  );

  const filteredCampaignPreviewCustomers = useMemo(() => {
    const keywordValue = campaignPreviewKeyword.trim().toLowerCase();
    const phoneKey = getCustomerKey(keywordValue);
    if (!keywordValue) return campaignSelectedCustomers;
    return campaignSelectedCustomers.filter((customer) => {
      const name = String(customer?.name || "").toLowerCase();
      const phone = String(customer?.phone || "").toLowerCase();
      return name.includes(keywordValue) || phone.includes(keywordValue) || (phoneKey && phone.includes(phoneKey));
    });
  }, [campaignPreviewKeyword, campaignSelectedCustomers]);

  const visibleCampaignPreviewCustomers = useMemo(
    () => filteredCampaignPreviewCustomers.slice(0, 40),
    [filteredCampaignPreviewCustomers]
  );

  const crmViewTabs = useMemo(() => ([
    {
      id: "customers",
      label: "Danh sách khách",
      count: Number((crmSnapshot.customers || []).length || 0).toLocaleString("vi-VN")
    },
    {
      id: "campaigns",
      label: "Gửi voucher",
      count: Number(campaignPresetCards.length || 0).toLocaleString("vi-VN")
    },
    {
      id: "history",
      label: "Lịch sử gửi",
      count: Number(bulkGiftHistory.length || 0).toLocaleString("vi-VN")
    }
  ]), [bulkGiftHistory.length, campaignPresetCards.length, crmSnapshot.customers]);

  const filteredCustomerPhones = useMemo(
    () => filteredCustomers
      .filter((customer) => Boolean(customer?.registeredCustomer))
      .map((customer) => String(customer?.phone || "").trim())
      .filter(Boolean),
    [filteredCustomers]
  );

  const visibleCustomerPhones = useMemo(
    () => visibleCustomers
      .filter((customer) => Boolean(customer?.registeredCustomer))
      .map((customer) => String(customer?.phone || "").trim())
      .filter(Boolean),
    [visibleCustomers]
  );

  const selectedFilteredCount = useMemo(
    () => filteredCustomerPhones.filter((phone) => selectedPhoneSet.has(phone)).length,
    [filteredCustomerPhones, selectedPhoneSet]
  );

  const selectedVisibleCount = useMemo(
    () => visibleCustomerPhones.filter((phone) => selectedPhoneSet.has(phone)).length,
    [selectedPhoneSet, visibleCustomerPhones]
  );

  const activeViewTabMeta = useMemo(
    () => CRM_VIEW_TABS.find((tab) => tab.id === activeViewTab) || CRM_VIEW_TABS[0],
    [activeViewTab]
  );

  const bulkGiftHistorySummary = useMemo(() => {
    return (Array.isArray(bulkGiftHistory) ? bulkGiftHistory : []).reduce((summaryAcc, entry) => {
      const totalRecipients = Number(entry?.totalRecipients || 0);
      const successCount = Number(entry?.successCount || 0);
      const duplicateCount = Number(entry?.duplicateCount || 0);
      const unregisteredCount = Number(entry?.unregisteredCount || 0);
      const failedCount = Number(entry?.failedCount || 0);
      return {
        campaigns: summaryAcc.campaigns + 1,
        recipients: summaryAcc.recipients + totalRecipients,
        success: summaryAcc.success + successCount,
        duplicates: summaryAcc.duplicates + duplicateCount,
        unregistered: summaryAcc.unregistered + unregisteredCount,
        failed: summaryAcc.failed + Math.max(0, failedCount - duplicateCount - unregisteredCount)
      };
    }, {
      campaigns: 0,
      recipients: 0,
      success: 0,
      duplicates: 0,
      unregistered: 0,
      failed: 0
    });
  }, [bulkGiftHistory]);

  const priorityRows = useMemo(() => {
    const segments = Array.isArray(crmAnalytics?.voucherSegments) ? crmAnalytics.voucherSegments : [];
    const segmentRows = segments
      .filter((item) => Number(item.customerCount || 0) > 0)
      .slice(0, 3)
      .map((item) => ({
        label: getVoucherSegmentLabel(item.segment),
        value: `${Number(item.customerCount || 0).toLocaleString("vi-VN")} khách`,
        tone: String(item.segment || "").includes("vip") ? "vip" : "care"
      }));
    if (segmentRows.length) return segmentRows;
    return [
      {
        label: "Khách cần chăm sóc",
        value: `${summary.careCount.toLocaleString("vi-VN")} khách`,
        tone: "care"
      },
      {
        label: "Khách quay lại 30 ngày",
        value: `${summary.repeatCustomers30.toLocaleString("vi-VN")} khách`,
        tone: "returning"
      },
      {
        label: "Khách mới 7 ngày",
        value: `${Number(summary.newCustomers7 || 0).toLocaleString("vi-VN")} khách`,
        tone: "new"
      }
    ];
  }, [crmAnalytics, summary]);

  const topCustomers = useMemo(() => {
    if (crmAnalytics) {
      return topCustomerMode === "orders"
        ? crmAnalytics.topByOrders.slice(0, 5)
        : crmAnalytics.topBySpent.slice(0, 5);
    }
    const customers = [...(crmSnapshot.customers || [])];
    customers.sort((a, b) => topCustomerMode === "orders"
      ? Number(b.totalOrders || 0) - Number(a.totalOrders || 0)
      : Number(b.totalSpent || 0) - Number(a.totalSpent || 0)
    );
    return customers.slice(0, 5);
  }, [crmAnalytics, crmSnapshot.customers, topCustomerMode]);

  const selectedCustomer = useMemo(
    () => (crmSnapshot.customers || []).find((customer) => customer.phone === selectedCustomerPhone) || null,
    [crmSnapshot.customers, selectedCustomerPhone]
  );

  const primaryCustomerAudience = useMemo(
    () => getPrimaryCustomerAudience(selectedCustomer || {}),
    [selectedCustomer]
  );

  const bulkTargetAudience = useMemo(
    () => getCampaignAudienceFromCustomerFilter(customerFilter),
    [customerFilter]
  );

  const currentBulkCampaignMeta = useMemo(() => {
    if (activeBulkCampaign) {
      return {
        campaignKey: activeBulkCampaign.id || "",
        campaignLabel: activeBulkCampaign.label || getCustomerFilterLabel(customerFilter, tierFilterOptions),
        filterValue: activeBulkCampaign.filterValue || customerFilter,
        audience: activeBulkCampaign.audience || bulkTargetAudience
      };
    }
    return {
      campaignKey: "",
      campaignLabel: getCustomerFilterLabel(customerFilter, tierFilterOptions),
      filterValue: customerFilter,
      audience: bulkTargetAudience
    };
  }, [activeBulkCampaign, bulkTargetAudience, customerFilter, tierFilterOptions]);

  const effectiveBulkAudience = currentBulkCampaignMeta.audience || bulkTargetAudience;

  const isBulkVoucherPicker = voucherPickerMode !== "single";
  const bulkRecipientPhones = voucherPickerMode === "campaign"
    ? campaignSelectedPhones
    : selectedPhones;

  const effectiveVoucherAudience = isBulkVoucherPicker
    ? effectiveBulkAudience
    : primaryCustomerAudience;

  const giftableVouchers = useMemo(() => {
    return listCrmGiftableCoupons(coupons, loyaltyConfig).sort((a, b) => {
      const rankDiff = isBulkVoucherPicker
        ? Number(!isRecommendedVoucherForAudience(a, effectiveBulkAudience)) - Number(!isRecommendedVoucherForAudience(b, effectiveBulkAudience))
        : getVoucherAudienceRank(a, selectedCustomer || {}) - getVoucherAudienceRank(b, selectedCustomer || {});
      if (rankDiff !== 0) return rankDiff;
      return String(a?.code || "").localeCompare(String(b?.code || ""));
    });
  }, [coupons, effectiveBulkAudience, isBulkVoucherPicker, loyaltyConfig, selectedCustomer]);

  const autoManagedVoucherCount = useMemo(() => {
    return (coupons || []).filter((coupon) => {
      return coupon?.active !== false && getCouponManagementGroup(coupon, loyaltyConfig) === "loyalty_auto";
    }).length;
  }, [coupons, loyaltyConfig]);

  const couponMetaByRef = useMemo(() => {
    return (coupons || []).reduce((map, coupon) => {
      if (String(coupon?.voucherType || "") !== "loyalty") return map;
      const managementGroup = getCouponManagementGroup(coupon, loyaltyConfig);
      const definition = getCouponManagementGroupDefinition(managementGroup);
      getCouponRefCandidates(coupon).forEach((ref) => {
        map.set(ref, {
          label: definition.label,
          value: definition.value
        });
      });
      return map;
    }, new Map());
  }, [coupons, loyaltyConfig]);

  const recommendedGiftableVoucherCount = useMemo(() => {
    return giftableVouchers.filter((voucher) => (
      isBulkVoucherPicker
        ? isRecommendedVoucherForAudience(voucher, effectiveBulkAudience)
        : isRecommendedVoucherForCustomer(voucher, selectedCustomer || {})
    )).length;
  }, [effectiveBulkAudience, giftableVouchers, isBulkVoucherPicker, selectedCustomer]);

  const selectedCustomerPhoneKey = selectedCustomer?.phone ? getCustomerKey(selectedCustomer.phone) : "";

  const selectedOrders = useMemo(() => {
    const lifetimeOrders = selectedCustomerPhoneKey ? detailOrdersByPhone[selectedCustomerPhoneKey] : null;
    const orders = Array.isArray(lifetimeOrders) && lifetimeOrders.length
      ? lifetimeOrders
      : Array.isArray(selectedCustomer?.orders)
        ? selectedCustomer.orders
        : [];
    return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [detailOrdersByPhone, selectedCustomer, selectedCustomerPhoneKey]);

  const selectedDetailOrderLimit = selectedCustomerPhoneKey
    ? detailOrderLimitByPhone[selectedCustomerPhoneKey] || INITIAL_DETAIL_ORDER_LIMIT
    : INITIAL_DETAIL_ORDER_LIMIT;
  const visibleDetailOrders = selectedCustomer
    ? selectedOrders.slice(0, selectedDetailOrderLimit)
    : [];
  const isSelectedDetailLoading = Boolean(
    selectedCustomerPhoneKey && detailLoadingByPhone[selectedCustomerPhoneKey]
  );

  useEffect(() => {
    let disposed = false;
    const phone = selectedCustomerPhoneKey;
    if (!phone) return () => {
      disposed = true;
    };
    setDetailOrderLimitByPhone((current) => ({
      ...current,
      [phone]: current[phone] || INITIAL_DETAIL_ORDER_LIMIT
    }));
    (async () => {
      setDetailLoadingByPhone((current) => ({ ...current, [phone]: true }));
      try {
        const rows = await getCustomerRecentOrdersAsync(phone, { limit: DETAIL_ORDER_FETCH_LIMIT });
        if (disposed) return;
        setDetailOrdersByPhone((current) => ({
          ...current,
          [phone]: rows
        }));
      } finally {
        if (!disposed) {
          setDetailLoadingByPhone((current) => ({ ...current, [phone]: false }));
        }
      }
    })();
    (async () => {
      setIsLoyaltyDetailLoading(true);
      try {
        const result = await getCustomerLoyaltyDetailAsync(phone, { limit: 100, offset: 0 });
        if (disposed) return;
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        const orderEarn = rows
          .filter((item) => ["ORDER_EARN", "PARTNER_ORDER_EARN"].includes(String(item?.type || "").toUpperCase()))
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
            accountTotalPoints: result?.accountTotalPoints === null || result?.accountTotalPoints === undefined
              ? null
              : Math.max(0, Number(result.accountTotalPoints || 0)),
            accountVouchers: Array.isArray(result?.accountVouchers) ? result.accountVouchers : [],
            accountUpdatedAt: result?.accountUpdatedAt || "",
            ledgerLoadFailed: result?.ledgerLoadFailed === true,
            accountLoadFailed: result?.accountLoadFailed === true,
            isLedgerPartial: Number(result?.total || rows.length) > rows.length
          }
        }));
      } finally {
        if (!disposed) setIsLoyaltyDetailLoading(false);
      }
    })();
    (async () => {
      const rows = await getCustomerOrderPointStatuses(phone, { limit: DETAIL_ORDER_FETCH_LIMIT }).catch(() => []);
      if (disposed) return;
      setOrderPointStatusRowsByPhone((current) => ({
        ...current,
        [phone]: Array.isArray(rows) ? rows : []
      }));
    })();
    return () => {
      disposed = true;
    };
  }, [selectedCustomerPhoneKey]);

  const selectedLoyaltyDetail = selectedCustomerPhoneKey
    ? loyaltyDetailByPhone[selectedCustomerPhoneKey] || null
    : null;
  const selectedCurrentPoints = Number(
    (selectedLoyaltyDetail?.accountTotalPoints ?? selectedCustomer?.currentPoints) || 0
  );
  const selectedPointRows = selectedLoyaltyDetail?.rows || selectedCustomer?.pointsHistory || [];
  const selectedPointLookup = useMemo(
    () => buildLoyaltyOrderPointLookup(selectedPointRows),
    [selectedPointRows]
  );
  const selectedOrderPointStatusMap = useMemo(
    () => buildCustomerOrderPointStatusMap(
      selectedCustomerPhoneKey ? orderPointStatusRowsByPhone[selectedCustomerPhoneKey] || [] : []
    ),
    [orderPointStatusRowsByPhone, selectedCustomerPhoneKey]
  );
  const selectedPointSummary = useMemo(
    () => getOrderPointSummary(selectedOrders, selectedOrderPointStatusMap, selectedPointLookup),
    [selectedOrderPointStatusMap, selectedOrders, selectedPointLookup]
  );
  const selectedCarePlan = useMemo(
    () => getCustomerCarePlan(selectedCustomer || {}),
    [selectedCustomer]
  );

  const sortedSelectedVouchers = useMemo(() => {
    const vouchers = mergeVoucherLists(
      Array.isArray(selectedCustomer?.vouchers) ? selectedCustomer.vouchers : [],
      Array.isArray(selectedLoyaltyDetail?.accountVouchers) ? selectedLoyaltyDetail.accountVouchers : []
    );
    return [...vouchers].sort((a, b) => {
      const weightDiff = getVoucherSortWeight(a) - getVoucherSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [selectedCustomer?.vouchers, selectedLoyaltyDetail?.accountVouchers]);

  const toggleSelectedPhone = (phone) => {
    const key = String(phone || "").trim();
    if (!key || !registeredCustomerPhoneSet.has(key)) return;
    setSelectedPhones((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };

  const selectAllFilteredCustomers = () => {
    setSelectedPhones((current) => Array.from(new Set([...current, ...filteredCustomerPhones])));
  };

  const selectVisibleCustomers = () => {
    setSelectedPhones((current) => Array.from(new Set([...current, ...visibleCustomerPhones])));
  };

  const clearSelectedCustomers = () => {
    setSelectedPhones([]);
  };

  const closeManualSelectionMode = () => {
    setSelectedPhones([]);
    setIsManualSelectionMode(false);
  };

  const applyCampaignPreset = (preset) => {
    if (!preset) return;
    const targetPhones = (crmSnapshot.customers || [])
      .filter((customer) => (
        Boolean(customer?.registeredCustomer) &&
        matchesCustomerFilterSelection(customer, preset.filterValue, tierFilterOptions)
      ))
      .map((customer) => String(customer?.phone || "").trim())
      .filter(Boolean);

    setCampaignSelectedPhones(targetPhones);
    setCampaignPreviewKeyword("");
    setActiveBulkCampaign(preset);
  };

  const openSingleVoucherPicker = () => {
    if (!selectedCustomer?.registeredCustomer) return;
    setActiveBulkCampaign(null);
    setVoucherPickerMode("single");
    setVoucherPickerOpen(true);
  };

  const openBulkVoucherPicker = ({ preserveCampaign = false } = {}) => {
    if (!selectedPhones.length) return;
    if (!preserveCampaign) {
      setActiveBulkCampaign(null);
    }
    setVoucherPickerMode("bulk");
    setVoucherPickerOpen(true);
  };

  const openCampaignVoucherPicker = () => {
    if (!campaignSelectedPhones.length || !activeBulkCampaign) return;
    setVoucherPickerMode("campaign");
    setVoucherPickerOpen(true);
  };

  const closeVoucherPicker = () => {
    setVoucherPickerOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setCustomerFilter("all");
    setBranchFilter("all");
    setChannelFilter("all");
    setSortBy("latest");
    setActiveBulkCampaign(null);
  };

  const handleRefreshCrm = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshCrm?.({ forceSupportRefresh: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section className="crm-page">
      <div className="crm-page-hero">
        <div>
          <p>CRM vận hành</p>
          <h2>Chăm sóc khách hàng</h2>
          <span>Tập trung vào nhóm cần gọi lại, khách quay lại và lịch sử mua gần nhất.</span>
        </div>
        <button
          type="button"
          className={`crm-refresh-btn ${isRefreshing ? "is-loading" : ""}`}
          onClick={handleRefreshCrm}
          disabled={isRefreshing}
        >
          <Icon name="back" size={16} />
          {isRefreshing ? "Đang tải..." : "Tải lại dữ liệu"}
        </button>
      </div>

      <div className="crm-stat-grid">
        <CrmStatCard icon="user" tone="orange" scope="Lifetime" title="Tổng khách hàng" value={summary.totalCustomers === null ? "--" : summary.totalCustomers.toLocaleString("vi-VN")} subtitle="Đếm hồ sơ customer từ profiles" />
        <CrmStatCard icon="heart" tone="blue" scope="30 ngày" title="Cần chăm sóc" value={summary.careCount.toLocaleString("vi-VN")} subtitle="Có đơn nhưng chưa quay lại" />
        <CrmStatCard icon="cart" tone="green" scope="30 ngày" title="Khách quay lại" value={summary.repeatCustomers30.toLocaleString("vi-VN")} subtitle="Khách có từ 2 đơn trở lên" />
        <CrmStatCard icon="user" tone="green" scope="7 / 30 ngày" title="Khách mới" value={`${summary.newCustomers7} / ${summary.newCustomers30}`} subtitle="Theo đơn mua đầu tiên" />
      </div>

      <div className="crm-ops-grid">
        <section className="crm-ops-card crm-ops-card--priority">
          <div className="crm-ops-head">
            <div>
              <h3>Ưu tiên chăm sóc</h3>
              <p>Nhóm khách nên xử lý trước theo dữ liệu mua hàng hiện tại.</p>
            </div>
            <span>{activeDateScope}</span>
          </div>
          <div className="crm-priority-list">
            {priorityRows.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`crm-priority-row crm-priority-row--${item.tone}`}
                onClick={() => {
                  setActiveViewTab("customers");
                  if (item.label.toLowerCase().includes("30")) setCustomerFilter("inactive30");
                  else if (item.label.toLowerCase().includes("15")) setCustomerFilter("inactive15");
                  else if (item.label.toLowerCase().includes("7")) setCustomerFilter("inactive7");
                  else setCustomerFilter("care");
                }}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </button>
            ))}
          </div>
          <div className="crm-ops-foot">
            <span>{tierFilterOptions.length.toLocaleString("vi-VN")} hạng thành viên</span>
            <span>Quay lại: {summary.repeatRate30}%</span>
          </div>
        </section>

        <CrmMemberRegistrationCard comparison={crmSnapshot.memberRegistrationComparison} />

        <section className="crm-ops-card">
          <div className="crm-ops-head">
            <div>
              <h3>Top khách</h3>
              <p>Nhìn nhanh khách có giá trị cao để chăm sóc riêng.</p>
            </div>
            <div className="crm-inline-tabs">
              <button type="button" className={topCustomerMode === "spent" ? "active" : ""} onClick={() => setTopCustomerMode("spent")}>Chi tiêu</button>
              <button type="button" className={topCustomerMode === "orders" ? "active" : ""} onClick={() => setTopCustomerMode("orders")}>Số đơn</button>
            </div>
          </div>
          <div className="crm-insight-list crm-top-customer-list">
            {topCustomers.map((item) => (
              <span key={item.phone}>
                <b>{item.name} · {item.phone}</b>
                <em>{topCustomerMode === "orders" ? `${Number(item.totalOrders || 0)} đơn` : formatMoney(item.totalSpent)}</em>
              </span>
            ))}
          </div>
        </section>

      </div>

      <div className="crm-view-tabs" role="tablist" aria-label="Điều hướng CRM">
        {crmViewTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeViewTab === tab.id}
            className={`crm-view-tab ${activeViewTab === tab.id ? "is-active" : ""}`}
            onClick={() => {
              setActiveViewTab(tab.id);
              if (tab.id !== "customers") closeManualSelectionMode();
            }}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>

      <div className={`crm-workspace ${activeViewTab === "customers" ? "" : "crm-workspace--single"}`}>
        <div className={`crm-list-panel crm-list-panel--${activeViewTab}`}>
          <section className="crm-tab-shell">
            <div className="crm-tab-shell__copy">
                  <span>{activeViewTabMeta.eyebrow}</span>
              <strong>{activeViewTabMeta.label}</strong>
              <p>{activeViewTabMeta.description}</p>
            </div>
            <div className="crm-tab-shell__meta">
              {activeViewTab === "customers" ? (
                <>
                  <b>{filteredCustomers.length.toLocaleString("vi-VN")} khách đang lọc</b>
                  <small>{selectedPhones.length.toLocaleString("vi-VN")} khách đang chọn</small>
                </>
              ) : null}
              {activeViewTab === "campaigns" ? (
                <>
                  <b>{campaignSelectedPhones.length.toLocaleString("vi-VN")} khách sẽ nhận</b>
                  <small>{activeBulkCampaign?.label || "Chưa chọn nhóm khách"}</small>
                </>
              ) : null}
              {activeViewTab === "history" ? (
                <>
                  <b>{bulkGiftHistorySummary.campaigns.toLocaleString("vi-VN")} đợt gửi</b>
                  <small>{bulkGiftHistorySummary.success.toLocaleString("vi-VN")} lượt thành công</small>
                </>
              ) : null}
            </div>
          </section>
          {activeViewTab === "customers" ? (
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
            <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
              <option value="all">Tất cả kênh mua</option>
              {(crmAnalytics?.filterOptions.channels || []).map((channel) => <option key={channel} value={channel}>{getChannelLabel(channel)}</option>)}
            </select>
            <select className="crm-segment-select" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
              <option value="all">Tất cả nhóm khách</option>
              <option value="new_member">Mới đăng ký chưa có đơn</option>
              <option value="registered">Khách đã đăng ký</option>
              <option value="tier_member">Khách có hạng thành viên</option>
              {tierFilterOptions.map((tier) => (
                <option key={tier.id} value={`tier:${tier.id}`}>{tier.label}</option>
              ))}
              <option value="care">Cần chăm sóc</option>
              <option value="inactive7">Chưa quay lại 7+ ngày</option>
              <option value="inactive15">Chưa quay lại 15+ ngày</option>
              <option value="inactive30">Chưa quay lại 30+ ngày</option>
            </select>
            <button type="button" className="crm-reset-btn" onClick={resetFilters}>Xóa lọc</button>
          </div>
          ) : null}

          {activeViewTab === "customers" ? (
          <div className="crm-segment-strip">
            {segmentQuickFilters.map((segment) => (
              <button
                key={segment.value}
                type="button"
                className={`crm-segment-chip ${customerFilter === segment.value ? "is-active" : ""}`}
                onClick={() => setCustomerFilter(segment.value)}
              >
                <span>{segment.label}</span>
                <strong>{segment.count.toLocaleString("vi-VN")}</strong>
              </button>
            ))}
          </div>
          ) : null}

          {activeViewTab === "campaigns" && campaignPresetCards.length ? (
            <section className="crm-campaign-panel">
              <div className="crm-campaign-panel__head">
                <div>
                  <span>Bước 1</span>
                  <strong>Chọn nhóm khách muốn gửi voucher</strong>
                  <p>Chỉ hiển thị khách đã đăng ký và có thể nhận voucher trong ví.</p>
                </div>
              </div>
              <div className="crm-campaign-grid">
                {campaignPresetCards.map((preset) => (
                  <article
                    key={preset.id}
                    className={`crm-campaign-card crm-campaign-card--${preset.tone || "default"} ${activeBulkCampaign?.id === preset.id ? "is-active" : ""}`}
                  >
                    <div>
                      <strong>{preset.label}</strong>
                      <small>{preset.description}</small>
                    </div>
                    <b>{preset.count.toLocaleString("vi-VN")} khách</b>
                    <div className="crm-campaign-card__actions">
                      <button
                        type="button"
                        className="crm-campaign-card__primary"
                        onClick={() => applyCampaignPreset(preset)}
                        disabled={!preset.count}
                      >
                        {activeBulkCampaign?.id === preset.id ? "Đang chọn nhóm này" : "Chọn nhóm này"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeViewTab === "campaigns" && activeBulkCampaign ? (
            <section className="crm-campaign-audience">
              <div className="crm-campaign-audience__head">
                <div>
                  <span>Bước 2</span>
                  <strong>Kiểm tra khách sẽ nhận</strong>
                  <p>Danh sách này độc lập với tab Danh sách khách. Bỏ chọn nếu có khách anh chưa muốn gửi.</p>
                </div>
                <div className="crm-campaign-audience__count">
                  <b>{campaignSelectedPhones.length.toLocaleString("vi-VN")}</b>
                  <small>/ {campaignTargetCustomers.length.toLocaleString("vi-VN")} khách</small>
                </div>
              </div>

              <div className="crm-campaign-summary__stats">
                <article className="crm-campaign-stat">
                  <small>Nhóm đang chọn</small>
                  <strong>{activeBulkCampaign.label}</strong>
                </article>
                <article className="crm-campaign-stat">
                  <small>Sẽ nhận voucher</small>
                  <strong>{campaignSelectedPhones.length.toLocaleString("vi-VN")} khách</strong>
                </article>
                <article className="crm-campaign-stat">
                  <small>Đã bỏ khỏi danh sách</small>
                  <strong>{Math.max(0, campaignTargetCustomers.length - campaignSelectedPhones.length).toLocaleString("vi-VN")} khách</strong>
                </article>
              </div>

              <div className="crm-campaign-preview-tools">
                <label className="crm-search">
                  <Icon name="search" size={17} />
                  <input
                    placeholder="Tìm trong nhóm đang chọn..."
                    value={campaignPreviewKeyword}
                    onChange={(event) => setCampaignPreviewKeyword(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setCampaignSelectedPhones(
                    campaignTargetCustomers
                      .map((customer) => String(customer?.phone || "").trim())
                      .filter(Boolean)
                  )}
                  disabled={campaignSelectedPhones.length === campaignTargetCustomers.length}
                >
                  Chọn lại toàn bộ
                </button>
              </div>

              <div className="crm-campaign-preview-list">
                {visibleCampaignPreviewCustomers.map((customer) => (
                  <article key={customer.phone}>
                    <CustomerIdentity customer={customer} />
                    <div className="crm-campaign-preview-meta">
                      <span>{getCustomerReturnLabel(customer)}</span>
                      <small>{Number(customer.totalOrders || 0).toLocaleString("vi-VN")} đơn · {formatMoney(customer.totalSpent)}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCampaignSelectedPhones((current) => current.filter((phone) => phone !== customer.phone))}
                      aria-label={`Bỏ khách ${customer.name || customer.phone || ""} khỏi danh sách gửi`}
                    >
                      Bỏ
                    </button>
                  </article>
                ))}
                {!filteredCampaignPreviewCustomers.length ? (
                  <div className="crm-campaign-preview-empty">
                    {campaignSelectedPhones.length
                      ? "Không tìm thấy khách phù hợp trong nhóm đang chọn."
                      : "Anh đã bỏ toàn bộ khách khỏi danh sách gửi."}
                  </div>
                ) : null}
              </div>

              {filteredCampaignPreviewCustomers.length > visibleCampaignPreviewCustomers.length ? (
                <p className="crm-campaign-preview-note">
                  Đang hiện 40 / {filteredCampaignPreviewCustomers.length.toLocaleString("vi-VN")} khách. Anh có thể tìm theo tên hoặc số điện thoại.
                </p>
              ) : null}

              <div className="crm-campaign-next">
                <div>
                  <span>Bước 3</span>
                  <strong>Chọn voucher và xác nhận gửi</strong>
                  <small>Hệ thống vẫn kiểm tra voucher trùng trước khi tặng.</small>
                </div>
                <button
                  type="button"
                  className="crm-bulk-toolbar__primary"
                  onClick={openCampaignVoucherPicker}
                  disabled={!campaignSelectedPhones.length || isBulkGifting}
                >
                  {isBulkGifting ? "Đang tặng..." : `Tiếp tục với ${campaignSelectedPhones.length.toLocaleString("vi-VN")} khách`}
                </button>
              </div>
            </section>
          ) : null}

          {activeViewTab === "campaigns" && !activeBulkCampaign ? (
            <div className="crm-campaign-empty">
              <Icon name="gift" size={26} />
              <div>
                <strong>Chưa chọn nhóm khách</strong>
                <p>Chọn một nhóm ở Bước 1 để xem chính xác ai sẽ nhận voucher.</p>
              </div>
            </div>
          ) : null}

          {activeViewTab === "customers" ? (
          <div className="crm-result-row">
            <p className="crm-result-summary">
              Hiển thị {visibleCustomers.length} / {filteredCustomers.length} khách theo bộ lọc hiện tại.
            </p>
            {!isManualSelectionMode ? (
              <button
                type="button"
                className="crm-start-selection-btn"
                onClick={() => setIsManualSelectionMode(true)}
                disabled={!registeredCustomerPhoneSet.size}
              >
                Chọn nhiều khách
              </button>
            ) : null}
          </div>
          ) : null}

          {activeViewTab === "customers" && isManualSelectionMode ? (
          <div className="crm-bulk-toolbar">
            <div className="crm-bulk-toolbar__summary">
              <strong>Đã chọn {selectedPhones.length.toLocaleString("vi-VN")} khách</strong>
              <span>
                {selectedFilteredCount.toLocaleString("vi-VN")} khách trong bộ lọc hiện tại
                {filteredCustomers.length > visibleCustomers.length
                  ? ` · ${selectedVisibleCount.toLocaleString("vi-VN")} khách trên trang này`
                  : ""}
              </span>
            </div>
            <div className="crm-bulk-toolbar__actions">
              <button type="button" onClick={selectAllFilteredCustomers} disabled={!filteredCustomerPhones.length}>
                Chọn tất cả đang lọc
              </button>
              {filteredCustomers.length > visibleCustomers.length ? (
                <button type="button" onClick={selectVisibleCustomers} disabled={!visibleCustomerPhones.length}>
                  Chọn trang này
                </button>
              ) : null}
              <button type="button" onClick={clearSelectedCustomers} disabled={!selectedPhones.length}>
                Bỏ chọn hết
              </button>
              <button type="button" onClick={closeManualSelectionMode}>
                Đóng chọn nhiều
              </button>
              <button
                type="button"
                className="crm-bulk-toolbar__primary"
                onClick={openBulkVoucherPicker}
                disabled={!selectedPhones.length || isBulkGifting}
              >
                {isBulkGifting ? "Đang tặng..." : `Tặng voucher cho ${selectedPhones.length.toLocaleString("vi-VN")} khách`}
              </button>
            </div>
          </div>
          ) : null}

          {activeViewTab === "customers" ? (
          <div className={`crm-table ${isManualSelectionMode ? "is-selection-mode" : ""}`}>
            <div className="crm-table-head">
              {isManualSelectionMode ? <span>Chọn</span> : null}
              <span>Khách hàng</span>
              <span>Trạng thái</span>
              <span>Lần mua cuối</span>
              <span>Giá trị</span>
              <span>Hành động</span>
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
                    {isManualSelectionMode ? (
                      <span className="crm-row-select">
                        {customer.registeredCustomer ? (
                          <span
                            role="checkbox"
                            aria-checked={selectedPhoneSet.has(customer.phone)}
                            tabIndex={-1}
                            className={selectedPhoneSet.has(customer.phone) ? "is-checked" : ""}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelectedPhone(customer.phone);
                            }}
                            aria-label={`Chọn khách ${customer.name || customer.phone || ""}`}
                            title="Chọn khách để tặng voucher"
                          >
                            {selectedPhoneSet.has(customer.phone) ? "✓" : ""}
                          </span>
                        ) : (
                          <span className="is-placeholder" aria-hidden="true" />
                        )}
                      </span>
                    ) : null}
                    <CustomerIdentity customer={customer} insight={getCustomerInsight(customer)} />
                    <span className="crm-badge-stack">
                      <em className={`crm-soft-badge ${getCustomerTypeClass(customer)}`}>{getCustomerTypeLabel(customer)}</em>
                      {getCustomerTierName(customer) ? (
                        <em className={`crm-tier-badge ${getCustomerTierBadgeClass(customer, tierFilterOptions)}`}>
                          {getCustomerTierName(customer)}
                        </em>
                      ) : null}
                      {getCustomerSegmentBadges(customer).slice(0, 1).map((badge) => (
                        <em key={badge.key} className="crm-soft-badge crm-soft-badge--segment">{badge.label}</em>
                      ))}
                      {needsCare(customer) ? <em className="crm-soft-badge crm-soft-badge--care">Cần chăm sóc</em> : null}
                    </span>
                    <span className="crm-row-metric">
                      <small>Lần mua cuối</small>
                      <strong>{formatListDateTime(customer.lastOrderAt)}</strong>
                    </span>
                    <span className="crm-row-metric">
                      <small>{Number(customer.totalOrders || 0).toLocaleString("vi-VN")} đơn</small>
                      <strong>{formatMoney(customer.totalSpent)}</strong>
                    </span>
                    <span className="crm-row-action">
                      <em>{formatCustomerPoints(customer)} điểm</em>
                      <strong>{getCustomerActionLabel(customer)}</strong>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          ) : null}

          {activeViewTab === "customers" && filteredCustomers.length === 0 && (
            <div className="crm-empty-state">
              <Icon name="user" size={28} />
              <p>Chưa có khách hàng phù hợp với bộ lọc.</p>
            </div>
          )}

          {activeViewTab === "history" ? (
            <section className="crm-history-overview">
              <article className="crm-history-overview-card">
                <small>Đợt gửi</small>
                <strong>{bulkGiftHistorySummary.campaigns.toLocaleString("vi-VN")}</strong>
              </article>
              <article className="crm-history-overview-card">
                <small>Lượt thành công</small>
                <strong>{bulkGiftHistorySummary.success.toLocaleString("vi-VN")}</strong>
              </article>
              <article className="crm-history-overview-card">
                <small>Bị chặn trùng</small>
                <strong>{bulkGiftHistorySummary.duplicates.toLocaleString("vi-VN")}</strong>
              </article>
              <article className="crm-history-overview-card">
                <small>Lỗi khác</small>
                <strong>{bulkGiftHistorySummary.failed.toLocaleString("vi-VN")}</strong>
              </article>
            </section>
          ) : null}

          {activeViewTab === "history" && bulkGiftHistory.length ? (
            <section className="crm-history-panel">
              <div className="crm-history-panel__head">
                <div>
                  <span>Lịch sử bulk gift</span>
                  <strong>Các lần tặng voucher hàng loạt gần đây</strong>
                </div>
              </div>
              <div className="crm-history-list">
                {bulkGiftHistory.slice(0, 6).map((entry) => {
                  const duplicateCount = Number(entry.duplicateCount || 0);
                  const unregisteredCount = Number(entry.unregisteredCount || 0);
                  const otherFailedCount = Math.max(0, Number(entry.failedCount || 0) - duplicateCount - unregisteredCount);
                  return (
                    <article key={entry.id}>
                      <div>
                        <strong>{entry.campaignLabel || "Tặng theo bộ lọc CRM"}</strong>
                        <small>{entry.sourceLabel || "CRM - gửi theo nhóm"} · {entry.voucherCode || "--"} · {entry.voucherName || "Voucher CRM"}</small>
                      </div>
                      <div className="crm-history-meta">
                        <em>{formatDateTime(entry.createdAt)}</em>
                        <span>
                          {entry.successCount}/{entry.totalRecipients} thành công
                          {duplicateCount ? ` · trùng ${duplicateCount}` : ""}
                          {unregisteredCount ? ` · chưa đăng ký ${unregisteredCount}` : ""}
                          {otherFailedCount ? ` · lỗi ${otherFailedCount}` : ""}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeViewTab === "history" && !bulkGiftHistory.length ? (
            <div className="crm-empty-state">
              <Icon name="gift" size={28} />
              <p>Chưa có lịch sử gửi voucher hàng loạt.</p>
            </div>
          ) : null}

          {activeViewTab === "customers" && filteredCustomers.length > CUSTOMER_PAGE_SIZE ? (
            <CrmCompactPagination
              page={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              pageSize={CUSTOMER_PAGE_SIZE}
              onChange={setCurrentPage}
            />
          ) : null}
        </div>

        {activeViewTab === "customers" ? (
        <aside className={`crm-detail-panel ${selectedCustomer ? "is-open" : ""}`}>
          {selectedCustomer ? (
            <>
              <div className="crm-detail-head">
                <button type="button" className="crm-detail-close" onClick={() => setSelectedCustomerPhone("")}>×</button>
                <CustomerIdentity customer={selectedCustomer} compact />
                <div className="crm-detail-badges">
                  <em className={`crm-soft-badge ${getCustomerTypeClass(selectedCustomer)}`}>{getCustomerTypeLabel(selectedCustomer)}</em>
                  {getCustomerTierName(selectedCustomer) ? (
                    <em className={`crm-tier-badge ${getCustomerTierBadgeClass(selectedCustomer, tierFilterOptions)}`}>
                      {getCustomerTierName(selectedCustomer)}
                    </em>
                  ) : null}
                  {needsCare(selectedCustomer) ? <em className="crm-soft-badge crm-soft-badge--care">Cần chăm sóc</em> : null}
                </div>
              </div>

              <div className="crm-detail-scroll">
                <section className={`crm-care-plan crm-care-plan--${selectedCarePlan.tone}`}>
                  <span>{selectedCarePlan.label}</span>
                  <strong>{selectedCarePlan.title}</strong>
                  {selectedCarePlan.description ? <p>{selectedCarePlan.description}</p> : null}
                  {getCustomerSegmentBadges(selectedCustomer).length ? (
                    <div className="crm-care-plan-tags">
                      {getCustomerSegmentBadges(selectedCustomer).map((badge) => (
                        <em key={badge.key}>{badge.label}</em>
                      ))}
                    </div>
                  ) : null}
                </section>

                <div className="crm-detail-metrics">
                  <article><small>Tổng đơn hàng</small><strong>{Number(selectedCustomer.totalOrders || 0).toLocaleString("vi-VN")}</strong></article>
                  <article><small>Tổng chi tiêu</small><strong>{formatMoney(selectedCustomer.totalSpent)}</strong></article>
                  <article><small>Lần mua cuối</small><strong>{formatDateTime(selectedCustomer.lastOrderAt)}</strong></article>
                  <article><small>Nhịp quay lại</small><strong>{getCustomerReturnLabel(selectedCustomer)}</strong></article>
                </div>

                <section className="crm-detail-card crm-loyalty-card">
                  <div className="crm-card-title">
                    <Icon name="gift" size={17} />
                    <h3>Loyalty</h3>
                  </div>
                  {selectedCustomer.registeredCustomerName && selectedCustomer.orderCustomerName ? (
                    <div className="crm-loyalty-names">
                      <span>Tài khoản: {selectedCustomer.registeredCustomerName}</span>
                      <span>Đơn gần nhất: {selectedCustomer.orderCustomerName}</span>
                    </div>
                  ) : null}
                  <div className="crm-points-line">
                    <span>Điểm hiện tại</span>
                    <strong>{selectedCurrentPoints.toLocaleString("vi-VN")}</strong>
                  </div>
                  <div className="crm-point-status-grid">
                    <span className="crm-point-status crm-point-status--claimed">Đã tích điểm: {selectedPointSummary.claimed.toLocaleString("vi-VN")} đơn</span>
                    <span className="crm-point-status crm-point-status--pending">Chờ tích điểm: {selectedPointSummary.pending.toLocaleString("vi-VN")} đơn</span>
                    {selectedPointSummary.blocked > 0 ? (
                      <span className="crm-point-status crm-point-status--blocked">Không tích điểm: {selectedPointSummary.blocked.toLocaleString("vi-VN")} đơn</span>
                    ) : null}
                    {selectedPointSummary.unknown > 0 ? (
                      <span className="crm-point-status crm-point-status--unknown">Chưa rõ: {selectedPointSummary.unknown.toLocaleString("vi-VN")} đơn</span>
                    ) : null}
                  </div>
                  <details className="crm-loyalty-breakdown">
                    <summary>
                      <span>Chi tiết điểm</span>
                      <em>{isLoyaltyDetailLoading && !selectedLoyaltyDetail ? "Đang tải..." : "Mở"}</em>
                    </summary>
                    <div className="crm-points-grid">
                      <span>Từ đơn hàng: {isLoyaltyDetailLoading && !selectedLoyaltyDetail ? "Đang tải..." : Number((selectedLoyaltyDetail?.orderEarn ?? 0) || 0).toLocaleString("vi-VN")}</span>
                      <span>Điểm danh/thưởng: {isLoyaltyDetailLoading && !selectedLoyaltyDetail ? "Đang tải..." : Number((selectedLoyaltyDetail?.checkin ?? selectedCustomer.checkinAndRewardPoints) || 0).toLocaleString("vi-VN")}</span>
                      <span>Đã dùng điểm: {isLoyaltyDetailLoading && !selectedLoyaltyDetail ? "Đang tải..." : `-${Number((selectedLoyaltyDetail?.spend ?? selectedCustomer.spentPoints) || 0).toLocaleString("vi-VN")}`}</span>
                      <span>Điều chỉnh khác: {isLoyaltyDetailLoading && !selectedLoyaltyDetail ? "Đang tải..." : Number((selectedLoyaltyDetail?.other ?? selectedCustomer.otherAdjustPoints) || 0).toLocaleString("vi-VN")}</span>
                    </div>
                  </details>
                </section>

                <section className="crm-detail-card">
                  <div className="crm-card-title">
                    <Icon name="bag" size={17} />
                    <div>
                      <h3>Lịch sử đơn gần đây</h3>
                      <small>{isSelectedDetailLoading ? "Đang tải đơn mới nhất..." : "Tải riêng khi chọn khách để giữ trang CRM nhẹ."}</small>
                    </div>
                  </div>
                  <div className="crm-mini-list">
                    {isSelectedDetailLoading && selectedOrders.length === 0 ? (
                      <div className="crm-loading-list" aria-label="Đang tải lịch sử đơn">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : null}
                    {visibleDetailOrders.map((order) => (
                      <article key={order.id || order.orderCode}>
                        <div>
                          <strong>{order.displayOrderCode || order.orderCode || order.id}</strong>
                          <OrderSourceBadge order={order} />
                          <small>{formatDateTime(order.createdAt)}</small>
                        </div>
                        <div>
                          <strong>{formatMoney(Number(order.totalAmount || order.total || 0))}</strong>
                          <em>{getOrderStatusLabel(order.status)}</em>
                          {(() => {
                            const pointStatus = getOrderPointStatus(order, selectedOrderPointStatusMap, selectedPointLookup);
                            return (
                              <em className={`crm-point-order-badge crm-point-order-badge--${pointStatus.key}`}>
                                {pointStatus.label}
                              </em>
                            );
                          })()}
                        </div>
                      </article>
                    ))}
                    {!isSelectedDetailLoading && selectedOrders.length === 0 && <p>Chưa có đơn hàng.</p>}
                  </div>
                  {selectedOrders.length > visibleDetailOrders.length && (
                    <button
                      type="button"
                      className="crm-link-btn"
                      onClick={() => setDetailOrderLimitByPhone((current) => {
                        const currentLimit = current[selectedCustomerPhoneKey] || INITIAL_DETAIL_ORDER_LIMIT;
                        const nextLimit = currentLimit < DETAIL_ORDER_PAGE_SIZE
                          ? DETAIL_ORDER_PAGE_SIZE
                          : currentLimit + DETAIL_ORDER_PAGE_SIZE;
                        return {
                          ...current,
                          [selectedCustomerPhoneKey]: nextLimit
                        };
                      })}
                    >
                      {`Xem thêm ${Math.min(DETAIL_ORDER_PAGE_SIZE, selectedOrders.length - visibleDetailOrders.length)} đơn`}
                    </button>
                  )}
                </section>

                <section className="crm-detail-card">
                  <div className="crm-card-title">
                    <Icon name="tag" size={17} />
                    <h3>Voucher đã tặng</h3>
                  </div>
                  <div className="crm-mini-list">
                    {!isLoyaltyDetailLoading && sortedSelectedVouchers.map((voucher) => {
                      const status = getVoucherStatus(voucher);
                      const voucherMeta = resolveGrantedVoucherMeta(voucher, couponMetaByRef);
                      const voucherSourceLabel = getVoucherGrantSourceLabel(voucher);
                      return (
                        <article key={voucher.id}>
                          <div>
                            <strong>{voucher.code ? `${voucher.code} - ${voucher.title}` : voucher.title}</strong>
                            <small>
                              {voucherMeta?.label ? `${voucherMeta.label} · ` : ""}
                              {voucherSourceLabel ? `${voucherSourceLabel} · ` : ""}
                              HSD: {voucher.expiredAt || "--"}
                            </small>
                          </div>
                          <div className="crm-voucher-row-actions">
                            <em className={status.className}>{status.label}</em>
                            {!voucher.used && !voucher.canceled ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await cancelCustomerVoucher?.(selectedCustomer.phone, voucher);
                                  } catch (error) {
                                    console.error("[crm] cancel voucher failed", error);
                                    window.alert("Hủy voucher thất bại. Anh kiểm tra quyền Supabase/RPC loyalty giúp em.");
                                  }
                                }}
                              >
                                Hủy
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                    {isLoyaltyDetailLoading && <p>Đang tải voucher...</p>}
                    {!isLoyaltyDetailLoading &&
                      selectedLoyaltyDetail?.accountLoadFailed &&
                      sortedSelectedVouchers.length === 0 && (
                        <p>Không tải được voucher. Vui lòng tải lại trang hoặc đăng nhập lại.</p>
                      )}
                    {!isLoyaltyDetailLoading &&
                      !selectedLoyaltyDetail?.accountLoadFailed &&
                      sortedSelectedVouchers.length === 0 && <p>Chưa có voucher.</p>}
                  </div>
                </section>
              </div>

              <div className="crm-detail-actions">
                <button
                  type="button"
                  onClick={openSingleVoucherPicker}
                  disabled={!selectedCustomer.registeredCustomer}
                  title={selectedCustomer.registeredCustomer ? "" : "Khách cần đăng ký tài khoản trước khi nhận voucher"}
                >
                  {selectedCustomer.registeredCustomer ? selectedCarePlan.actionLabel : "Khách chưa đăng ký"}
                </button>
              </div>
            </>
          ) : (
            <div className="crm-detail-empty">
              <Icon name="user" size={34} />
              <h3>Chọn một khách hàng</h3>
              <p>Thông tin chi tiết, loyalty, voucher và lịch sử đơn sẽ hiển thị tại đây.</p>
            </div>
          )}
        </aside>
        ) : null}
      </div>

      {voucherPickerOpen ? (
        <div className="crm-voucher-picker-backdrop" role="presentation" onClick={closeVoucherPicker}>
          <section className="crm-voucher-picker" role="dialog" aria-modal="true" aria-label="Chọn voucher CRM" onClick={(event) => event.stopPropagation()}>
            <div className="crm-voucher-picker-head">
              <div>
                <h3>{isBulkVoucherPicker ? "Tặng voucher cho nhiều khách" : "Chọn voucher CRM"}</h3>
                <p>
                  Chỉ hiển thị voucher thuộc nhóm CRM / chiến dịch riêng đang bật.
                  {isBulkVoucherPicker ? ` Đang áp dụng cho ${bulkRecipientPhones.length.toLocaleString("vi-VN")} khách đã chọn.` : ""}
                  {((isBulkVoucherPicker && effectiveVoucherAudience !== "all") || (voucherPickerMode === "single" && selectedCustomer))
                    ? ` Đang ưu tiên nhóm ${getVoucherAudienceDefinition(effectiveVoucherAudience).label.toLowerCase()}.`
                    : ""}
                </p>
              </div>
              <button type="button" onClick={closeVoucherPicker}>×</button>
            </div>
            <div className="crm-voucher-picker-list">
              {recommendedGiftableVoucherCount > 0 && effectiveVoucherAudience !== "all" ? (
                <p className="crm-voucher-picker-note crm-voucher-picker-note--strong">
                  Có {recommendedGiftableVoucherCount} voucher đang khớp với nhóm này: {getVoucherAudienceDefinition(effectiveVoucherAudience).label}.
                </p>
              ) : null}
              {autoManagedVoucherCount > 0 ? (
                <p className="crm-voucher-picker-note">
                  Đang ẩn {autoManagedVoucherCount} voucher loyalty tự động để tránh tặng nhầm trong CRM.
                </p>
              ) : null}
              {giftableVouchers.map((voucher) => {
                const audienceLabel = getVoucherAudienceDefinition(voucher?.campaignAudience || "all").label;
                const isRecommended = isBulkVoucherPicker
                  ? isRecommendedVoucherForAudience(voucher, effectiveBulkAudience)
                  : isRecommendedVoucherForCustomer(voucher, selectedCustomer || {});
                return (
                  <button
                    key={voucher.id || voucher.code}
                    type="button"
                    className={isRecommended ? "is-recommended" : ""}
                    onClick={async () => {
                      try {
                        if (isBulkVoucherPicker) {
                          setIsBulkGifting(true);
                          const result = await bulkGiftVoucherToCustomers?.(bulkRecipientPhones, voucher, currentBulkCampaignMeta);
                          const failedPhones = Array.isArray(result?.failedPhones) ? result.failedPhones : [];
                          const duplicateCount = Number(result?.duplicateCount || 0);
                          const unregisteredCount = Number(result?.unregisteredCount || 0);
                          const failedSet = new Set(failedPhones.map((phone) => String(phone || "").trim()));
                          if (voucherPickerMode === "campaign") {
                            setCampaignSelectedPhones((current) => current.filter((phone) => failedSet.has(String(phone || "").trim())));
                            if (!failedSet.size) {
                              setActiveBulkCampaign(null);
                            }
                          } else {
                            setSelectedPhones((current) => current.filter((phone) => failedSet.has(String(phone || "").trim())));
                          }
                          if (result?.historyEntry) {
                            setBulkGiftHistory((current) => [result.historyEntry, ...(Array.isArray(current) ? current : [])].slice(0, 30));
                          }
                          setIsBulkGifting(false);
                          closeVoucherPicker();

                          const successCount = Number(result?.successCount || 0);
                          const failedCount = Number(result?.failedCount || 0);
                          const otherFailedCount = Math.max(0, failedCount - duplicateCount - unregisteredCount);
                          if (failedCount > 0) {
                            const failureNotes = [
                              duplicateCount ? `${duplicateCount} khách bị chặn trùng` : "",
                              unregisteredCount ? `${unregisteredCount} khách chưa đăng ký` : "",
                              otherFailedCount ? `${otherFailedCount} khách lỗi khác` : ""
                            ].filter(Boolean);
                            window.alert(`Đã tặng ${successCount} khách. ${failureNotes.join(", ")}. Em giữ lại danh sách chưa xử lý để anh kiểm tra.`);
                          } else {
                            window.alert(`Đã tặng voucher cho ${successCount} khách.`);
                          }
                          return;
                        }

                        await giftVoucherToCustomer(selectedCustomer.phone, voucher);
                        closeVoucherPicker();
                      } catch (error) {
                        setIsBulkGifting(false);
                        console.error("[crm] gift voucher failed", error);
                        if (String(error?.message || "") === "LOYALTY_AUTO_VOUCHER_NOT_ALLOWED_IN_CRM") {
                          window.alert("Voucher loyalty tự động không được tặng tay trong CRM. Anh chọn voucher thuộc nhóm CRM / chiến dịch riêng giúp em.");
                          return;
                        }
                        if (String(error?.code || error?.message || "") === "CRM_DUPLICATE_ACTIVE_VOUCHER") {
                          window.alert("Khách này đã có voucher này còn hiệu lực rồi nên hệ thống chặn tặng trùng.");
                          return;
                        }
                        if (String(error?.code || error?.message || "") === "CRM_CUSTOMER_NOT_REGISTERED") {
                          window.alert("Khách này chưa đăng ký tài khoản nên chưa thể nhận voucher vào ví.");
                          return;
                        }
                        window.alert("Tặng voucher thất bại. Anh kiểm tra quyền Supabase/RPC loyalty giúp em.");
                      }
                    }}
                  >
                    <span>
                      <strong>{voucher.code}</strong>
                      <small>{getGiftableVoucherTypeLabel(voucher, loyaltyConfig)} · {voucher.name || "Voucher CRM"}</small>
                      <p>
                        {voucher.campaignLabel || audienceLabel} · {audienceLabel}
                        {isRecommended ? " · Phù hợp khách này" : ""}
                      </p>
                    </span>
                    <em>{formatVoucherDiscount(voucher)}</em>
                  </button>
                );
              })}
              {!giftableVouchers.length ? (
                <p>Chưa có voucher CRM / chiến dịch riêng đang bật. Anh tạo voucher loyalty và chọn đúng nhóm quản trị trước nhé.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
