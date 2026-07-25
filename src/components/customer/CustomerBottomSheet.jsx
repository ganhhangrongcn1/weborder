import { useEffect, useRef } from "react";

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
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement;
    if (!dialog) return undefined;

    dialog.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(dialog.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      ));

      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (typeof previousActiveElement?.focus === "function") {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, []);

  function handleBackdropClick(event) {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose?.(event);
  }

  return (
    <div className={`customer-sheet-backdrop ${backdropClassName}`.trim()} onClick={handleBackdropClick}>
      <section
        ref={dialogRef}
        className={`customer-bottom-sheet ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || "Hộp thoại"}
        tabIndex={-1}
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
