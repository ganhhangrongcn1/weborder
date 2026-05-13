import { formatMoney } from "../../../utils/format.js";

export default function ToppingMenuCard({ topping, onAdd, onRemove, selectedCount = 0 }) {
  return (
    <div className={`menu-addon-card ${selectedCount ? "addon-selected" : ""}`}>
      <button type="button" className="menu-addon-main" onClick={onAdd}>
        <h3>{topping.name}</h3>
        <p>{topping.description || "V\u1ecb b\u00e9o m\u1eb7n, h\u1ee3p m\u00f3n cay v\u00e0 s\u1ed1t me."}</p>
      </button>
      <div>
        <strong>{formatMoney(Number(topping.price) || 0)}</strong>
        {selectedCount > 0 ? (
          <span className="addon-stepper">
            <button type="button" onClick={onRemove}>-</button>
            <em>{selectedCount}</em>
            <button type="button" onClick={onAdd}>+</button>
          </span>
        ) : (
          <button type="button" className="addon-plus" onClick={onAdd} aria-label={`Th\u00eam ${topping.name}`}>
            +
          </button>
        )}
      </div>
    </div>
  );
}
