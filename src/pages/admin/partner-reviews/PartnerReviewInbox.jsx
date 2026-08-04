import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { formatMoney } from "../../../utils/format.js";
import { AdminBadge, AdminButton, AdminCard } from "../ui/AdminCommon.jsx";
import {
  branchTone,
  formatReviewDate,
  platformName,
  ratingTone,
  textValue
} from "./partnerReviewUi.js";

const REVIEWS_PER_PAGE = 10;
const STALE_ACTIVE_ORDER_STATUSES = new Set([
  "awaiting_payment", "pending", "scheduled", "preparing", "active", "ready", "delivering"
]);

function hasContent(review) {
  return Boolean(textValue(review?.content));
}

function isPublicReview(review) {
  return textValue(review?.review_status).toUpperCase() !== "REMOVED";
}

function isAttentionReview(review) {
  return isPublicReview(review) && Number(review?.rating) > 0 && Number(review?.rating) <= 3;
}

function optionLabels(options) {
  const values = Array.isArray(options) ? options : options && typeof options === "object" ? Object.values(options) : [];
  return values.flatMap((option) => {
    if (typeof option === "string") return option;
    if (!option || typeof option !== "object") return [];
    const label = textValue(option.name || option.label || option.optionName || option.option_name);
    const value = textValue(option.value || option.optionValue || option.option_value);
    return [label && value && label !== value ? `${label}: ${value}` : label || value].filter(Boolean);
  });
}

function reviewOrderStatus(order) {
  const sourceStatus = textValue(order?.order_status).toLowerCase();
  if (["completed", "complete", "done", "delivered", "success"].includes(sourceStatus)) {
    return { label: "Đã hoàn tất", sourceStatus: "" };
  }
  if (STALE_ACTIVE_ORDER_STATUSES.has(sourceStatus)) {
    return { label: "Đã hoàn tất", sourceStatus: order.order_status };
  }
  if (["cancelled", "canceled", "failed"].includes(sourceStatus)) {
    return { label: "Đã hủy", sourceStatus: "" };
  }
  return { label: order?.order_status || "Chưa rõ", sourceStatus: "" };
}

