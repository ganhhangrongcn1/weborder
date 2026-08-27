import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  getInventoryCompatibleUnits,
  getInventoryUnitToBaseFactor
} from "../../../services/inventoryUnitConversion.js";

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 6 });
}

export default function InventoryLineUnitSelect({
  item,
  units = [],
  value = "",
  disabled = false,
  required = true,
  onChange,
  ariaLabel = "Chọn đơn vị"
}) {
  const compatibleUnits = getInventoryCompatibleUnits(item, units);
  const selectedUnit = compatibleUnits.find((unit) => unit.id === value);
  const conversionToBase = getInventoryUnitToBaseFactor(item, selectedUnit);
  const baseUnitName = item?.baseUnit?.symbol || item?.baseUnit?.name || "đơn vị gốc";
  const selectedUnitName = selectedUnit?.symbol || selectedUnit?.name || "đơn vị";

  return (
    <div className="inventory-document-unit inventory-document-unit--editable">
      <InventorySearchableSelect
        value={value}
        disabled={disabled || !item?.id}
        required={required}
        onChange={(event) => {
          const unit = compatibleUnits.find((option) => option.id === event.target.value);
          onChange?.(event.target.value, getInventoryUnitToBaseFactor(item, unit));
        }}
        aria-label={ariaLabel}
        searchPlaceholder="Tìm đơn vị..."
      >
        <option value="">Chọn đơn vị</option>
        {compatibleUnits.map((unit) => (
          <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ""}</option>
        ))}
      </InventorySearchableSelect>
      <small>
        {!item?.id
          ? "Chọn nguyên vật liệu trước"
          : selectedUnit && conversionToBase !== 1
            ? `1 ${selectedUnitName} = ${formatQuantity(conversionToBase)} ${baseUnitName}`
            : "Đơn vị lưu kho"}
      </small>
    </div>
  );
}
