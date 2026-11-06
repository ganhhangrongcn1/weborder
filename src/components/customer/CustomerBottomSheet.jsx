import CustomerControl from "./CustomerControl.jsx";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon.jsx";

const SHEET_LOCK_CLASS = "customer-sheet-open";
const SHEET_LOCK_COUNT_ATTR = "data-customer-sheet-lock-count";
const sheetStack = [];
let sheetLayer = 0;

function updateSheetStack() {
  sheetStack.sort((a, b) => Number(a.dataset.popupLayer) - Number(b.dataset.popupLayer));
  const top = sheetStack[sheetStack.length - 1];
  sheetStack.forEach((dialog) => {
    dialog.inert = dialog !== top;
    dialog.setAttribute("aria-modal", dialog === top ? "true" : "false");
    if (dialog === top) dialog.removeAttribute("aria-hidden");
    else dialog.setAttribute("aria-hidden", "true");
  });
}

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
  onBackdropClose,
  backdropClassName = "",
  className = "",
  contentClassName = "",
  footer = null,
  showHeader = true,
  showHandle = true,
  placement = "bottom"
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const layerRef = useRef(null);
  if (layerRef.current === null) layerRef.current = ++sheetLayer;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.dataset.popupLayer = String(layerRef.current);
    sheetStack.push(dialog);
    dialog.parentElement.style.zIndex = String(1200 + layerRef.current);
    updateSheetStack();
    lockBodyScroll();
    return () => {
      const index = sheetStack.indexOf(dialog);
      if (index >= 0) sheetStack.splice(index, 1);
      updateSheetStack();
      unlockBodyScroll();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement;
    if (!dialog) return undefined;

    dialog.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (sheetStack[sheetStack.length - 1] !== dialog) return;
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
      const top = sheetStack[sheetStack.length - 1];
      if (previousActiveElement?.isConnected && (!top || top.contains(previousActiveElement)) && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, []);

  function handleBackdropClick(event) {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    (onBackdropClose || onClose)?.(event);
  }

  const sheet = (
    <div data-popup-layout={placement === "center" ? "center" : "sheet"} className={`customer-sheet-backdrop ${backdropClassName}`.trim()} onClick={handleBackdropClick}>
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
              <CustomerControl type="button" className="customer-sheet-close" onClick={onClose} aria-label="Đóng">
                <Icon name="close" size={23} />
              </CustomerControl>
            ) : null}
          </div>
        ) : null}
        <div className={`customer-sheet-scroll ${contentClassName}`.trim()}>{children}</div>
        {footer ? <div className="customer-sheet-footer">{footer}</div> : null}
      </section>
    </div>
  );
  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
