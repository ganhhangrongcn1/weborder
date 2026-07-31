import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { processUploadImage } from "../../../utils/imageUpload.js";
import {
  getCustomerReviewRewards,
  submitReviewReward
} from "../../../services/reviewRewardService.js";

const SOURCE_LABELS = {
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  xanhngon: "Xanh Ngon"
};

const HISTORY_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ kiểm tra" },
  { id: "approved", label: "Đã nhận điểm" },
  { id: "rejected", label: "Chưa đạt" }
];
const REVIEW_REWARD_VIEW_KEY = "ghr_review_reward_view";

const STATUS_META = {
  pending: {
    label: "Chờ kiểm tra",
    description: "Gánh đang đối chiếu ảnh đánh giá."
  },
  processing: {
    label: "Đang xử lý",
    description: "Yêu cầu đang được ghi nhận điểm."
  },
  approved: {
    label: "Đã nhận điểm",
    description: "Điểm thưởng đã được cộng vào tài khoản."
  },
  rejected: {
    label: "Chưa đạt",
    description: "Ảnh chưa đủ thông tin để xác nhận đánh giá 5 sao."
  }
};

const ORDER_REWARD_META = {
  eligible: { label: "Còn thời hạn", className: "is-eligible" },
  expired: { label: "Đã hết thời hạn", className: "is-expired" },
  submitted: { label: "Đã gửi yêu cầu", className: "is-submitted" }
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function matchesHistoryFilter(claim, filter) {
  if (filter === "all") return true;
  if (filter === "pending") return ["pending", "processing"].includes(claim.status);
  return claim.status === filter;
}

function ReviewRewardLoading({ variant }) {
  return (
    <section
      className={`review-reward-panel review-reward-panel--${variant} review-reward-loading`}
      aria-label="Đang tải chương trình thưởng điểm"
      aria-busy="true"
    >
      {variant === "page" ? (
        <div className="review-reward-pagebar review-reward-loading__pagebar">
          <span className="review-reward-skeleton review-reward-skeleton--circle" />
          <div>
            <span className="review-reward-skeleton review-reward-skeleton--eyebrow" />
            <span className="review-reward-skeleton review-reward-skeleton--title" />
          </div>
        </div>
      ) : null}
      <div className="review-reward-loading__header">
        <span className="review-reward-skeleton review-reward-skeleton--icon" />
        <div>
          <span className="review-reward-skeleton review-reward-skeleton--heading" />
          <span className="review-reward-skeleton review-reward-skeleton--line" />
        </div>
      </div>
      <div className="review-reward-loading__body">
        <span className="review-reward-skeleton review-reward-skeleton--body-icon" />
        <span className="review-reward-skeleton review-reward-skeleton--heading" />
        <span className="review-reward-skeleton review-reward-skeleton--short-line" />
      </div>
    </section>
  );
}

export default function ReviewRewardPanel({
  variant = "embedded",
  showHistory = false,
  onBack,
  onLogin
}) {
  const [data, setData] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [activeView, setActiveView] = useState(() => {
    try {
      return window.sessionStorage.getItem(REVIEW_REWARD_VIEW_KEY) === "history"
        ? "history"
        : "submit";
    } catch {
      return "submit";
    }
  });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setMessage("");
    try {
      setData(await getCustomerReviewRewards());
    } catch (error) {
      setData(null);
      setLoadError({
        code: error?.code || "REQUEST_FAILED",
        message: error?.message || "Chưa tải được chương trình. Vui lòng thử lại."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(REVIEW_REWARD_VIEW_KEY);
    } catch {
    }
  }, []);

  const availableOrders = useMemo(
    () => (data?.orders || []).filter((order) => !order.locked),
    [data]
  );
  const reviewOrders = data?.orders || [];
  const selectedOrder = useMemo(
    () => reviewOrders.find((order) => order.id === selectedOrderId) || null,
    [reviewOrders, selectedOrderId]
  );
  const visibleClaims = useMemo(
    () => (data?.claims || []).filter((claim) => matchesHistoryFilter(claim, historyFilter)),
    [data, historyFilter]
  );

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Đang nén ảnh...");
    try {
      const processed = await processUploadImage(file, { maxWidth: 1280, quality: 0.68 });
      if (processed.size > 1048576) throw new Error("Ảnh vẫn lớn hơn 1 MB. Vui lòng chọn ảnh khác.");
      setProof({ ...processed, originalName: file.name });
      setMessage(`Đã nén ảnh còn ${Math.max(1, Math.round(processed.size / 1024))} KB.`);
    } catch (error) {
      setProof(null);
      setMessage(error.message);
    }
  };

  const submit = async () => {
    if (!selectedOrderId || !proof) {
      setMessage("Vui lòng chọn đơn và tải ảnh chụp đánh giá 5 sao.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReviewReward({
        partner_order_id: selectedOrderId,
        proof_data_url: proof.dataUrl,
        original_name: proof.originalName
      });
      setMessage(result.message);
      setSelectedOrderId("");
      setProof(null);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ReviewRewardLoading variant={variant} />;
  }
  if (!data?.settings?.enabled && data && variant !== "page") return null;

  return (
    <section
      className={`review-reward-panel review-reward-panel--${variant}`}
      aria-labelledby="review-reward-title"
    >
      {variant === "page" ? (
        <div className="review-reward-pagebar">
          <button type="button" onClick={onBack} aria-label="Quay về trang chủ">
            <Icon name="back" size={20} />
          </button>
          <div>
            <span>Gánh Hàng Rong</span>
            <h1>Nhận điểm từ đánh giá</h1>
          </div>
        </div>
      ) : null}

      <header>
        <span className="review-reward-icon"><Icon name="star" size={20} /></span>
        <div>
          <h2 id="review-reward-title">Gửi ảnh đánh giá, nhận 5.000đ</h2>
          <p>Gửi ảnh xong, Gánh sẽ báo kết quả trong 24–48 giờ nhé.</p>
        </div>
        {data?.settings ? (
          <strong>+{Number(data.settings.reward_points).toLocaleString("vi-VN")} điểm</strong>
        ) : null}
      </header>

      {showHistory && data ? (
        <div className="review-reward-view-tabs" role="tablist" aria-label="Chương trình đánh giá">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "submit"}
            className={activeView === "submit" ? "is-active" : ""}
            onClick={() => setActiveView("submit")}
          >
            Gửi đánh giá
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "history"}
            className={activeView === "history" ? "is-active" : ""}
            onClick={() => setActiveView("history")}
          >
            Kết quả đã gửi
          </button>
        </div>
      ) : null}

      {activeView === "submit" ? (!data ? (
        loadError?.code === "AUTH_REQUIRED" ? (
          <div className="review-reward-entry">
            <span className="review-reward-entry__icon"><Icon name="user" size={22} /></span>
            <div>
              <span className="review-reward-entry__eyebrow">Bắt đầu tại đây</span>
              <strong>Đăng nhập để tìm đơn đã hoàn tất</strong>
              <p>Dùng đúng số điện thoại đã đặt món trên GrabFood, ShopeeFood hoặc Xanh Ngon.</p>
            </div>
            {variant === "page" ? (
              <button type="button" className="review-reward-login" onClick={onLogin}>
                Đăng nhập và chọn đơn
              </button>
            ) : null}
          </div>
        ) : (
          <div className="review-reward-empty-state">
            <Icon name="clock" size={28} />
            <strong>Chưa tải được chương trình</strong>
            <p>Kết nối đang gián đoạn. Tài khoản của bạn vẫn được giữ nguyên.</p>
            <button type="button" className="review-reward-login" onClick={load}>
              Thử lại
            </button>
          </div>
        )
      ) : data.settings?.enabled === false ? (
        <div className="review-reward-empty-state">
          <Icon name="clock" size={28} />
          <strong>Chương trình đang tạm dừng</strong>
          <p>Những yêu cầu đã gửi vẫn được giữ nguyên và có thể xem trong lịch sử bên dưới.</p>
        </div>
      ) : reviewOrders.length ? (
        <>
          <div className="review-reward-section-title">
            <div>
              <h3>Chọn đơn bạn vừa đánh giá</h3>
              <p>Chọn đơn còn hạn để gửi ảnh nhé.</p>
            </div>
            <span>
              {availableOrders.length
                ? `${availableOrders.length} đơn còn hạn`
                : "Chưa có đơn còn hạn"}
            </span>
          </div>
          <div className={`review-reward-order-picker${ordersOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="review-reward-order-picker__trigger"
              aria-expanded={ordersOpen}
              aria-controls="review-reward-order-options"
              onClick={() => setOrdersOpen((current) => !current)}
            >
              <span>
                {selectedOrder ? (
                  <>
                    <strong>
                      {SOURCE_LABELS[selectedOrder.partner_source] || selectedOrder.partner_source}
                      {" · "}Đơn {selectedOrder.order_code}
                    </strong>
                    <small>{selectedOrder.branch_name}</small>
                  </>
                ) : (
                  <strong>Chọn đơn hàng</strong>
                )}
              </span>
              <Icon name="back" size={17} />
            </button>

            {ordersOpen ? (
              <div className="review-reward-orders" id="review-reward-order-options">
                {reviewOrders.map((order) => {
                  const rewardMeta = ORDER_REWARD_META[order.reward_status]
                    || (order.locked ? ORDER_REWARD_META.submitted : ORDER_REWARD_META.eligible);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      disabled={order.locked}
                      className={`${selectedOrderId === order.id ? "is-selected " : ""}${rewardMeta.className}`.trim()}
                      onClick={() => {
                        setSelectedOrderId(order.id);
                        setOrdersOpen(false);
                      }}
                    >
                      <span className="review-reward-order__topline">
                        <span>{SOURCE_LABELS[order.partner_source] || order.partner_source}</span>
                        <em>{rewardMeta.label}</em>
                      </span>
                      <strong>Đơn {order.order_code}</strong>
                      <small>{order.branch_name} · {formatDate(order.order_time)}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {selectedOrder ? (
            <>
              <label className="review-reward-upload">
                <input type="file" accept="image/*" onChange={handleImage} />
                {proof ? (
                  <img src={proof.dataUrl} alt="Ảnh đánh giá đã chọn" />
                ) : (
                  <>
                    <Icon name="star" size={22} />
                    <span>Chọn ảnh chụp có hiển thị đánh giá 5 sao</span>
                  </>
                )}
              </label>
              <button
                type="button"
                className="review-reward-submit"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Đang gửi..." : "Gửi ảnh để Gánh duyệt"}
              </button>
            </>
          ) : null}
        </>
      ) : (
        <div className="review-reward-empty-state">
          <Icon name="clock" size={28} />
          <strong>Tài khoản chưa có đơn đối tác phù hợp</strong>
          <p>Đơn GrabFood, ShopeeFood hoặc Xanh Ngon đã hoàn tất sẽ xuất hiện tại đây.</p>
        </div>
      )) : null}
      {activeView === "submit" && message && data ? <p className="review-reward-message" role="status">{message}</p> : null}

      {showHistory && data && activeView === "history" ? (
        <div className="review-reward-history">
          <div className="review-reward-section-title">
            <div>
              <h3>Lịch sử chương trình</h3>
              <p>Theo dõi kết quả kiểm tra và điểm thưởng.</p>
            </div>
          </div>
          <div className="review-reward-filters" role="tablist" aria-label="Lọc lịch sử">
            {HISTORY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={historyFilter === filter.id ? "is-active" : ""}
                onClick={() => setHistoryFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {visibleClaims.length ? (
            <div className="review-reward-claim-list">
              {visibleClaims.map((claim) => {
                const status = STATUS_META[claim.status] || STATUS_META.pending;
                return (
                  <article key={claim.id} className={`review-reward-claim is-${claim.status}`}>
                    <div>
                      <span>{SOURCE_LABELS[claim.partner_source] || "Đơn đối tác"}</span>
                      <strong>Đơn {claim.order_code || "đã chọn"}</strong>
                      <small>Gửi lúc {formatDate(claim.submitted_at)}</small>
                    </div>
                    <div className="review-reward-claim__result">
                      <span>{status.label}</span>
                      <strong>
                        {claim.status === "approved"
                          ? `+${Number(claim.reward_points || 0).toLocaleString("vi-VN")} điểm`
                          : status.description}
                      </strong>
                      {claim.status === "rejected" && claim.rejection_reason ? (
                        <small>{claim.rejection_reason}</small>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="review-reward-history-empty">
              <Icon name="gift" size={26} />
              <strong>Chưa có yêu cầu trong mục này</strong>
              <p>Kết quả sẽ xuất hiện tại đây sau khi bạn gửi ảnh.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
