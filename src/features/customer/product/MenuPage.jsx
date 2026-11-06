import MenuStorefront from "../../menu/components/MenuStorefront.jsx";

export default function MenuPage({ render: Render, ...props }) {
  const isQr = String(props.checkoutPreset?.orderSource || props.checkoutPreset?.source || "").toLowerCase() === "qr_counter" || /^\/qr\//.test(window.location.pathname);
  if (isQr) return <Render {...props} />;
  return (
    <div className="customer-menu-store">
      <MenuStorefront {...props} coupons={props.homeCoupons || props.coupons} smartPromotions={props.homeSmartPromotions || props.smartPromotions} />
      <Render {...props} openProduct={props.openOptionModal} storefront />
    </div>
  );
}
