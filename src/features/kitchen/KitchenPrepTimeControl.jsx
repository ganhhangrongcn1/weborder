import { useEffect, useMemo, useState } from "react";

const MIN_PREP_MINUTES = 0;
const MAX_PREP_MINUTES = 30;

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getPrepMetadata(order = {}) {
  const rawData = getObject(order.rawData);
  const raw = getObject(order.raw);
  const nestedRawData = getObject(raw.raw_data);
  const candidates = [
    getObject(order.mexOpt),
    getObject(order.mex_opt),
    getObject(rawData.mex_opt),
    getObject(rawData.mexOpt),
    getObject(getObject(rawData.data).mex_opt),
    getObject(nestedRawData.mex_opt),
    getObject(getObject(nestedRawData.data).mex_opt)
  ];

  return candidates.find((candidate) => Object.keys(candidate).length > 0) || {};
}

function clampMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return MIN_PREP_MINUTES;
  return Math.min(MAX_PREP_MINUTES, Math.max(MIN_PREP_MINUTES, Math.round(number)));
}

function getBaseMinutes(metadata = {}) {
  const submittedSeconds = Number(metadata.submitted_opt_in_sec);
  if (!Number.isFinite(submittedSeconds) || submittedSeconds < 0) return null;
  return clampMinutes(submittedSeconds / 60);
}

function isGrabOrder(order = {}) {
  return ["grab", "grabfood"].includes(String(
    order.partnerSource || order.source || order.platform || ""
  ).trim().toLowerCase());
}

function isPrepTimeEditable(metadata = {}) {
  if (!Object.keys(metadata).length) return false;
  if (Number(metadata.source_opt) !== 0) return false;
  if (metadata.is_editable === false) return false;

  const editableUntil = metadata.editable_until ? new Date(metadata.editable_until).getTime() : 0;
  if (editableUntil && Number.isFinite(editableUntil) && editableUntil <= Date.now()) return false;

  const estimatedDoneAt = metadata.estimated_done_at ? new Date(metadata.estimated_done_at).getTime() : 0;
  if (estimatedDoneAt && Number.isFinite(estimatedDoneAt) && estimatedDoneAt <= Date.now()) return false;
  return true;
}

export default function KitchenPrepTimeControl({ compact = false, order, onAdjust }) {
  const metadata = useMemo(() => getPrepMetadata(order), [order]);
  const baseMinutes = getBaseMinutes(metadata);
  const [selectedMinutes, setSelectedMinutes] = useState(baseMinutes ?? 0);
  const [savedMinutes, setSavedMinutes] = useState(baseMinutes ?? 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (baseMinutes === null) return;
    setSelectedMinutes(baseMinutes);
    setSavedMinutes(baseMinutes);
  }, [baseMinutes, order.id]);

  const editable = isPrepTimeEditable(metadata);
  const changed = selectedMinutes !== savedMinutes;
  if (!isGrabOrder(order) || !Object.keys(metadata).length || baseMinutes === null || !editable) return null;

  async function handleSubmit(event) {
    event.stopPropagation();
    if (!editable || !changed || submitting) return;

    setSubmitting(true);
    const result = await onAdjust?.(order, selectedMinutes);
    if (result?.ok) {
      const nextMinutes = clampMinutes(result.prepMinutes ?? selectedMinutes);
      setSelectedMinutes(nextMinutes);
      setSavedMinutes(nextMinutes);
    }
    setSubmitting(false);
  }

  function changeMinutes(event, delta) {
    event.stopPropagation();
    if (!editable || submitting) return;
    setSelectedMinutes((current) => clampMinutes(current + delta));
  }

  return (
    <section
      onClick={(event) => event.stopPropagation()}
      style={{
        border: "1px solid #fed7aa",
        background: "#fff7ed",
        borderRadius: 7,
        padding: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        minHeight: 28,
        gap: compact ? 2 : 4,
        maxWidth: "100%",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: compact ? 2 : 4, minWidth: 0 }}>
          <button
            type="button"
            aria-label="Giảm một phút"
            disabled={!editable || selectedMinutes <= MIN_PREP_MINUTES || submitting}
            onClick={(event) => changeMinutes(event, -1)}
            style={{
              border: "1px solid #fdba74",
              background: "#ffffff",
              color: "#9a3412",
              borderRadius: 6,
              width: compact ? 24 : 28,
              height: compact ? 24 : 28,
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
              fontWeight: 900,
              cursor: !editable || selectedMinutes <= MIN_PREP_MINUTES || submitting ? "not-allowed" : "pointer"
            }}
          >
            −
          </button>
          <strong
            style={{
              color: "#c2410c",
              minWidth: compact ? 32 : 52,
              textAlign: "center",
              fontSize: compact ? 11 : 13,
              fontWeight: 950,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap"
            }}
          >
            {compact ? `${selectedMinutes}p` : `${selectedMinutes} phút`}
          </strong>
          <button
            type="button"
            aria-label="Tăng một phút"
            disabled={!editable || selectedMinutes >= MAX_PREP_MINUTES || submitting}
            onClick={(event) => changeMinutes(event, 1)}
            style={{
              border: "1px solid #fdba74",
              background: "#ffffff",
              color: "#9a3412",
              borderRadius: 6,
              width: compact ? 24 : 28,
              height: compact ? 24 : 28,
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
              fontWeight: 900,
              cursor: !editable || selectedMinutes >= MAX_PREP_MINUTES || submitting ? "not-allowed" : "pointer"
            }}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Xác nhận thời gian làm đơn"
            title={compact ? "Xác nhận thời gian" : undefined}
            disabled={!editable || !changed || submitting}
            onClick={handleSubmit}
            style={{
              border: changed ? "1px solid #ea580c" : "1px solid #fed7aa",
              background: changed ? "#ea580c" : "#ffedd5",
              color: changed ? "#ffffff" : "#9a3412",
              borderRadius: 6,
              width: compact ? 24 : "auto",
              minHeight: compact ? 24 : 28,
              padding: compact ? 0 : "4px 9px",
              fontSize: compact ? 13 : 10,
              fontWeight: 900,
              whiteSpace: "nowrap",
              cursor: !editable || !changed || submitting ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "…" : compact ? "✓" : "Xác nhận"}
          </button>
      </div>
    </section>
  );
}
