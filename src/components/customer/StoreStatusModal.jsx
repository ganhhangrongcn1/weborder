import { useEffect } from "react";
import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

function isOrderStatusNotice(type = "") {
  return type === "order_ready_pickup" || type === "order_delivering";
}

function getNoticeTone(type = "") {
  if (type === "order_delivering") {
    return {
      icon: "bike",
      soft: "bg-blue-50",
      text: "text-blue-600",
      badge: "bg-blue-600",
      actionText: "\u0110\u00e3 hi\u1ec3u"
    };
  }

  if (type === "order_ready_pickup") {
    return {
      icon: "bag",
      soft: "bg-green-50",
      text: "text-green-600",
      badge: "bg-green-600",
      actionText: "\u0110\u00e3 hi\u1ec3u, m\u00ecnh ra l\u1ea5y"
    };
  }

  return {
    icon: "warning",
    soft: "bg-orange-50",
    text: "text-orange-600",
    badge: "bg-slate-900",
    actionText: "\u0110\u00e3 hi\u1ec3u"
  };
}

function triggerCustomerAttention(type = "") {
  if (!isOrderStatusNotice(type)) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

  try {
    navigator.vibrate(type === "order_ready_pickup" ? [140, 70, 140] : [90, 60, 90]);
  } catch {
  }
}

export default function StoreStatusModal({ notice, onClose }) {
  const type = notice?.type || "";
  const tone = getNoticeTone(type);
  const shouldAttractAttention = isOrderStatusNotice(type);

  useEffect(() => {
    if (!notice) return;
    triggerCustomerAttention(type);
  }, [notice, type]);

  if (!notice) return null;

  return (
    <CustomerBottomSheet
      ariaLabel="Th\u00f4ng b\u00e1o tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng"
      onClose={onClose}
      className={`promo-sheet ${shouldAttractAttention ? "order-status-alert-sheet" : ""}`.trim()}
      showHeader={false}
      footer={<button onClick={onClose} className="cta w-full">{tone.actionText}</button>}
    >
      <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${tone.soft} ${shouldAttractAttention ? "order-status-alert-icon" : ""}`}>
        <span className={`grid h-10 w-10 place-items-center rounded-full bg-white ${tone.text}`}>
          <Icon name={tone.icon} size={18} />
        </span>
      </div>
      <div className="mb-4 text-center" role={shouldAttractAttention ? "alert" : undefined} aria-live={shouldAttractAttention ? "assertive" : undefined}>
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white ${tone.badge}`}>
          {notice.badge || "\u0110ang \u0111\u00f3ng c\u1eeda"}
        </span>
        <h2 className="customer-modal-title mt-3 text-brown">{notice.title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-brown/70">{notice.description || notice.message}</p>
      </div>
    </CustomerBottomSheet>
  );
}
