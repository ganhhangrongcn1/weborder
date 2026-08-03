import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import {
  listPartnerReviews,
  listPartnerReviewSources,
  savePartnerReviewSource
} from "../../../services/partnerReviewSourceService.js";
import { AdminBadge, AdminButton, AdminCard, AdminSwitch } from "../ui/AdminCommon.jsx";

const PLATFORMS = [
  ["grabfood", "GrabFood"],
  ["shopeefood", "ShopeeFood"],
  ["xanhngon", "Xanh Ngon"],
  ["other", "Nền tảng khác"]
];
const EMPTY = {
  id: "", platform: "grabfood", accountKey: "", displayName: "", merchantId: "",
  branchUuid: "", branchCode: "", username: "", password: "", syncEnabled: true,
  loginIdentifierHint: "", credentialsConfigured: false
};
const REVIEWS_PER_PAGE = 8;
const text = (value = "") => String(value || "").trim();
const branchUuid = (branch) => text(branch?.branch_uuid || branch?.branchUuid || branch?.uuid);
const branchCode = (branch) => text(branch?.branch_code || branch?.branchCode);
const platformName = (value) => PLATFORMS.find(([id]) => id === value)?.[1] || value;
const badgeTone = (value) => {
  if (["ready", "success"].includes(value)) return "success";
  if (["error", "failed", "expired"].includes(value)) return "danger";
  if (value === "running") return "info";
  return "neutral";
};
const syncStatusLabel = (value) => {
  if (value === "success") return "Lần cuối thành công";
  if (value === "failed" || value === "error") return "Lần cuối thất bại";
  if (value === "running") return "Đang đồng bộ";
  return "Chưa đồng bộ";
};
const formatReviewDate = (value) => {
  if (!value) return "Chưa có thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
};

