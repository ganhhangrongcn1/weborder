import { useEffect, useMemo, useState } from "react";
import {
  getAdminReviewRewards,
  reviewRewardClaim,
  saveReviewRewardSettings
} from "../../../services/reviewRewardService.js";
import { buildGoogleMapsPlaceUrl } from "../../../services/branchNavigationService.js";

const SOURCE_LABELS = {
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  xanhngon: "Xanh Ngon",
  googlemaps: "Google Maps"
};

const STATUS_LABELS = {
  pending: "Chờ duyệt",
  processing: "Đang xử lý",
  approved: "Đã duyệt",
  rejected: "Chờ khách bổ sung"
};

const REJECTION_REASONS = [
  "Ảnh chưa nhìn rõ mức đánh giá 5 sao.",
  "Ảnh bị mờ hoặc thiếu nội dung.",
  "Ảnh chưa đúng đơn hàng hoặc chi nhánh.",
  "Ảnh chưa hiển thị rõ tên nền tảng.",
  "Ảnh trùng với yêu cầu đã gửi trước đó."
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default function AdminReviewRewardsPage({ onReviewRewardPendingCountChange }) {
  const [data, setData] = useState({ claims: [], settings: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("pending");
  const [notice, setNotice] = useState("");
  const [rejectClaim, setRejectClaim] = useState(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [deciding, setDeciding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getAdminReviewRewards();
      setData(result);
      onReviewRewardPendingCountChange?.(
        (result?.claims || []).filter((claim) => claim.status === "pending").length
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claims = useMemo(
    () => (data.claims || []).filter((claim) => status === "all" || claim.status === status),
    [data.claims, status]
  );

  const updateSetting = (key, value) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveReviewRewardSettings(data.settings);
      setData((current) => ({ ...current, settings: result.settings }));
      setNotice(result.message);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (claim, decision) => {
    setDeciding(true);
    try {
      const result = await reviewRewardClaim(claim.id, decision, decision === "reject" ? rejectReason : "");
      setNotice(result.message);
      setRejectClaim(null);
      setRejectReason(REJECTION_REASONS[0]);
      await load();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDeciding(false);
    }
  };

  const settings = data.settings || {
    enabled: true,
    reward_points: 5000,
    google_reward_points: 10000,
    claim_window_hours: 48,
    proof_retention_days: 3,
    platforms: { grabfood: true, shopeefood: true, xanhngon: true, googlemaps: true }
  };

  return (
    <div className="admin-review-rewards">
      <section className="admin-review-reward-settings">
        <div className="admin-review-reward-heading">
          <div>
            <h2>Thưởng điểm đánh giá 5 sao</h2>
            <p>Khách đánh giá trên app đối tác, tải ảnh lên web rồi admin duyệt cộng điểm.</p>
          </div>
          <label className="admin-review-reward-check">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => updateSetting("enabled", event.target.checked)}
            />
            Đang bật
          </label>
        </div>
        <div className="admin-review-reward-form">
          <label>
            <span>Điểm thưởng đơn đối tác (1 điểm = 1đ)</span>
            <input
              type="number"
              min="1"
              value={settings.reward_points}
              onChange={(event) => updateSetting("reward_points", Number(event.target.value))}
            />
          </label>
          <label>
            <span>Điểm thưởng Google Maps (1 điểm = 1đ)</span>
            <input
              type="number"
              min="1"
              value={settings.google_reward_points ?? settings.reward_points}
              onChange={(event) => updateSetting("google_reward_points", Number(event.target.value))}
            />
          </label>
          <label>
            <span>Thời hạn gửi đánh giá</span>
            <select
              value={settings.claim_window_hours}
              onChange={(event) => updateSetting("claim_window_hours", Number(event.target.value))}
            >
              <option value="24">24 giờ sau khi hoàn tất</option>
              <option value="48">48 giờ sau khi hoàn tất</option>
              <option value="72">3 ngày sau khi hoàn tất</option>
              <option value="168">7 ngày sau khi hoàn tất</option>
            </select>
          </label>
          <label>
            <span>Xóa ảnh sau duyệt</span>
            <select
              value={settings.proof_retention_days}
              onChange={(event) => updateSetting("proof_retention_days", Number(event.target.value))}
            >
              <option value="2">2 ngày</option>
              <option value="3">3 ngày</option>
            </select>
          </label>
          <div className="admin-review-reward-platforms">
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={settings.platforms?.[key] !== false}
                  onChange={(event) => updateSetting("platforms", {
                    ...settings.platforms,
                    [key]: event.target.checked
                  })}
                />
                {label}
              </label>
            ))}
          </div>
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </section>

      <section className="admin-review-reward-list">
        <div className="admin-review-reward-heading">
          <div>
            <h2>Ảnh chờ duyệt</h2>
            <p>Chỉ duyệt khi ảnh thể hiện đúng đánh giá 5 sao.</p>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
            <option value="all">Tất cả</option>
          </select>
        </div>
        {notice ? <p className="admin-review-reward-notice" role="status">{notice}</p> : null}
        {loading ? <p>Đang tải...</p> : null}
        {!loading && !claims.length ? <p className="admin-review-reward-empty">Chưa có yêu cầu trong mục này.</p> : null}
        <div className="admin-review-reward-grid">
          {claims.map((claim) => (
            <article key={claim.id}>
              {claim.proof_url ? (
                <a href={claim.proof_url} target="_blank" rel="noreferrer">
                  <img src={claim.proof_url} alt={`Ảnh đánh giá ${SOURCE_LABELS[claim.partner_source] || "5 sao"}`} />
                </a>
              ) : (
                <div className="admin-review-reward-deleted">Ảnh đã tự động xóa</div>
              )}
              <div className="admin-review-reward-card-body">
                <div className="admin-review-reward-card-topline">
                  <span>{SOURCE_LABELS[claim.partner_source] || claim.partner_source}</span>
                  <em className={`is-${claim.status}`}>{STATUS_LABELS[claim.status] || claim.status}</em>
                </div>
                <div className="admin-review-reward-customer">
                  <h3>{claim.order?.customer_name || claim.customer?.name || "Khách chưa có tên"}</h3>
                  <a href={`tel:${claim.order?.customer_phone || claim.customer_phone}`}>
                    {claim.order?.customer_phone || claim.customer_phone}
                  </a>
                  {claim.customer?.name && claim.customer.name !== claim.order?.customer_name ? (
                    <small>Tên tài khoản: {claim.customer.name}</small>
                  ) : null}
                </div>
                <dl className="admin-review-reward-details">
                  {claim.partner_source === "googlemaps" ? null : <div><dt>Đơn đối tác</dt><dd>{claim.order?.order_code || claim.order_code}</dd></div>}
                  {claim.partner_source === "googlemaps" ? null : <div><dt>Giá trị đơn</dt><dd>{formatMoney(claim.order?.total_amount)}</dd></div>}
                  <div className="is-wide">
                    <dt>Chi nhánh</dt>
                    <dd>
                      {claim.order?.branch_name || claim.branch?.name || claim.metadata?.branch_name || "Chưa có thông tin"}
                      {claim.partner_source === "googlemaps" && buildGoogleMapsPlaceUrl(claim.branch || {
                        name: claim.metadata?.branch_name,
                        address: claim.metadata?.branch_address
                      }) ? (
                        <a
                          className="admin-review-reward-branch-link"
                          href={buildGoogleMapsPlaceUrl(claim.branch || {
                            name: claim.metadata?.branch_name,
                            address: claim.metadata?.branch_address
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Mở Google Maps ↗
                        </a>
                      ) : null}
                    </dd>
                  </div>
                  {claim.partner_source === "googlemaps" ? null : <div><dt>Thời gian đặt</dt><dd>{formatDate(claim.order?.order_time) || "Chưa có"}</dd></div>}
                  <div>
                    <dt>Gửi yêu cầu</dt>
                    <dd>{formatDate(claim.submitted_at)}</dd>
                  </div>
                </dl>
                <div className="admin-review-reward-points">
                  <span>
                    <small>Điểm thưởng</small>
                    <strong>+{Number(claim.reward_points).toLocaleString("vi-VN")}</strong>
                  </span>
                  <span>
                    <small>Số dư hiện tại</small>
                    <strong>{Number(claim.current_points || 0).toLocaleString("vi-VN")}</strong>
                  </span>
                </div>
                {claim.rejection_reason ? <small>{claim.rejection_reason}</small> : null}
                {claim.status === "pending" ? (
                  <div className="admin-review-reward-actions">
                    <button type="button" className="is-reject" onClick={() => {
                      setRejectClaim(claim);
                      setRejectReason(REJECTION_REASONS[0]);
                    }}>
                      Từ chối
                    </button>
                    <button type="button" disabled={deciding} onClick={() => decide(claim, "approve")}>
                      Duyệt + cộng điểm
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      {rejectClaim ? (
        <div className="admin-review-reject-overlay" role="presentation" onMouseDown={() => !deciding && setRejectClaim(null)}>
          <section
            className="admin-review-reject-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-review-reject-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Cần khách bổ sung</span>
                <h2 id="admin-review-reject-title">Chọn lý do ảnh chưa đạt</h2>
                <p>Khách sẽ thấy nội dung này và có thể gửi lại ảnh trong 24 giờ.</p>
              </div>
              <button type="button" aria-label="Đóng" disabled={deciding} onClick={() => setRejectClaim(null)}>×</button>
            </header>
            <div className="admin-review-reject-presets">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={rejectReason === reason ? "is-selected" : ""}
                  onClick={() => setRejectReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <label>
              <span>Ghi chú gửi khách</span>
              <textarea
                rows="3"
                maxLength="500"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Nhập hướng dẫn ngắn gọn để khách sửa đúng..."
              />
            </label>
            <footer>
              <button type="button" className="is-cancel" disabled={deciding} onClick={() => setRejectClaim(null)}>Quay lại</button>
              <button type="button" disabled={deciding || !rejectReason.trim()} onClick={() => decide(rejectClaim, "reject")}>
                {deciding ? "Đang gửi..." : "Từ chối & cho gửi lại"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