function ReviewDetailDrawer({ review, initialTab, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const order = review?.linked_order;
  const customer = review?.customer_insights;
  const orderStatus = reviewOrderStatus(order);

  useEffect(() => setTab(initialTab), [initialTab, review?.id]);
  if (!review) return null;

  return (
    <div className="admin-review-detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="admin-review-detail-panel" aria-label="Chi tiết đánh giá" onMouseDown={(event) => event.stopPropagation()}>
        <header className="admin-review-detail-head">
          <div>
            <span className={`admin-review-detail-rating is-${ratingTone(review.rating)}`}>
              {review.rating || 0}<Icon name="star" size={15} />
            </span>
            <div>
              <h2>{review.customer_display_name || "Khách đối tác"}</h2>
              <p>{formatReviewDate(review.review_created_at)} · {review.branch_code || "Chưa rõ chi nhánh"}</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={19} /></button>
        </header>

        <blockquote>{review.content || "Khách không để lại nội dung."}</blockquote>

        <div className="admin-review-detail-tabs" role="tablist" aria-label="Nội dung chi tiết">
          <button type="button" className={tab === "order" ? "is-active" : ""} onClick={() => setTab("order")}>Đơn hàng</button>
          <button type="button" className={tab === "customer" ? "is-active" : ""} onClick={() => setTab("customer")}>Khách hàng</button>
        </div>

        {tab === "order" ? (
          order ? (
            <div className="admin-review-order-detail">
              <div className="admin-review-detail-metrics is-order">
                <div><span>Mã đơn</span><strong>{order.order_code || order.nexpos_order_id || "--"}</strong></div>
                <div><span>Thành tiền</span><strong>{formatMoney(order.total_amount || 0)}</strong></div>
                <div>
                  <span>Trạng thái</span>
                  <strong>{orderStatus.label}</strong>
                  {orderStatus.sourceStatus ? <small className="admin-review-status-source">Đồng bộ cũ: {orderStatus.sourceStatus}</small> : null}
                </div>
                <div><span>Thời gian</span><strong>{formatReviewDate(order.order_time)}</strong></div>
                <div><span>Số điện thoại</span><strong>{order.customer_phone || order.customer_phone_masked || "Chưa có"}</strong></div>
              </div>
              <section>
                <div className="admin-review-detail-section-head">
                  <h3>Món trong đơn</h3>
                  <span>{order.items?.length || 0} món</span>
                </div>
                <div className="admin-review-order-items">
                  {(order.items || []).map((item) => {
                    const labels = optionLabels(item.options);
                    return (
                      <article key={item.id || `${item.name}-${item.quantity}`}>
                        <div><strong>{item.name}</strong><span>x{item.quantity || 1}</span></div>
                        <b>{formatMoney(item.line_total || 0)}</b>
                        {labels.length ? <small>{labels.join(" · ")}</small> : null}
                        {item.note ? <small>Ghi chú: {item.note}</small> : null}
                      </article>
                    );
                  })}
                  {!order.items?.length ? <p className="admin-review-detail-empty">Đơn này chưa có chi tiết món.</p> : null}
                </div>
              </section>
            </div>
          ) : <p className="admin-review-detail-empty">Chưa ghép được đánh giá này với đơn hàng.</p>
        ) : (
          customer ? (
            <div className="admin-review-customer-detail">
              <section className="admin-review-customer-profile">
                <span><Icon name="user" size={22} /></span>
                <div>
                  <h3>{customer.name || review.customer_display_name || "Khách đối tác"}</h3>
                  <p>{customer.phone || customer.phone_masked || "Chưa có số điện thoại"}</p>
                </div>
                {customer.member_rank ? <AdminBadge tone="info">Hạng {customer.member_rank}</AdminBadge> : null}
              </section>
              <div className="admin-review-detail-metrics">
                <div><span>Đã mua</span><strong>{customer.order_count || 0} đơn</strong></div>
                <div><span>Tổng chi tiêu</span><strong>{formatMoney(customer.total_spent || 0)}</strong></div>
                <div><span>Đã đánh giá</span><strong>{customer.review_count || 0} lần</strong></div>
                <div><span>Điểm trung bình</span><strong>{customer.average_rating || 0} sao</strong></div>
              </div>
              <div className="admin-review-customer-note">
                <Icon name={customer.low_rating_count ? "warning" : "check"} size={19} />
                <div>
                  <strong>{customer.low_rating_count ? `${customer.low_rating_count} đánh giá từ 3 sao trở xuống` : "Chưa ghi nhận đánh giá thấp"}</strong>
                  <span>Lần mua gần nhất: {formatReviewDate(customer.last_order_at)}</span>
                </div>
              </div>
              <p className="admin-review-detail-caption">Thống kê từ các đơn Web và đơn đối tác đã nhận diện được cùng khách hàng.</p>
            </div>
          ) : <p className="admin-review-detail-empty">Đơn hàng chưa có thông tin đủ để nhận diện khách.</p>
        )}
      </aside>
    </div>
  );
}

export default function PartnerReviewInbox({
  reviews = [],
  loading = false,
  sources = [],
  branchOptions = [],
  filters,
  onFilterChange,
  onRefresh
}) {
  const [view, setView] = useState("attention");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState(null);
  const [detailTab, setDetailTab] = useState("order");

  const metrics = useMemo(() => {
    const publicReviews = reviews.filter(isPublicReview);
    const ratings = publicReviews.map((review) => Number(review.rating)).filter((rating) => rating > 0);
    return {
      attention: publicReviews.filter(isAttentionReview).length,
      content: publicReviews.filter(hasContent).length,
      repeatCustomers: new Set(publicReviews
        .filter((review) => Number(review.customer_insights?.order_count) > 1)
        .map((review) => review.customer_insights?.profile_id || review.linked_order?.customer_phone_masked || review.id)).size,
      average: ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : "–"
    };
  }, [reviews]);

  const visibleReviews = useMemo(() => {
    const keyword = textValue(search).toLowerCase();
    return reviews.filter((review) => {
      if (view === "attention" && !isAttentionReview(review)) return false;
      if (view === "content" && !hasContent(review)) return false;
      if (!keyword) return true;
      return [
        review.customer_display_name,
        review.content,
        review.branch_code,
        review.source?.display_name,
        review.linked_order?.order_code,
        review.linked_order?.nexpos_order_id
      ].some((value) => textValue(value).toLowerCase().includes(keyword));
    });
  }, [reviews, search, view]);

  const pageCount = Math.max(1, Math.ceil(visibleReviews.length / REVIEWS_PER_PAGE));
  const pagedReviews = visibleReviews.slice((page - 1) * REVIEWS_PER_PAGE, page * REVIEWS_PER_PAGE);

  useEffect(() => setPage(1), [filters, search, view, reviews]);

  const openDetail = (review, tab) => {
    setSelectedReview(review);
    setDetailTab(tab);
  };

  return (
    <>
      <div className="admin-review-insight-grid">
        <article className={metrics.attention ? "is-danger" : ""}><span>Cần chú ý</span><strong>{metrics.attention}</strong><small>Đánh giá từ 1–3 sao</small></article>
        <article><span>Có nội dung</span><strong>{metrics.content}</strong><small>Phản hồi đọc được</small></article>
        <article><span>Khách quay lại</span><strong>{metrics.repeatCustomers}</strong><small>Đã mua từ 2 đơn</small></article>
        <article><span>Điểm trung bình</span><strong>{metrics.average}</strong><small>Trong dữ liệu gần đây</small></article>
      </div>

      <AdminCard className="admin-review-inbox">
        <div className="admin-review-inbox-head">
          <div>
            <span className="admin-review-eyebrow">Hộp thư đánh giá</span>
            <h2>Ưu tiên phản hồi cần xử lý</h2>
            <p>Mỗi đánh giá đã được ghép với đơn hàng và lịch sử mua của khách khi có đủ dữ liệu.</p>
          </div>
          <AdminButton type="button" variant="secondary" onClick={onRefresh} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? "Đang tải..." : "Làm mới"}
          </AdminButton>
        </div>

        <div className="admin-review-view-tabs" role="tablist" aria-label="Nhóm đánh giá">
          <button type="button" className={view === "attention" ? "is-active" : ""} onClick={() => setView("attention")}>
            Cần chú ý <span>{metrics.attention}</span>
          </button>
          <button type="button" className={view === "content" ? "is-active" : ""} onClick={() => setView("content")}>
            Có nội dung <span>{metrics.content}</span>
          </button>
          <button type="button" className={view === "all" ? "is-active" : ""} onClick={() => setView("all")}>
            Tất cả <span>{reviews.length}</span>
          </button>
        </div>

        <div className="admin-review-toolbar">
          <label className="admin-review-search">
            <Icon name="search" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách, nội dung hoặc mã đơn..." />
          </label>
          <label><span>Chi nhánh</span><select value={filters.branchUuid} onChange={(event) => onFilterChange("branchUuid", event.target.value)}><option value="">Tất cả chi nhánh</option>{branchOptions.map((branch) => <option key={branch.value} value={branch.value}>{branch.label}</option>)}</select></label>
          <label><span>Số sao</span><select value={filters.rating} onChange={(event) => onFilterChange("rating", event.target.value)}><option value="">Tất cả</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}</select></label>
          <label><span>Gian hàng</span><select value={filters.sourceId} onChange={(event) => onFilterChange("sourceId", event.target.value)}><option value="">Tất cả gian hàng</option>{sources.map((source) => <option key={source.id} value={source.id}>{[source.branch_code, source.display_name].filter(Boolean).join(" · ") || source.account_key}</option>)}</select></label>
        </div>

        {loading ? <div className="admin-review-loading"><span /><span /><span /></div> : null}
        {!loading && !pagedReviews.length ? <div className="admin-review-empty">Không có đánh giá phù hợp với nhóm và bộ lọc đang chọn.</div> : null}

        <div className="admin-review-inbox-list">
          {pagedReviews.map((review) => {
            const customer = review.customer_insights;
            const order = review.linked_order;
            const content = textValue(review.content);
            const tone = ratingTone(review.rating);
            return (
              <article key={review.id} className={`admin-review-inbox-item is-${tone}${content ? "" : " is-compact"}`}>
                <div className="admin-review-score"><strong>{review.rating || 0}</strong><Icon name="star" size={15} /><span>sao</span></div>
                <div className="admin-review-inbox-main">
                  <header>
                    <div>
                      <strong>{review.customer_display_name || "Khách đối tác"}</strong>
                      <span className={`admin-review-branch is-${branchTone(review.branch_code)}`}>{review.branch_code || "Chưa rõ CN"}</span>
                      <span className="admin-review-platform-chip">{platformName(review.platform)}</span>
                      {Number(customer?.order_count) > 1 ? <span className="admin-review-repeat-chip">Khách quay lại</span> : null}
                      {textValue(review.review_status).toUpperCase() === "REMOVED" ? <AdminBadge tone="neutral">Đã gỡ</AdminBadge> : null}
                    </div>
                    <time>{formatReviewDate(review.review_created_at)}</time>
                  </header>
                  <p className={content ? "" : "is-empty"}>{content || "Khách không để lại nội dung."}</p>
                  <footer>
                    <div className="admin-review-customer-quick-stats">
                      {customer ? <><span><b>{customer.order_count || 0}</b> đơn đã mua</span><span><b>{customer.review_count || 0}</b> lần đánh giá</span><span>TB <b>{customer.average_rating || 0}★</b></span></> : <span>Chưa nhận diện được khách</span>}
                    </div>
                    <div className="admin-review-inbox-actions">
                      <button type="button" disabled={!order} onClick={() => openDetail(review, "order")}><Icon name="eye" size={15} /> Xem đơn</button>
                      <button type="button" disabled={!customer} onClick={() => openDetail(review, "customer")}><Icon name="user" size={15} /> Hồ sơ khách</button>
                    </div>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && visibleReviews.length > REVIEWS_PER_PAGE ? (
          <div className="admin-review-pagination">
            <span>Trang {page}/{pageCount} · {visibleReviews.length} đánh giá</span>
            <div><AdminButton variant="secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</AdminButton><AdminButton variant="secondary" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Sau</AdminButton></div>
          </div>
        ) : null}
      </AdminCard>

      <ReviewDetailDrawer review={selectedReview} initialTab={detailTab} onClose={() => setSelectedReview(null)} />
    </>
  );
}
