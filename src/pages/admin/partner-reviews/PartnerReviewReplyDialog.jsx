import { useEffect, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { AdminButton } from "../ui/AdminCommon.jsx";
import { formatReviewDate, ratingTone } from "./partnerReviewUi.js";

const MAX_REPLY_LENGTH = 500;

export default function PartnerReviewReplyDialog({ review, saving = false, onClose, onSubmit }) {
  const [replyText, setReplyText] = useState("");

  useEffect(() => setReplyText(""), [review?.id]);
  if (!review) return null;

  const command = review.reply_command;
  const failed = command?.status === "failed";
  const canSubmit = replyText.trim().length > 0 && replyText.trim().length <= MAX_REPLY_LENGTH && !saving;

  const submit = (event) => {
    event.preventDefault();
    if (canSubmit) onSubmit(review, replyText.trim());
  };

  return (
    <div className="admin-review-reply-overlay" role="presentation" onMouseDown={onClose}>
      <form className="admin-review-reply-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div className={`admin-review-detail-rating is-${ratingTone(review.rating)}`}>
            {review.rating || 0}<Icon name="star" size={15} />
          </div>
          <div>
            <h2>Trả lời đánh giá trên Grab</h2>
            <p>{review.customer_display_name || "Khách Grab"} · {formatReviewDate(review.review_created_at)}</p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={19} /></button>
        </header>

        <blockquote>{review.content || "Khách không để lại nội dung, chỉ chấm sao."}</blockquote>

        {failed ? (
          <div className="admin-review-reply-error" role="alert">
            <Icon name="warning" size={17} />
            <span>{command.error_message || "Grab chưa nhận được phản hồi. Anh có thể chỉnh nội dung và thử lại."}</span>
          </div>
        ) : null}

        <label className="admin-review-reply-field">
          <span>Nội dung phản hồi</span>
          <textarea
            autoFocus
            rows={7}
            maxLength={MAX_REPLY_LENGTH}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Ví dụ: Quán cảm ơn anh/chị đã góp ý. Quán sẽ kiểm tra và cải thiện ngay ạ."
          />
          <small>{replyText.length}/{MAX_REPLY_LENGTH} ký tự</small>
        </label>

        <div className="admin-review-reply-note">
          <Icon name="warning" size={17} />
          <span>Nội dung sẽ được đăng công khai dưới đánh giá này trên Grab. Mỗi đánh giá chỉ gửi một lần.</span>
        </div>

        <footer>
          <AdminButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Hủy</AdminButton>
          <AdminButton type="submit" disabled={!canSubmit}>
            <Icon name="share" size={16} /> {saving ? "Đang xếp hàng..." : "Xác nhận gửi lên Grab"}
          </AdminButton>
        </footer>
      </form>
    </div>
  );
}
