import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function CheckoutNoticeModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <CustomerBottomSheet
      ariaLabel={notice?.title || "Thông báo"}
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
      footer={(
        <button
          type="button"
          className="cta w-full"
          onClick={onClose}
        >
          Đã hiểu
        </button>
      )}
    >
      <div className="space-y-4 pb-2">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600">
            <Icon name={notice?.icon || "warning"} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">
              {notice?.title || "Thông báo"}
            </h3>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              {notice?.message || ""}
            </p>
          </div>
        </div>
      </div>
    </CustomerBottomSheet>
  );
}
