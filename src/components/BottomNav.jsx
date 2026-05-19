import Icon from "./Icon.jsx";

const defaultItems = [
  { id: "home", label: "Trang chủ", icon: "home" },
  { id: "menu", label: "Menu", icon: "menu" },
  { id: "orders", label: "Đơn hàng", icon: "bag" },
  { id: "rewards", label: "Ưu đãi & Tích điểm", icon: "gift" },
  { id: "account", label: "Tài khoản", icon: "user" }
];

export default function BottomNav({ activeTab, onChange, items = defaultItems }) {
  return (
    <nav className="customer-bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`customer-bottom-nav__item ${activeTab === item.id ? "customer-bottom-nav__item--active" : ""}`}
        >
          <span className={`customer-bottom-nav__icon ${activeTab === item.id ? "customer-bottom-nav__icon--active" : ""}`}>
            <Icon name={item.icon} size={18} />
          </span>
          <span className="customer-bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
