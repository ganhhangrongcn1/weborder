import { useEffect, useMemo, useState } from "react";

function getQuantity(item = {}) {
  return Math.max(1, Math.floor(Number(item.quantity) || 1));
}

function getItemName(item = {}) {
  return String(item.name || item.productName || item.product_name || "Món").trim();
}

function getOptionLabels(item = {}) {
  const values = item.options || item.toppings || item.optionGroups || [];
  return (Array.isArray(values) ? values : [])
    .map((option) => (
      typeof option === "string"
        ? option
        : option?.label || option?.name || option?.value || ""
    ))
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getUnitKey(itemIndex, unitIndex) {
  return `${itemIndex}:${unitIndex}`;
}

function buildUnits(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  let itemNumber = 0;
  return items.flatMap((item, itemIndex) => {
    const quantity = getQuantity(item);
    return Array.from({ length: quantity }, (_, unitIndex) => ({
      item,
      itemIndex,
      itemNumber: ++itemNumber,
      key: getUnitKey(itemIndex, unitIndex),
      quantity,
      unitIndex
    }));
  });
}

export default function KitchenItemLabelPrintDialog({
  open = false,
  order = null,
  printing = false,
  onClose,
  onSubmit
}) {
  const units = useMemo(() => buildUnits(order || {}), [order]);
  const [selectedKeys, setSelectedKeys] = useState([]);

  useEffect(() => {
    if (!open) return;
    const unitsWithNotes = units.filter(({ item }) => String(item.note || "").trim());
    const defaults = unitsWithNotes.length ? unitsWithNotes : units;
    setSelectedKeys(defaults.map(({ key }) => key));
  }, [open, units]);

  if (!open || !order) return null;

  const selectedSet = new Set(selectedKeys);
  const allSelected = units.length > 0 && units.every(({ key }) => selectedSet.has(key));
  const orderCode = order.displayOrderCode || order.orderCode || order.order_code || order.id || "";
  const branchName = order.branchName || order.branch_name || "";

  function toggleUnit(key) {
    setSelectedKeys((current) => (
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key]
    ));
  }

  function handleSubmit() {
    const selections = units
      .filter(({ key }) => selectedSet.has(key))
      .map(({ itemIndex, unitIndex }) => ({ itemIndex, unitIndex }));
    onSubmit?.(order, selections);
  }

  return (
    <div
      role="presentation"
      onClick={() => !printing && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.55)"
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`In tem món cho đơn ${orderCode}`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          maxHeight: "min(86vh, 760px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
          borderRadius: 18,
          background: "#ffffff",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)"
        }}
      >
        <header style={{ padding: "18px 20px 14px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 21, color: "#0f172a" }}>In tem từng món</h2>
              <div style={{ marginTop: 5, fontWeight: 900, color: "#166534" }}>Đơn {orderCode}</div>
              {branchName ? (
                <div style={{ marginTop: 3, fontSize: 13, color: "#475569" }}>Chi nhánh: {branchName}</div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={printing}
              onClick={() => onClose?.()}
              style={{
                width: 38,
                height: 38,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                background: "#ffffff",
                fontSize: 22,
                cursor: printing ? "not-allowed" : "pointer"
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
            Món có ghi chú đã được chọn sẵn. Mỗi phần được in và cắt thành một tem riêng.
          </p>
        </header>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 850 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedKeys(allSelected ? [] : units.map(({ key }) => key))}
            />
            Chọn tất cả {units.length} phần món
          </label>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 20px 18px" }}>
          {units.map(({ item, itemIndex, itemNumber, key, quantity, unitIndex }) => {
            const note = String(item.note || "").trim();
            const optionLabels = getOptionLabels(item);
            return (
              <label
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr)",
                  gap: 10,
                  marginBottom: 10,
                  padding: 13,
                  border: selectedSet.has(key) ? "2px solid #22c55e" : "1px solid #cbd5e1",
                  borderRadius: 13,
                  background: selectedSet.has(key) ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(key)}
                  onChange={() => toggleUnit(key)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "#0f172a" }}>
                    Món #{itemNumber}: {getItemName(item)}
                    {quantity > 1 ? ` — phần ${unitIndex + 1}/${quantity}` : ""}
                  </strong>
                  {optionLabels.length ? (
                    <span style={{ display: "block", marginTop: 5, fontSize: 13, color: "#475569" }}>
                      {optionLabels.join(" • ")}
                    </span>
                  ) : null}
                  {note ? (
                    <span
                      style={{
                        display: "block",
                        marginTop: 7,
                        padding: "7px 9px",
                        borderRadius: 8,
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: 13,
                        fontWeight: 850
                      }}
                    >
                      Ghi chú: {note}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <footer
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            padding: "14px 20px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc"
          }}
        >
          <div style={{ alignSelf: "center", fontSize: 13, fontWeight: 800, color: "#475569" }}>
            Đã chọn {selectedKeys.length}/{units.length} tem
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button
              type="button"
              disabled={printing}
              onClick={() => onClose?.()}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "10px 14px",
                background: "#ffffff",
                fontWeight: 850
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={printing || selectedKeys.length === 0}
              onClick={handleSubmit}
              style={{
                border: "1px solid #15803d",
                borderRadius: 10,
                padding: "10px 16px",
                background: printing || selectedKeys.length === 0 ? "#bbf7d0" : "#16a34a",
                color: "#ffffff",
                fontWeight: 950,
                cursor: printing || selectedKeys.length === 0 ? "not-allowed" : "pointer"
              }}
            >
              {printing ? "Đang gửi..." : `In ${selectedKeys.length} tem`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
