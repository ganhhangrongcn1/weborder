import { useEffect } from "react";

const SHEET_LOCK_CLASS = "customer-sheet-open";
const SHEET_LOCK_COUNT_ATTR = "data-customer-sheet-lock-count";

function getOpenSheetCount() {
  return Number(document.documentElement.getAttribute(SHEET_LOCK_COUNT_ATTR) || 0);
}

function setOpenSheetCount(nextCount) {
  document.documentElement.setAttribute(SHEET_LOCK_COUNT_ATTR, String(Math.max(0, nextCount)));
}

function applyScrollLock() {
  document.documentElement.classList.add(SHEET_LOCK_CLASS);
  document.body.classList.add(SHEET_LOCK_CLASS);
}

function clearScrollLock() {
  document.documentElement.classList.remove(SHEET_LOCK_CLASS);
  document.body.classList.remove(SHEET_LOCK_CLASS);
  document.documentElement.removeAttribute(SHEET_LOCK_COUNT_ATTR);
}

function lockBodyScroll() {
  const nextCount = getOpenSheetCount() + 1;
  setOpenSheetCount(nextCount);
  applyScrollLock();
}

function unlockBodyScroll() {
  const nextCount = Math.max(0, getOpenSheetCount() - 1);
  if (nextCount > 0) {
    setOpenSheetCount(nextCount);
    return;
  }
  clearScrollLock();
}

export default function CustomerBottomSheet({
  children,
  title,
  subtitle,
  ariaLabel,
  onClose,
  closeOnBackdrop = true,
  backdropClassName = "",
  className = "",
  contentClassName = "",
  footer = null,
  showHeader = true,
  showHandle = true
}) {
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);

  function handleBackdropClick(event) {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose?.(event);
  }

  return (
    <div className={`customer-sheet-backdrop ${backdropClassName}`.trim()} onClick={handleBackdropClick}>
      <section
        className={`customer-bottom-sheet ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || "Hộp thoại"}
      >
        {showHandle ? <div className="customer-sheet-handle" /> : null}
        {showHeader ? (
          <div className="customer-sheet-header">
            <div className="customer-sheet-title">
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {onClose ? (
              <button type="button" className="customer-sheet-close" onClick={onClose} aria-label="Đóng">
                X
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={`customer-sheet-scroll ${contentClassName}`.trim()}>{children}</div>
        {footer ? <div className="customer-sheet-footer">{footer}</div> : null}
      </section>
    </div>
  );
}
