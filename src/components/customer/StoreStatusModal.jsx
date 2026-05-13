import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";

export default function StoreStatusModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <CustomerBottomSheet
      ariaLabel="Thông báo trạng thái quán"
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
    >
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-orange-50">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-orange-600">
          <Icon name="warning" size={18} />
        </span>
      </div>
      <div className="mb-4 text-center">
        <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
          {notice.badge || "Đang đóng cửa"}
        </span>
        <h2 className="mt-3 text-2xl font-black leading-tight text-brown">{notice.title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-brown/70">{notice.description}</p>
      </div>
      <button onClick={onClose} className="cta w-full">Đã hiểu</button>
    </CustomerBottomSheet>
  );
}
