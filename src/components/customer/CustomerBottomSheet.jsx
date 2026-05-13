import { useEffect } from "react";

let openSheetCount = 0;

function lockBodyScroll() {
  openSheetCount += 1;
  if (openSheetCount !== 1) return;
  document.documentElement.classList.add("customer-sheet-open");
  document.body.classList.add("customer-sheet-open");
}

function unlockBodyScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount !== 0) return;
  document.documentElement.classList.remove("customer-sheet-open");
  document.body.classList.remove("customer-sheet-open");
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
