import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import Icon from "../../../components/Icon.jsx";

export default function HomePromoPopup({
  open,
  popup,
  onClose,
  onClickPopup
}) {
  if (!open || !popup) return null;

  return (
    <CustomerBottomSheet
      ariaLabel={popup.title || "Popup khuyến mãi"}
      onClose={onClose}
      backdropClassName="home-popup-backdrop"
      className="home-popup-sheet"
      contentClassName="home-popup-sheet-scroll"
      showHeader={false}
      showHandle={false}
      placement="center"
    >
      <section className="home-popup-image-only">
        <CustomerControl
          type="button"
          className="home-popup-close"
          onClick={onClose}
          aria-label="Đóng khuyến mãi"
        >
          <Icon name="close" size={23} />
        </CustomerControl>
        <CustomerControl
          type="button"
          className="home-popup-image-wrap"
          onClick={onClickPopup}
          aria-label="Đặt món ngay - Chọn chi nhánh"
        >
          <img src={popup.image} alt={popup.title || "Đặt trước ghé lấy"} className="home-popup-image" width="1100" height="1402" />
        </CustomerControl>
      </section>
    </CustomerBottomSheet>
  );

}
