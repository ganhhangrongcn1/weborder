import Icon from "../../../components/Icon.jsx";

export default function AccountNoticeModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className="account-notice-backdrop" role="presentation" onClick={onClose}>
      <section
        className="account-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-label={notice.title || "Thông báo"}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="account-notice-icon">
          <Icon name={notice.icon || "warning"} size={22} />
        </span>
        <div>
          <h2>{notice.title || "Thông báo"}</h2>
          <p>{notice.message}</p>
        </div>
        <button type="button" onClick={onClose}>Đã hiểu</button>
      </section>
    </div>
  );
}
