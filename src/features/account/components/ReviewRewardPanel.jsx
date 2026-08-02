import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { processUploadImage } from "../../../utils/imageUpload.js";
import {
  getCustomerReviewRewards,
  submitReviewReward
} from "../../../services/reviewRewardService.js";
import { buildGoogleMapsReviewUrl } from "../../../services/branchNavigationService.js";

const SOURCE_LABELS = {
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  xanhngon: "Xanh Ngon",
  googlemaps: "Google Maps"
};
const HISTORY_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ kiểm tra" },
  { id: "approved", label: "Đã nhận điểm" },
  { id: "rejected", label: "Cần bổ sung" }
];
const REVIEW_REWARD_VIEW_KEY = "ghr_review_reward_view";
const GOOGLE_REVIEW_DRAFT_KEY = "ghr_google_review_draft";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không thể xem trước ảnh đã chọn."));
    reader.readAsDataURL(file);
  });
}

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
    label: "Cần bổ sung",
    description: "Ảnh cần được gửi lại để Gánh kiểm tra."
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
  onLogin,
  branches = []
}) {
  const [data, setData] = useState(null);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [proof, setProof] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [returnedFromMaps, setReturnedFromMaps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [resubmittingClaimId, setResubmittingClaimId] = useState("");
  const uploadSectionRef = useRef(null);
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

  useEffect(() => {
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(GOOGLE_REVIEW_DRAFT_KEY) || "null");
      if (draft?.branchId) {
        setSelectedSource("googlemaps");
        setSelectedBranchId(String(draft.branchId));
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === "hidden") return;
      try {
        const draft = JSON.parse(window.sessionStorage.getItem(GOOGLE_REVIEW_DRAFT_KEY) || "null");
        if (!draft?.awaitingReturn || Date.now() - Number(draft.openedAt || 0) < 1000) return;
        window.sessionStorage.setItem(GOOGLE_REVIEW_DRAFT_KEY, JSON.stringify({
          ...draft,
          awaitingReturn: false
        }));
        setReturnedFromMaps(true);
        setMessage("Đã quay lại Gánh. Chọn ảnh màn hình bạn vừa chụp nhé.");
        window.setTimeout(() => {
          uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 180);
      } catch {
      }
    };
    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);
    return () => {
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, []);

  const reviewOrders = useMemo(() => data?.orders || [], [data]);
  const availableOrders = useMemo(
    () => reviewOrders.filter((order) => !order.locked),
    [reviewOrders]
  );
  const selectedOrder = useMemo(
    () => reviewOrders.find((order) => order.id === selectedOrderId) || null,
    [reviewOrders, selectedOrderId]
  );
  const reviewBranches = useMemo(() => {
    const apiBranches = Array.isArray(data?.branches) ? data.branches : [];
    if (apiBranches.length) return apiBranches;
    return (branches || []).filter((branch) => branch?.open !== false && branch?.is_open !== false).map((branch) => ({
      id: String(branch?.branch_uuid || branch?.branchUuid || branch?.uuid || branch?.id || ""),
      name: String(branch?.name || branch?.branch_name || "Chi nhánh").trim(),
      address: String(branch?.address || branch?.metadata?.address || "").trim(),
      map: String(branch?.map || branch?.map_url || branch?.metadata?.map || "").trim(),
      googleReviewUrl: String(branch?.googleReviewUrl || branch?.google_review_url || branch?.metadata?.googleReviewUrl || "").trim(),
      lat: branch?.lat || branch?.metadata?.lat || "",
      lng: branch?.lng || branch?.metadata?.lng || "",
      locked: false
    })).filter((branch) => branch.id);
  }, [branches, data]);
  const selectedBranch = useMemo(
    () => reviewBranches.find((branch) => branch.id === selectedBranchId) || null,
    [reviewBranches, selectedBranchId]
  );
  const visibleClaims = useMemo(
    () => (data?.claims || []).filter((claim) => matchesHistoryFilter(claim, historyFilter)),
    [data, historyFilter]
  );
  const partnerRewardPoints = Number(data?.settings?.reward_points || 5000);
  const googleRewardPoints = Number(data?.settings?.google_reward_points || partnerRewardPoints);

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Đang chuẩn bị ảnh...");
    try {
      const previewDataUrl = await readFileAsDataUrl(file);
      setProofPreview(previewDataUrl);
      const canKeepOriginal = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        && file.size <= 1048576;
      const processed = canKeepOriginal
        ? {
          file,
          dataUrl: previewDataUrl,
          contentType: file.type,
          size: file.size
        }
        : await processUploadImage(file, {
          maxWidth: 1280,
          quality: 0.76,
          outputType: "image/jpeg"
        });
      if (processed.size > 1048576) throw new Error("Ảnh vẫn lớn hơn 1 MB. Vui lòng chọn ảnh khác.");
      setProof({ ...processed, originalName: file.name });
      setReturnedFromMaps(false);
      setMessage(canKeepOriginal
        ? `Đã chọn ảnh (${Math.max(1, Math.round(processed.size / 1024))} KB).`
        : `Đã nén ảnh còn ${Math.max(1, Math.round(processed.size / 1024))} KB.`);
    } catch (error) {
      setProof(null);
      setProofPreview("");
      setMessage(error.message);
    }
  };

  const openGoogleReview = () => {
    if (!selectedBranch) return;
    const mapsUrl = buildGoogleMapsReviewUrl(selectedBranch);
    if (!mapsUrl || typeof window === "undefined") {
      setMessage("Chi nhánh này chưa có đường dẫn Google Maps.");
      return;
    }
    try {
      window.sessionStorage.setItem(GOOGLE_REVIEW_DRAFT_KEY, JSON.stringify({
        branchId: selectedBranch.id,
        openedAt: Date.now(),
        awaitingReturn: true
      }));
    } catch {
    }
    setReturnedFromMaps(false);
    setMessage("Đánh giá và chụp màn hình, sau đó quay lại trang này.");
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const startResubmission = (claim) => {
    setResubmittingClaimId(claim.id);
    setSelectedSource(claim.partner_source);
    setSelectedOrderId(claim.partner_order_id || "");
    setSelectedBranchId(claim.branch_uuid || "");
    setProof(null);
    setProofPreview("");
    setReturnedFromMaps(false);
    setMessage("Chọn ảnh mới rõ thông tin và mức đánh giá 5 sao.");
    setActiveView("submit");
    window.setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);
  };

  const submit = async () => {
    const googleMaps = selectedSource === "googlemaps";
    if (!selectedSource || (!googleMaps && !selectedOrderId) || (googleMaps && !selectedBranchId) || !proof) {
      setMessage("Vui lòng chọn nguồn, đơn hoặc chi nhánh và tải ảnh chụp đánh giá 5 sao.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReviewReward({
        claim_id: resubmittingClaimId || null,
        partner_source: selectedSource,
        partner_order_id: googleMaps ? null : selectedOrderId,
        branch_uuid: googleMaps ? selectedBranchId : null,
        proof_data_url: proof.dataUrl,
        original_name: proof.originalName
      });
      setMessage(result.message);
      setSelectedSource("");
      setSelectedOrderId("");
      setSelectedBranchId("");
      setResubmittingClaimId("");
      setProof(null);
      setProofPreview("");
      try {
        window.sessionStorage.removeItem(GOOGLE_REVIEW_DRAFT_KEY);
      } catch {
      }
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderProofUpload = () => (
    <div
      ref={uploadSectionRef}
      className={`review-reward-proof-step${returnedFromMaps ? " is-returned" : ""}`}
    >
      {resubmittingClaimId ? (
        <div className="review-reward-resubmit-note">
          <span><Icon name="refresh" size={18} /></span>
          <div><strong>Gửi lại ảnh cần bổ sung</strong><small>Đơn hàng hoặc chi nhánh cũ đã được giữ sẵn.</small></div>
          <button type="button" onClick={() => {
            setResubmittingClaimId("");
            setSelectedSource("");
            setSelectedOrderId("");
            setSelectedBranchId("");
            setProof(null);
            setProofPreview("");
            setMessage("");
          }}>Hủy</button>
        </div>
      ) : null}
      {selectedSource === "googlemaps" ? (
        <div className="review-reward-maps-flow">
          <span><Icon name={returnedFromMaps ? "check" : "location"} size={19} /></span>
          <div>
            <strong>{returnedFromMaps ? "Bạn đã quay lại Gánh" : "Đánh giá xong, nhớ chụp màn hình"}</strong>
            <small>{returnedFromMaps ? "Bây giờ hãy chọn ảnh bạn vừa chụp." : "Sau đó quay lại trang này để gửi ảnh nhận điểm."}</small>
          </div>
          {!returnedFromMaps ? (
            <button type="button" onClick={openGoogleReview}>Mở Google Maps</button>
          ) : null}
        </div>
      ) : null}
      <div className="review-reward-section-title"><div><h3>Tải ảnh đánh giá 5 sao</h3><p>Ảnh cần thấy rõ nền tảng và mức 5 sao.</p></div></div>
      <label className={`review-reward-upload${proofPreview ? " has-preview" : ""}`}>
        <input type="file" accept="image/*" onChange={handleImage} />
        {proofPreview ? (
          <>
            <img src={proofPreview} alt="Ảnh đánh giá đã chọn" />
            <span className="review-reward-upload__change"><Icon name="image" size={15} /> Đổi ảnh</span>
          </>
        ) : (
          <>
            <Icon name="image" size={24} />
            <strong>{returnedFromMaps ? "Chọn ảnh vừa chụp" : "Chọn ảnh đánh giá 5 sao"}</strong>
            <span>Chạm để mở thư viện ảnh</span>
          </>
        )}
      </label>
      <button
        type="button"
        className="review-reward-submit"
        disabled={submitting || !proof}
        onClick={submit}
      >
        {submitting ? "Đang gửi..." : resubmittingClaimId ? "Gửi lại ảnh mới" : "Gửi ảnh để Gánh duyệt"}
      </button>
      {message ? <p className="review-reward-message review-reward-message--inline" role="status">{message}</p> : null}
    </div>
  );

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
          <h2 id="review-reward-title">Đánh Giá Ngay – Nhận Điểm Liền Tay</h2>
          <p>Chọn cách đánh giá phù hợp và gửi ảnh để nhận điểm.</p>
        </div>
      </header>

      {data?.settings?.enabled !== false ? (
        <div className="review-reward-point-showcase" aria-label="Mức điểm thưởng">
          <div>
            <span>Đơn đối tác</span>
            <strong>+{partnerRewardPoints.toLocaleString("vi-VN")}</strong>
            <small>điểm</small>
          </div>
          {data.settings?.platforms?.googlemaps !== false ? (
            <div>
              <span>Google Maps</span>
              <strong>+{googleRewardPoints.toLocaleString("vi-VN")}</strong>
              <small>điểm</small>
            </div>
          ) : null}
        </div>
      ) : null}

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
      ) : (
        <>
          {resubmittingClaimId ? renderProofUpload() : (
          <>
          {data.settings?.platforms?.googlemaps !== false ? (
            <button
              type="button"
              className={`review-reward-google-card${selectedSource === "googlemaps" ? " is-selected" : ""}`}
              aria-expanded={selectedSource === "googlemaps"}
              onClick={() => {
                setSelectedSource((current) => current === "googlemaps" ? "" : "googlemaps");
                setSelectedOrderId("");
                setSelectedBranchId("");
                setOrdersOpen(false);
                setProof(null);
                setProofPreview("");
                setMessage("");
              }}
            >
              <span className="review-reward-google-card__icon"><Icon name="location" size={22} /></span>
              <span>
                <strong>Đánh giá Google Maps</strong>
                <small>Chọn chi nhánh và mở thẳng nơi viết đánh giá</small>
              </span>
            </button>
          ) : null}

          {selectedSource === "googlemaps" ? (
            <div className="review-reward-selection-step">
              <div className="review-reward-section-title">
                <div><h3>Chọn chi nhánh</h3><p>Google Maps sẽ mở ngay để bạn viết đánh giá.</p></div>
              </div>
              <div className="review-reward-branches">
                {reviewBranches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={branch.locked}
                    className={selectedBranchId === branch.id ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setProof(null);
                      setProofPreview("");
                      setReturnedFromMaps(false);
                      setMessage("Đã chọn chi nhánh. Bấm Mở Google Maps để bắt đầu đánh giá.");
                      window.setTimeout(() => {
                        uploadSectionRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center"
                        });
                      }, 120);
                    }}
                  >
                    <strong>{branch.name}</strong>
                    <small>{branch.locked ? "Đã gửi yêu cầu" : `${branch.address || "Xem địa điểm"} · Đánh giá ngay`}</small>
                  </button>
                ))}
                {!reviewBranches.length ? (
                  <div className="review-reward-empty-state review-reward-empty-state--compact">
                    <Icon name="store" size={24} />
                    <strong>Chưa tải được danh sách chi nhánh</strong>
                    <p>Vui lòng thử tải lại trang.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {selectedSource === "googlemaps" && selectedBranch ? renderProofUpload() : null}

          <div className="review-reward-selection-step review-reward-partner-section">
            <div className="review-reward-section-title">
              <div><h3>Đơn hàng của bạn</h3><p>Chọn đơn bạn đã đánh giá trên ứng dụng đối tác.</p></div>
              <span>{availableOrders.length ? `${availableOrders.length} đơn còn hạn` : "Chưa có đơn còn hạn"}</span>
            </div>
            {reviewOrders.length ? (
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
                        <strong>{SOURCE_LABELS[selectedOrder.partner_source] || selectedOrder.partner_source} · Đơn {selectedOrder.order_code}</strong>
                        <small>{selectedOrder.branch_name} · +{partnerRewardPoints.toLocaleString("vi-VN")} điểm</small>
                      </>
                    ) : (
                      <>
                        <strong>Chọn đơn hàng</strong>
                        <small>GrabFood · ShopeeFood · Xanh Ngon</small>
                      </>
                    )}
                  </span>
                  <Icon name="back" size={17} />
                </button>
                {ordersOpen ? <div className="review-reward-orders" id="review-reward-order-options">
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
                        setSelectedSource(order.partner_source);
                        setSelectedOrderId(order.id);
                        setSelectedBranchId("");
                        setOrdersOpen(false);
                        setProof(null);
                        setProofPreview("");
                        setMessage("");
                      }}
                    >
                      <span className="review-reward-order__topline">
                        <span>{SOURCE_LABELS[order.partner_source] || order.partner_source}</span>
                        <em>{rewardMeta.label}</em>
                      </span>
                      <span className="review-reward-order__summary">
                        <span><strong>Đơn {order.order_code}</strong><small>{order.branch_name} · {formatDate(order.order_time)}</small></span>
                        <b>+{partnerRewardPoints.toLocaleString("vi-VN")}</b>
                      </span>
                    </button>
                  );
                  })}
                </div> : null}
              </div>
            ) : <div className="review-reward-empty-state review-reward-empty-state--compact"><Icon name="clock" size={24} /><strong>Chưa có đơn đối tác phù hợp</strong><p>Đơn đã hoàn tất bằng đúng số điện thoại tài khoản sẽ xuất hiện tại đây.</p></div>}
          </div>
          {selectedOrder ? renderProofUpload() : null}
          </>
          )}
        </>
      )) : null}
      {activeView === "submit" && message && data && !selectedOrder && !(selectedSource === "googlemaps" && selectedBranch) ? (
        <p className="review-reward-message" role="status">{message}</p>
      ) : null}

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
                      <strong>{claim.partner_source === "googlemaps" ? claim.metadata?.branch_name || "Chi nhánh đã chọn" : `Đơn ${claim.order_code || "đã chọn"}`}</strong>
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
                        <small className="review-reward-claim__reason">{claim.rejection_reason}</small>
                      ) : null}
                      {claim.status === "rejected" && claim.can_resubmit ? (
                        <button type="button" className="review-reward-claim__retry" onClick={() => startResubmission(claim)}>
                          <Icon name="image" size={14} /> Gửi lại ảnh
                        </button>
                      ) : null}
                      {claim.status === "rejected" && !claim.can_resubmit ? (
                        <small>Đã quá thời hạn gửi lại. Vui lòng liên hệ Gánh để được hỗ trợ.</small>
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
