import Icon from "../../../components/Icon.jsx";
import ToppingMenuCard from "./ToppingMenuCard.jsx";

export default function MenuAddonSection({
  isOpen,
  onToggle,
  toppings,
  selectedCounts,
  onAdd,
  onRemove,
  text
}) {
  return (
    <section className={`menu-addon-section${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="menu-addon-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>
          <small>{text.addonSectionEyebrow}</small>
          <strong>{text.addonSectionTitle}</strong>
        </span>
        <span className="menu-addon-toggle__meta">
          {isOpen ? "Thu gọn" : text.addonSectionHint}
          <Icon name="back" size={15} className={isOpen ? "is-open" : ""} />
        </span>
      </button>

      {isOpen ? (
        <div className="no-scrollbar menu-addon-scroll">
          {toppings.map((topping) => (
            <ToppingMenuCard
              key={topping.id}
              topping={topping}
              onAdd={() => onAdd(topping)}
              onRemove={() => onRemove(topping.id)}
              selectedCount={selectedCounts[topping.id] || 0}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
