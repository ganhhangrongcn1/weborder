import CustomerControl from "./customer/CustomerControl.jsx";
import Icon from "./Icon.jsx";

const defaultItems = [
  { id: "home", label: "Trang chủ", icon: "home" },
  { id: "menu", label: "Menu", icon: "dish" },
  { id: "orders", label: "Lịch sử đơn", icon: "bag" },
  { id: "rewards", label: "Quà của bạn", icon: "gift" },
  { id: "account", label: "Tài khoản", icon: "user" }
];

export default function BottomNav({ activeTab, onChange, items = defaultItems }) {
  const resolvedTab = activeTab;
  return (
    <nav className="customer-bottom-nav">
      {items.map((item) => (
        <CustomerControl
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={resolvedTab === item.id ? "page" : undefined}
          className={`customer-bottom-nav__item ${resolvedTab === item.id ? "customer-bottom-nav__item--active" : ""}`}
        >
          <span className={`customer-bottom-nav__icon ${resolvedTab === item.id ? "customer-bottom-nav__icon--active" : ""}`}>
            <Icon
              name={item.icon}
              size={20}
              weight={resolvedTab === item.id ? "fill" : "regular"}
            />
          </span>
          <span className="customer-bottom-nav__label">{item.label}</span>
        </CustomerControl>
      ))}
    </nav>
  );
}
