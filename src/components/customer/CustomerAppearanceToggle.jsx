import CustomerControl from "./CustomerControl.jsx";
import useCustomerAppearance from "../../hooks/useCustomerAppearance.js";
import Icon from "../Icon.jsx";

export default function CustomerAppearanceToggle() {
  const { theme, setTheme } = useCustomerAppearance();
  return <section className="customer-appearance" aria-label="Giao diện sáng tối">
    <span className="customer-appearance__label"><Icon name="gear" size={20} /><span><strong>Giao diện</strong><small>Chọn nền bạn thích</small></span></span>
    <div role="group" aria-label="Chọn giao diện">
      <CustomerControl type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Sáng</CustomerControl>
      <CustomerControl type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Tối</CustomerControl>
    </div>
  </section>;
}
