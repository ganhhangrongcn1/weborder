import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";
import { getBranchHours, getClosingSoonText } from "../homeHelpers.js";

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isBranchOpenNow(branch) {
  const { openMinutes, closeMinutes } = getBranchHours(branch);
  if (openMinutes === null || closeMinutes === null) return true;

  const nowMinutes = getNowMinutes();
  if (openMinutes === closeMinutes) return true;

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

export default function HomeBranchPlannerModal({
  open,
  onBackdropClose,
  onClose,
  title,
  subtitle,
  ariaLabel,
  branches,
  selectedBranchId,
  onSelectBranch,
  onConfirm,
  confirmLabel = "Xong, vào menu",
  iconName = "home",
  disabledConfirm = false
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEsc = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) || null;
  const selectedBranchOpen = selectedBranch ? isBranchOpenNow(selectedBranch) : true;
  const isConfirmDisabled = disabledConfirm || !selectedBranchOpen;

  return createPortal(
    <div
      className="branch-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || "Chọn chi nhánh"}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (onBackdropClose) onBackdropClose();
      }}
    >
      <section className="branch-picker-panel" onClick={(event) => event.stopPropagation()}>
        <div className="branch-picker-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="branch-picker-close" onClick={onClose} aria-label="Đóng">X</button>
        </div>

        <div className="branch-picker-list">
          {branches.map((branch) => {
            const openNow = isBranchOpenNow(branch);
            const closingSoonText = openNow ? getClosingSoonText(branch) : "";

            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => {
                  if (!openNow) return;
                  onSelectBranch(branch.id);
                }}
                className={`branch-card ${selectedBranchId === branch.id ? "branch-card-active" : ""} ${openNow ? "" : "branch-card-closed"}`}
                disabled={!openNow}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                  <Icon name={iconName} size={18} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <strong>{branch.name}</strong>
                  <small>{branch.address}</small>
                  <em>Giờ hoạt động: {getBranchHours(branch).label}</em>
                  {!openNow ? <small className="branch-closed-warning">Chi nhánh đã đóng cửa.</small> : null}
                  {closingSoonText ? <small className="branch-closing-warning">{closingSoonText}</small> : null}
                </span>
                <span className="branch-radio">{selectedBranchId === branch.id ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <div className="branch-picker-footer">
          <button onClick={onConfirm} className="cta w-full" disabled={isConfirmDisabled}>{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
