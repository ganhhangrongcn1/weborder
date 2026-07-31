import { useEffect, useMemo, useState } from "react";
import {
  getAdminReviewRewards,
  reviewRewardClaim,
  saveReviewRewardSettings
} from "../../../services/reviewRewardService.js";

const SOURCE_LABELS = {
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  xanhngon: "Xanh Ngon"
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AdminReviewRewardsPage() {
  const [data, setData] = useState({ claims: [], settings: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("pending");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setData(await getAdminReviewRewards());
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
    const reason = decision === "reject"
      ? window.prompt("Lý do từ chối:", "Ảnh chưa thể hiện đánh giá 5 sao hợp lệ.")
      : "";
    if (decision === "reject" && reason === null) return;
    try {
      const result = await reviewRewardClaim(claim.id, decision, reason);
      setNotice(result.message);
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const settings = data.settings || {
    enabled: true,
    reward_points: 5000,
    claim_window_hours: 48,
    proof_retention_days: 3,
    platforms: { grabfood: true, shopeefood: true, xanhngon: true }
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
            <span>Điểm thưởng (1 điểm = 1đ)</span>
            <input
              type="number"
              min="1"
              value={settings.reward_points}
              onChange={(event) => updateSetting("reward_points", Number(event.target.value))}
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
                  <img src={claim.proof_url} alt={`Ảnh đánh giá đơn ${claim.order_code}`} />
                </a>
              ) : (
                <div className="admin-review-reward-deleted">Ảnh đã tự động xóa</div>
              )}
              <div className="admin-review-reward-card-body">
                <span>{SOURCE_LABELS[claim.partner_source] || claim.partner_source}</span>
                <h3>Đơn {claim.order_code}</h3>
                <p>{claim.customer_phone} · {formatDate(claim.submitted_at)}</p>
                <strong>+{Number(claim.reward_points).toLocaleString("vi-VN")} điểm</strong>
                {claim.rejection_reason ? <small>{claim.rejection_reason}</small> : null}
                {claim.status === "pending" ? (
                  <div>
                    <button type="button" className="is-reject" onClick={() => decide(claim, "reject")}>
                      Từ chối
                    </button>
                    <button type="button" onClick={() => decide(claim, "approve")}>
                      Duyệt + cộng điểm
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
