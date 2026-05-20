import Icon from "../Icon.jsx";

export default function Header({ title, subtitle, onBack, right }) {
  return (
    <header className="customer-page-header">
      <div className="customer-page-header__side">
        <button
          type="button"
          aria-label={onBack ? "Quay lại" : "Cài đặt"}
          onClick={onBack}
          className="customer-icon-button"
        >
          {onBack ? <Icon name="back" /> : <Icon name="gear" />}
        </button>
      </div>
      <div className="customer-page-header__copy">
        <h1 className="customer-page-header__title">{title}</h1>
        {subtitle ? <p className="customer-page-header__subtitle">{subtitle}</p> : null}
      </div>
      <div className="customer-page-header__side">{right || <span />}</div>
    </header>
  );
}
