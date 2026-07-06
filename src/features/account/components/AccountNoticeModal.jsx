import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function AccountNoticeModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <CustomerBottomSheet
      ariaLabel={notice.title || "Thông báo"}
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
      footer={(
        <button type="button" className="cta w-full" onClick={onClose}>
          Đã hiểu
        </button>
      )}
    >
      <div className="space-y-4 pb-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[#fff1e6] text-[#ff6a00]">
          <Icon name={notice.icon || "warning"} size={22} />
        </span>
        <div className="space-y-2">
          <h2 className="customer-modal-title text-brown">
            {notice.title || "Thông báo"}
          </h2>
          <p className="text-sm font-semibold leading-6 text-brown/70">
            {notice.message}
          </p>
        </div>
      </div>
    </CustomerBottomSheet>
  );
}
