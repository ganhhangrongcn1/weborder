import { useState } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function AccountAddressModal({
  address,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    label: "Giao gần nhất",
    receiverName: "Khách",
    phone: "0123456789",
    address: "",
    note: "",
    isDefault: false,
    ...address
  });
  const update = (field, value) => setDraft((current) => ({
    ...current,
    [field]: value
  }));

  return (
    <CustomerBottomSheet
      title={draft.id ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
      subtitle="Địa chỉ sẽ được dùng để tự điền ở checkout."
      ariaLabel="Quản lý địa chỉ"
      onClose={onClose}
      className="promo-sheet"
      footer={<CustomerButton full onClick={() => onSave(draft)}>Lưu địa chỉ</CustomerButton>}
    >
      <div className="space-y-3">
        <label className="address-field">
          <span>Nhãn địa chỉ</span>
          <input value={draft.label} onChange={(event) => update("label", event.target.value)} />
        </label>
        <label className="address-field">
          <span>Tên người nhận</span>
          <input value={draft.receiverName} onChange={(event) => update("receiverName", event.target.value)} />
        </label>
        <label className="address-field">
          <span>Số điện thoại</span>
          <input value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
        </label>
        <label className="address-field">
          <span>Địa chỉ</span>
          <textarea rows="3" value={draft.address} onChange={(event) => update("address", event.target.value)} />
        </label>
        <label className="address-field">
          <span>Ghi chú</span>
          <input value={draft.note} onChange={(event) => update("note", event.target.value)} />
        </label>
        <CustomerCard as="label" padding="sm" className="flex items-center justify-between">
          <span className="text-sm font-bold text-brown/70">Đặt làm địa chỉ mặc định</span>
          <input
            type="checkbox"
            checked={Boolean(draft.isDefault)}
            onChange={(event) => update("isDefault", event.target.checked)}
            className="toggle-input"
          />
        </CustomerCard>
      </div>
    </CustomerBottomSheet>
  );
}
