import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

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
    >
      <section className="home-popup-image-only">
        <button type="button" className="home-popup-close" onClick={onClose}>×</button>
        <button
          type="button"
          className="home-popup-image-wrap"
          onClick={onClickPopup}
        >
          <img src={popup.image} alt={popup.title || "Popup"} className="home-popup-image" />
        </button>
      </section>
    </CustomerBottomSheet>
  );
}
