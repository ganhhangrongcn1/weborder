import CustomerControl from "./CustomerControl.jsx";
export default function CustomerMenuTabs({ active = "menu", navigate, onChange }) {
  const selectTab = (tab) => onChange ? onChange(tab) : navigate(tab === "menu" ? "menu" : "loyalty", tab);
  return (
    <nav className="customer-menu-tabs" aria-label="Thực đơn và ưu đãi">
      <CustomerControl type="button" aria-current={active === "menu" ? "page" : undefined} onClick={() => selectTab("menu")}>Thực đơn</CustomerControl>
      <CustomerControl type="button" aria-current={active === "rewards" ? "page" : undefined} onClick={() => selectTab("rewards")}>Ưu đãi</CustomerControl>
    </nav>
  );
}
