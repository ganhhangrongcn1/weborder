import { useState } from "react";
import GoongAddressPicker from "../../../components/GoongAddressPicker.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

export default function AddressModal({
  value,
  addresses = [],
  subtotal = 0,
  deliveryBranches = [],
  selectedDeliveryBranchId = "",
  onSelectDeliveryBranch,
  deliveryOrigin,
  shippingConfig,
  onSelectAddress,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    address: "",
    placeId: "",
    lat: null,
    lng: null,
    distanceKm: null,
    durationText: "",
    saveToAccount: false,
    ...value
  });
  const [showSaved, setShowSaved] = useState(false);
  const savedPreview = addresses[0];
  const selectedDeliveryBranch = deliveryBranches.find((branch) => branch.id === selectedDeliveryBranchId) || null;

  function updateField(field, nextValue) {
    setDraft((current) => ({
      ...current,
      [field]: nextValue
    }));
  }

  return (
    <CustomerBottomSheet
      title="Đổi thông tin giao hàng"
      subtitle="Cập nhật tên, số điện thoại và địa chỉ nhận món"
      ariaLabel="Đổi địa chỉ giao hàng"
      onClose={onClose}
      className="promo-sheet"
    >
      <div className="space-y-3">
        {savedPreview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase text-brown/50">Địa chỉ đã lưu</p>
              {addresses.length > 1 && (
                <button onClick={() => setShowSaved((current) => !current)} className="text-xs font-black text-orange-600">
                  {showSaved ? "Thu gọn" : `Xem ${addresses.length} địa chỉ`}
                </button>
              )}
            </div>
            {(showSaved ? addresses.slice(0, 3) : [savedPreview]).map((address) => (
              <button
                key={address.id}
                onClick={() => {
                  onSelectAddress(address);
                  onClose();
                }}
                className="w-full rounded-2xl border border-orange-100 bg-white px-3 py-2 text-left text-xs shadow-sm"
              >
                <strong className="block text-brown">{address.label}{address.isDefault ? " · GIAO ĐẾN" : ""}</strong>
                <span className="mt-1 block text-brown/55">{address.address}</span>
              </button>
            ))}
          </div>
        )}

        <div className="delivery-branch-select-card">
          <p className="text-xs font-black uppercase text-brown/50">Chi nhánh giao hàng</p>
          <label className="address-field">
            <select value={selectedDeliveryBranchId} onChange={(event) => onSelectDeliveryBranch?.(event.target.value)}>
              {deliveryBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {selectedDeliveryBranch && (
            <div className="delivery-branch-select-note">
              <strong>{selectedDeliveryBranch.name}</strong>
              <span>{selectedDeliveryBranch.address}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="address-field">
            <span>Tên khách hàng</span>
            <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label className="address-field">
            <span>Số điện thoại</span>
            <input value={draft.phone} onChange={(event) => updateField("phone", event.target.value)} />
          </label>
        </div>

        <GoongAddressPicker
          key={selectedDeliveryBranchId || "default-delivery-origin"}
          origin={deliveryOrigin}
          shippingConfig={shippingConfig}
          value={{
            addressText: draft.address,
            placeId: draft.placeId,
            lat: draft.lat,
            lng: draft.lng,
            distanceKm: draft.distanceKm,
            durationText: draft.durationText
          }}
          onChange={(nextAddress) => setDraft((current) => ({
            ...current,
            address: nextAddress.addressText,
            placeId: nextAddress.placeId,
            lat: nextAddress.lat,
            lng: nextAddress.lng,
            distanceKm: nextAddress.distanceKm,
            durationText: nextAddress.durationText,
            deliveryFee: nextAddress.deliveryFee,
            shippingStatus: nextAddress.shippingStatus
          }))}
        />

        <label className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm font-bold text-brown/70">
          <span>Lưu địa chỉ này vào tài khoản</span>
          <input
            type="checkbox"
            checked={Boolean(draft.saveToAccount)}
            onChange={(event) => updateField("saveToAccount", event.target.checked)}
            className="toggle-input"
          />
        </label>

        <button onClick={() => onSave(draft)} className="cta w-full">Lưu thông tin</button>
      </div>
    </CustomerBottomSheet>
  );
}
