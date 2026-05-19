import Icon from "../Icon.jsx";

export default function Header({ title, onBack, right }) {
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
      <h1 className="customer-page-header__title">{title}</h1>
      <div className="customer-page-header__side">{right || <span />}</div>
    </header>
  );
}
