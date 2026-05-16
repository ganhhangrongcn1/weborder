import PromoModal from "./PromoModal.jsx";
import AddressModal from "./AddressModal.jsx";
import DeliveryFeeModal from "./DeliveryFeeModal.jsx";
import CheckoutNoticeModal from "./CheckoutNoticeModal.jsx";

export default function CheckoutModals({
  isPromoModalOpen,
  promoCodes,
  selectedPromo,
  setSelectedPromo,
  setIsPromoModalOpen,
  isAddressModalOpen,
  deliveryInfo,
  demoAddresses,
  subtotal,
  deliveryEligibleBranches,
  selectedDeliveryBranchId,
  setSelectedDeliveryBranchId,
  handleSelectAddress,
  setIsAddressModalOpen,
  deliveryOrigin,
  shippingConfig,
  handleSaveAddress,
  setShippingNeedsRefresh,
  isDeliveryFeeModalOpen,
  shippingZonesFromConfig,
  deliveryZones,
  fulfillmentType,
  deliveryDistanceKm,
  baseCheckoutShip,
  deliveryFeeSource,
  deliverySourceBranch,
  setIsDeliveryFeeModalOpen,
  checkoutNotice,
  setCheckoutNotice
}) {
  return (
    <>
      {isPromoModalOpen ? (
        <PromoModal
          promos={promoCodes}
          selectedPromo={selectedPromo}
          onSelect={(promo) => {
            setSelectedPromo(selectedPromo?.id === promo.id ? null : promo);
            setIsPromoModalOpen(false);
          }}
          onClose={() => setIsPromoModalOpen(false)}
        />
      ) : null}

      {isAddressModalOpen ? (
        <AddressModal
          value={deliveryInfo}
          addresses={demoAddresses}
          subtotal={subtotal}
          deliveryBranches={deliveryEligibleBranches}
          selectedDeliveryBranchId={selectedDeliveryBranchId}
          onSelectDeliveryBranch={(nextBranchId) => {
            if (String(nextBranchId || "") === String(selectedDeliveryBranchId || "")) return;
            setSelectedDeliveryBranchId(nextBranchId);
            setShippingNeedsRefresh?.(true);
            setCheckoutNotice({
              icon: "warning",
              title: "Vui lòng kiểm tra lại địa chỉ nhận hàng",
              message: "Bạn vừa đổi chi nhánh giao hàng. Hãy chọn lại địa chỉ nhận để cập nhật phí ship chính xác."
            });
          }}
          onSelectAddress={handleSelectAddress}
          onClose={() => setIsAddressModalOpen(false)}
          deliveryOrigin={deliveryOrigin}
          shippingConfig={shippingConfig}
          onSave={(nextInfo) => {
            handleSaveAddress(nextInfo);
            setIsAddressModalOpen(false);
          }}
        />
      ) : null}

      {isDeliveryFeeModalOpen ? (
        <DeliveryFeeModal
          zones={shippingZonesFromConfig.length ? shippingZonesFromConfig : deliveryZones}
          fulfillmentType={fulfillmentType}
          distanceKm={deliveryDistanceKm}
          deliveryFee={baseCheckoutShip}
          source={
            shippingConfig.customerNote
              ? `${deliveryFeeSource} • ${deliverySourceBranch?.name || "Chi nhánh 1"} • ${shippingConfig.customerNote}`
              : `${deliveryFeeSource} • ${deliverySourceBranch?.name || "Chi nhánh 1"}`
          }
          onClose={() => setIsDeliveryFeeModalOpen(false)}
        />
      ) : null}

      <CheckoutNoticeModal notice={checkoutNotice} onClose={() => setCheckoutNotice(null)} />
    </>
  );
}
