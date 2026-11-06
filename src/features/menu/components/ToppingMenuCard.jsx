import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function ToppingMenuCard({ topping, onAdd, onRemove, selectedCount = 0 }) {
  return (
    <div className={`menu-addon-card ${selectedCount ? "addon-selected" : ""}`}>
      <CustomerControl type="button" className="menu-addon-main" onClick={onAdd}>
        <h3>{topping.name}</h3>
        <p>{topping.description || "V\u1ecb b\u00e9o m\u1eb7n, h\u1ee3p m\u00f3n cay v\u00e0 s\u1ed1t me."}</p>
      </CustomerControl>
      <div>
        <strong>{formatMoney(Number(topping.price) || 0)}</strong>
        {selectedCount > 0 ? (
          <span className="addon-stepper" role="group" aria-label={`Số lượng ${topping.name}`}>
            <CustomerControl type="button" onClick={onRemove} aria-label={`Bớt ${topping.name}`}>−</CustomerControl>
            <em>{selectedCount}</em>
            <CustomerControl type="button" onClick={onAdd} aria-label={`Thêm ${topping.name}`}>+</CustomerControl>
          </span>
        ) : (
          <CustomerControl type="button" className="addon-plus" onClick={onAdd} aria-label={`Th\u00eam ${topping.name}`}>
            +
          </CustomerControl>
        )}
      </div>
    </div>
  );
}
