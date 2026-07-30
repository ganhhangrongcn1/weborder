import { useEffect, useMemo, useState } from "react";
import {
  normalizeKitchenOptionText,
  parseKitchenOptionLabel
} from "./kitchenOptionDisplay.js";
import {
  KITCHEN_PROGRESS_EVENT,
  KITCHEN_TOPPING_PROGRESS_STORAGE_KEY,
  KITCHEN_UNIT_PROGRESS_STORAGE_KEY,
  getKitchenProgressItemKey,
  isKitchenToppingDone,
  isKitchenUnitDone,
  readKitchenProgress
} from "./kitchenProgressState.js";

function getQuantity(item = {}) {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function getChecklistOptions(item = {}) {
  const seen = new Set();
  return (Array.isArray(item.kitchenChecklistOptions) ? item.kitchenChecklistOptions : [])
    .filter((option) => {
      const key = normalizeKitchenOptionText(option?.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getDisplayOptions(item = {}, checklistOptions = []) {
  const checklistKeys = new Set(
    checklistOptions
      .flatMap((option) => [
        option.label,
        option.value,
        option.group && option.value ? `${option.group}: ${option.value}` : ""
      ])
      .map(normalizeKitchenOptionText)
      .filter(Boolean)
  );

  return (Array.isArray(item.options) ? item.options : [])
    .filter(Boolean)
    .filter((option) => !checklistKeys.has(normalizeKitchenOptionText(option)));
}

function buildSummaryLines(order = {}) {
  const groups = new Map();
  (Array.isArray(order.items) ? order.items : []).forEach((item) => {
    const checklistOptions = getChecklistOptions(item);
    const options = getDisplayOptions(item, checklistOptions);
    const note = String(item.note || "").trim();
    const checklistKey = checklistOptions.map((option) => option.label).join("|");
    const key = `${item.name || ""}__${options.join("|")}__${checklistKey}__${note}`;
    const current = groups.get(key) || {
      key,
      name: item.name || "Không tên món",
      quantity: 0,
      options,
      checklistOptions,
      note,
      units: []
    };
    const quantity = getQuantity(item);
    current.quantity += quantity;
    Array.from({ length: quantity }).forEach((_, unitIndex) => current.units.push({ item, unitIndex }));
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

function DoneBox({ done, title }) {
  return (
    <span
      title={title}
      style={{
        width: 15,
        height: 15,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        borderRadius: 4,
        border: done ? "1px solid #15803d" : "1px solid #94a3b8",
        background: done ? "#16a34a" : "#ffffff",
        color: "#ffffff",
        fontSize: 11,
        fontWeight: 950,
        lineHeight: 1
      }}
    >
      {done ? "✓" : ""}
    </span>
  );
}

function UnitBoxes({ line, order, unitProgress, toppingProgress }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {line.units.map(({ item, unitIndex }, index) => {
        const done = isKitchenUnitDone({
          unitProgress,
          toppingProgress,
          order,
          item,
          unitIndex
        });
        return (
          <DoneBox
            key={`${line.key}-${index}`}
            title={done ? "Đã hoàn thành" : "Đang làm"}
            done={done}
          />
        );
      })}
    </div>
  );
}

function ChecklistToppings({ line, order, toppingProgress }) {
  if (!line.checklistOptions.length) return null;

  const groups = new Map();
  line.checklistOptions.forEach((option) => {
    const groupName = String(option.group || "Topping").trim() || "Topping";
    const group = groups.get(groupName) || [];
    group.push(option);
    groups.set(groupName, group);
  });

  return (
    <div style={{ display: "grid", gap: 7, paddingLeft: 27 }}>
      {Array.from(groups.entries()).map(([groupName, options]) => (
        <div key={`${line.key}-${groupName}`} style={{ display: "grid", gap: 5 }}>
          <strong style={{ color: "#92400e", fontSize: 10, fontWeight: 950, textTransform: "uppercase" }}>
            {groupName}
          </strong>
          {options.map((option) => (
            <div
              key={`${line.key}-${option.label}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                border: "1px solid #f59e0b",
                background: "#f59e0b",
                color: "#ffffff",
                borderRadius: 7,
                padding: "7px 8px"
              }}
            >
              <strong style={{ minWidth: 0, fontSize: 11, fontWeight: 850, lineHeight: 1.3 }}>
                {option.value || option.label}
              </strong>
              <span style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
                {line.units.map(({ item, unitIndex }, index) => {
                  const itemOption = getChecklistOptions(item).find((candidate) => (
                    normalizeKitchenOptionText(candidate.label) === normalizeKitchenOptionText(option.label)
                  ));
                  if (!itemOption) return null;
                  const done = isKitchenToppingDone({
                    toppingProgress,
                    order,
                    item,
                    unitIndex,
                    option: itemOption
                  });
                  return (
                    <DoneBox
                      key={`${getKitchenProgressItemKey(order, item)}-${unitIndex}-${option.label}-${index}`}
                      done={done}
                      title={done ? "Topping đã hoàn thành" : "Topping đang chờ làm"}
                    />
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function KitchenOrderSummaryPanel({ order = null }) {
  const [unitProgress, setUnitProgress] = useState(() => readKitchenProgress(KITCHEN_UNIT_PROGRESS_STORAGE_KEY));
  const [toppingProgress, setToppingProgress] = useState(() => readKitchenProgress(KITCHEN_TOPPING_PROGRESS_STORAGE_KEY));
  const lines = useMemo(() => buildSummaryLines(order || {}), [order]);

  useEffect(() => {
    const handleProgress = () => {
      setUnitProgress(readKitchenProgress(KITCHEN_UNIT_PROGRESS_STORAGE_KEY));
      setToppingProgress(readKitchenProgress(KITCHEN_TOPPING_PROGRESS_STORAGE_KEY));
    };
    window.addEventListener(KITCHEN_PROGRESS_EVENT, handleProgress);
    window.addEventListener("storage", handleProgress);
    return () => {
      window.removeEventListener(KITCHEN_PROGRESS_EVENT, handleProgress);
      window.removeEventListener("storage", handleProgress);
    };
  }, []);

  return (
    <aside style={{ position: "sticky", top: 8, height: "100%", minHeight: 0, overflow: "hidden" }}>
      <section style={{ height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", border: "1px solid #dbe3ef", background: "#ffffff", borderRadius: 10, overflow: "hidden" }}>
        <header style={{ borderBottom: "1px solid #e5e7eb", background: "#f8fafc", padding: "11px 12px" }}>
          <strong style={{ display: "block", color: "#111827", fontSize: 15 }}>Tóm tắt đơn</strong>
          <span style={{ color: "#64748b", fontSize: 11, fontWeight: 750 }}>
            {order ? order.displayOrderCode || order.orderCode || order.id : "Chọn một đơn bên trái"}
          </span>
        </header>

        <div style={{ minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start", gap: 4, padding: 10 }}>
          {order && lines.length ? lines.map((line) => {
            const doneCount = line.units.filter(({ item, unitIndex }) => isKitchenUnitDone({
              unitProgress,
              toppingProgress,
              order,
              item,
              unitIndex
            })).length;
            const fullyDone = doneCount === line.units.length;
            return (
              <article key={line.key} style={{ display: "grid", gap: 7, borderBottom: "1px solid #e5e7eb", padding: "10px 4px 13px", opacity: fullyDone ? 0.58 : 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 7, alignItems: "start" }}>
                  <span style={{ color: "#64748b", fontSize: 13 }}>{line.quantity}x</span>
                  <strong style={{ color: "#111827", fontSize: 14, lineHeight: 1.35, textDecoration: fullyDone ? "line-through" : "none" }}>{line.name}</strong>
                </div>
                {line.options.length ? (
                  <div style={{ display: "grid", gap: 4, paddingLeft: 27 }}>
                    {line.options.map((option) => {
                      const parsed = parseKitchenOptionLabel(option);
                      return (
                        <div key={`${line.key}-${option}`} style={{ color: "#64748b", fontSize: 12 }}>
                          <span>{parsed.group ? `${parsed.group}: ${parsed.value}` : option}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <ChecklistToppings
                  line={line}
                  order={order}
                  toppingProgress={toppingProgress}
                />
                {line.note ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 2,
                      marginLeft: 27,
                      border: "1px solid #facc15",
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: 8,
                      padding: "8px 9px"
                    }}
                  >
                    <strong style={{ fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>Ghi chú</strong>
                    <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>{line.note}</span>
                  </div>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 27 }}>
                  <UnitBoxes
                    line={line}
                    order={order}
                    unitProgress={unitProgress}
                    toppingProgress={toppingProgress}
                  />
                  <small style={{ color: fullyDone ? "#15803d" : "#64748b", fontWeight: 850 }}>{doneCount}/{line.units.length}</small>
                </div>
              </article>
            );
          }) : (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 10, padding: 16, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
              Bấm vào một đơn bên cột trái để xem đúng món của đơn đó.
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
