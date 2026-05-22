import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

export default function StoreStatusModal({ notice, onClose }) {
  if (!notice) return null;
  const tone = notice.type === "order_delivering"
    ? { icon: "bike", soft: "bg-blue-50", text: "text-blue-600", badge: "bg-blue-600" }
    : notice.type === "order_ready_pickup"
      ? { icon: "bag", soft: "bg-green-50", text: "text-green-600", badge: "bg-green-600" }
      : { icon: "warning", soft: "bg-orange-50", text: "text-orange-600", badge: "bg-slate-900" };

  return (
    <CustomerBottomSheet
      ariaLabel="Thông báo trạng thái quán"
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
      footer={<button onClick={onClose} className="cta w-full">Đã hiểu</button>}
    >
      <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${tone.soft}`}>
        <span className={`grid h-10 w-10 place-items-center rounded-full bg-white ${tone.text}`}>
          <Icon name={tone.icon} size={18} />
        </span>
      </div>
      <div className="mb-4 text-center">
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white ${tone.badge}`}>
          {notice.badge || "Đang đóng cửa"}
        </span>
        <h2 className="mt-3 text-2xl font-black leading-tight text-brown">{notice.title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-brown/70">{notice.description || notice.message}</p>
      </div>
    </CustomerBottomSheet>
  );
}
