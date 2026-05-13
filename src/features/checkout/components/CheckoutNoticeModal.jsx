import Icon from "../../../components/Icon.jsx";

export default function CheckoutNoticeModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-slate-900/40 px-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={notice?.title || "Thông báo"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
            <Icon name={notice?.icon || "warning"} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">{notice?.title || "Thông báo"}</h3>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{notice?.message || ""}</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white"
          onClick={onClose}
        >
          Đã hiểu
        </button>
      </section>
    </div>
  );
}

