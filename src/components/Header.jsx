import Icon from "./Icon.jsx";

const IconButton = ({ children, onClick, label }) => (
  <button type="button" aria-label={label} onClick={onClick} className="customer-icon-button">
    {children}
  </button>
);

export default function Header({ points = 120, onAccountClick }) {
  return (
    <header className="customer-brand-header">
      <div className="customer-brand-header__row">
        <button type="button" onClick={onAccountClick} className="customer-brand-header__brand">
          <span className="customer-brand-header__logo">G</span>
          <span className="min-w-0">
            <span className="customer-brand-header__kicker">Bánh tráng trộn</span>
            <span className="customer-brand-header__name">Gánh Hàng Rong</span>
          </span>
        </button>
        <div className="customer-brand-header__actions">
          <div className="customer-brand-header__points">{points} điểm</div>
          <IconButton label="Thông báo">
            <Icon name="bell" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