export default function AdminPartnerReviewsPage({ branches = [] }) {
  const [sources, setSources] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [filters, setFilters] = useState({ sourceId: "", branchUuid: "", rating: "" });
  const [reviewPage, setReviewPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const branchOptions = useMemo(
    () => branches.map((branch) => ({
      value: branchUuid(branch),
      code: branchCode(branch),
      label: text(branch?.name) || branchCode(branch) || "Chi nhánh"
    })).filter((item) => item.value),
    [branches]
  );
  const reviewPageCount = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const visibleReviews = useMemo(() => {
    const start = (reviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(start, start + REVIEWS_PER_PAGE);
  }, [reviewPage, reviews]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listPartnerReviewSources();
      if (result.ok) setSources(result.sources);
      else setMessage(result.message);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async (nextFilters = filters) => {
    setReviewsLoading(true);
    try {
      const result = await listPartnerReviews(nextFilters);
      if (result.ok) {
        setReviews(result.reviews);
        setReviewPage(1);
      }
      else setMessage(result.message);
      return result;
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setMessage("");
      await load();
      await loadReviews();
    };
    loadInitialData();
  }, []);

  const updateFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setReviewPage(1);
    loadReviews(next);
  };

  const createNew = () => {
    const firstBranch = branchOptions[0];
    setForm({
      ...EMPTY,
      branchUuid: firstBranch?.value || "",
      branchCode: firstBranch?.code || ""
    });
    setFormOpen(true);
    setMessage("");
  };

  const edit = (source) => {
    setForm({
      id: source.id,
      platform: source.platform,
      accountKey: source.account_key,
      displayName: source.display_name,
      merchantId: source.merchant_id || "",
      branchUuid: source.branch_uuid,
      branchCode: source.branch_code || "",
      username: "",
      password: "",
      syncEnabled: source.sync_enabled !== false,
      loginIdentifierHint: source.login_identifier_hint || "",
      credentialsConfigured: source.credentials_configured === true
    });
    setFormOpen(true);
  };

  const selectBranch = (value) => {
    const branch = branchOptions.find((item) => item.value === value);
    setForm((current) => ({ ...current, branchUuid: value, branchCode: branch?.code || "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const result = await savePartnerReviewSource(form);
    setMessage(result.message || (result.ok ? "Đã lưu gian hàng." : "Không lưu được gian hàng."));
    if (result.ok) {
      setForm(EMPTY);
      setFormOpen(false);
      await load();
    }
    setSaving(false);
  };

  return (
    <div className="admin-review-page">
      {message ? (
        <div className="admin-review-page-message">
          <Icon name="warning" size={17} />
          <span>{message}</span>
          <button type="button" onClick={async () => {
            setMessage("");
            await load();
            await loadReviews();
          }}>
            Thử lại
          </button>
        </div>
      ) : null}
      <div className="admin-review-summary">
        <div><strong>{loading ? "–" : sources.length}</strong><span>Gian hàng</span></div>
        <div><strong>{loading ? "–" : new Set(sources.map((item) => item.branch_uuid)).size}</strong><span>Chi nhánh</span></div>
        <div><strong>{loading ? "–" : sources.filter((item) => item.credentials_configured).length}</strong><span>Đã có đăng nhập</span></div>
        <div><strong>{loading ? "–" : sources.filter((item) => item.sync_enabled).length}</strong><span>Đang đồng bộ</span></div>
      </div>

      <div className="admin-review-layout">
        <AdminCard>
          <div className="admin-review-head">
            <div><h2>Nguồn đánh giá</h2><p>Một chi nhánh có thể có nhiều gian hàng.</p></div>
            <AdminButton onClick={createNew}><Icon name="plus" size={16} /> Thêm gian hàng</AdminButton>
          </div>
          {loading ? <p className="admin-review-note">Đang tải dữ liệu...</p> : null}
          <div className="admin-review-list">
            {sources.map((source) => (
              <article key={source.id}>
                <span className={`admin-review-platform is-${source.platform}`}>{platformName(source.platform)}</span>
                <div className="admin-review-name">
                  <strong>{source.display_name}</strong>
                  <small>{source.branch_code || "Chưa có mã"} · {source.account_key}</small>
                </div>
                <div className="admin-review-badges">
                  <AdminBadge tone={badgeTone(source.auth_status)}>
                    {source.credentials_configured ? "Đã lưu đăng nhập" : "Thiếu đăng nhập"}
                  </AdminBadge>
                  <AdminBadge tone={source.sync_enabled ? "success" : "neutral"}>
                    {source.sync_enabled ? "Đang bật" : "Đã tắt"}
                  </AdminBadge>
                  <AdminBadge tone={badgeTone(source.sync_status)}>
                    {syncStatusLabel(source.sync_status)}
                  </AdminBadge>
                </div>
                <button type="button" className="admin-review-edit" onClick={() => edit(source)}>
                  <Icon name="edit" size={15} /> Sửa
                </button>
              </article>
            ))}
          </div>
        </AdminCard>
      </div>

      <AdminCard className="admin-review-feedback-section">
        <div className="admin-review-head">
          <div>
            <h2>Đánh giá gần đây</h2>
            <p>Dữ liệu đồng bộ từ các gian hàng, tối đa 100 đánh giá mới nhất.</p>
          </div>
          <AdminButton onClick={() => loadReviews()}>
            <Icon name="refresh" size={16} /> Làm mới
          </AdminButton>
        </div>
        <div className="admin-review-filters">
          <label>
            <span>Gian hàng</span>
            <select value={filters.sourceId} onChange={(event) => updateFilter("sourceId", event.target.value)}>
              <option value="">Tất cả gian hàng</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.display_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Chi nhánh</span>
            <select value={filters.branchUuid} onChange={(event) => updateFilter("branchUuid", event.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {branchOptions.map((branch) => (
                <option key={branch.value} value={branch.value}>{branch.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Số sao</span>
            <select value={filters.rating} onChange={(event) => updateFilter("rating", event.target.value)}>
              <option value="">Tất cả</option>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}
            </select>
          </label>
        </div>
        {reviewsLoading ? <p className="admin-review-note">Đang tải đánh giá...</p> : null}
        {!reviewsLoading && reviews.length === 0 ? (
          <div className="admin-review-empty">Chưa có đánh giá phù hợp với bộ lọc.</div>
        ) : null}
        <div className="admin-review-feedback-list">
          {visibleReviews.map((review) => (
            <article key={review.id}>
              <div className="admin-review-feedback-rating" aria-label={`${review.rating || 0} sao`}>
                <strong>{review.rating || 0}</strong><Icon name="star" size={15} />
              </div>
              <div className="admin-review-feedback-main">
                <div className="admin-review-feedback-title">
                  <strong>{review.customer_display_name || "Khách Grab"}</strong>
                  <span>{review.source?.display_name || platformName(review.platform)}</span>
                </div>
                <p>{review.content || "Khách không để lại nội dung."}</p>
                <small>
                  {formatReviewDate(review.review_created_at)}
                  {review.booking_code ? ` · Đơn ${review.booking_code}` : ""}
                  {review.branch_code ? ` · Chi nhánh ${review.branch_code}` : ""}
                </small>
              </div>
              {review.is_new ? <AdminBadge tone="info">Mới</AdminBadge> : null}
            </article>
          ))}
        </div>
        {!reviewsLoading && reviews.length > REVIEWS_PER_PAGE ? (
          <div className="admin-review-pagination">
            <span>
              Trang {reviewPage}/{reviewPageCount} · {reviews.length} đánh giá
            </span>
            <div>
              <AdminButton
                type="button"
                variant="secondary"
                disabled={reviewPage === 1}
                onClick={() => setReviewPage((current) => Math.max(1, current - 1))}
              >
                Trước
              </AdminButton>
              <AdminButton
                type="button"
                variant="secondary"
                disabled={reviewPage === reviewPageCount}
                onClick={() => setReviewPage((current) => Math.min(reviewPageCount, current + 1))}
              >
                Sau
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminCard>

      {formOpen ? (
        <div className="admin-review-form-overlay" role="presentation" onMouseDown={() => setFormOpen(false)}>
          <aside className="admin-review-form-panel" aria-label={form.id ? "Cập nhật gian hàng" : "Thêm gian hàng"} onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-review-form-panel-head">
              <div>
                <h2>{form.id ? "Cập nhật gian hàng" : "Thêm gian hàng"}</h2>
                <p>Mật khẩu được mã hóa trong Supabase Vault.</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setFormOpen(false)}>
                <Icon name="close" size={19} />
              </button>
            </div>
            <form className="admin-review-form" onSubmit={submit}>
              {form.id ? (
                <div className={`admin-review-credential-state is-wide ${form.credentialsConfigured ? "is-ready" : "is-missing"}`}>
                  <Icon name={form.credentialsConfigured ? "check" : "warning"} size={18} />
                  <div>
                    <strong>{form.credentialsConfigured ? "Thông tin đăng nhập đã được lưu" : "Chưa đủ thông tin đăng nhập"}</strong>
                    <small>
                      {form.credentialsConfigured
                        ? `Tài khoản: ${form.loginIdentifierHint || "đã ẩn"} · Mật khẩu: ••••••••`
                        : "Hãy nhập lại cả tài khoản và mật khẩu rồi bấm Lưu gian hàng."}
                    </small>
                  </div>
                </div>
              ) : null}
              <label><span>Nền tảng</span><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Chi nhánh</span><select required value={form.branchUuid} onChange={(e) => selectBranch(e.target.value)}><option value="">Chọn chi nhánh</option>{branchOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="is-wide"><span>Tên gian hàng</span><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
              <label><span>Mã quản lý nội bộ</span><input required placeholder="grab_304_primary" value={form.accountKey} onChange={(e) => setForm({ ...form, accountKey: e.target.value })} /></label>
              <label><span>Merchant ID</span><input placeholder="Có thể bổ sung sau" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} /></label>
              <label>
                <span>Tài khoản đăng nhập</span>
                <input
                  autoComplete="off"
                  placeholder={form.credentialsConfigured ? `Đã lưu: ${form.loginIdentifierHint || "tài khoản được bảo mật"}` : ""}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
                {form.credentialsConfigured ? <small>Để trống nếu không thay tài khoản.</small> : null}
              </label>
              <label>
                <span>Mật khẩu</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={form.credentialsConfigured ? "Đã lưu mật khẩu ••••••••" : ""}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                {form.credentialsConfigured ? <small>Để trống nếu không thay mật khẩu.</small> : null}
              </label>
              <div className="admin-review-switch is-wide">
                <div><strong>Tự động đồng bộ</strong><small>Cho phép n8n xử lý gian hàng này.</small></div>
                <AdminSwitch checked={form.syncEnabled} onChange={(checked) => setForm({ ...form, syncEnabled: checked })} />
              </div>
              <div className="admin-review-actions is-wide">
                <AdminButton type="button" variant="secondary" onClick={() => setFormOpen(false)}>Hủy</AdminButton>
                <AdminButton type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu gian hàng"}</AdminButton>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
