import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import {
  formatCustomerAddressLabel,
  formatCustomerReceiverName
} from "../../../utils/customerAddress.js";

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  canDelete = true,
  fallbackReceiverName = ""
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const addressLabel = formatCustomerAddressLabel(address.label);
  const receiverName = formatCustomerReceiverName(address.receiverName, fallbackReceiverName);

  return (
    <CustomerCard tone="soft" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-brown">{addressLabel}</h3>
            {address.isDefault && <span className="rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black uppercase text-white">Giao đến</span>}
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-brown/60">{receiverName} · {address.phone}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-brown/60">{address.address}</p>
          {address.note && <p className="mt-1 text-xs text-brown/45">{address.note}</p>}
        </div>
        <Icon name="home" size={18} className="mt-1 shrink-0 text-orange-600" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!address.isDefault && <CustomerButton variant="soft" size="sm" onClick={onSetDefault}>Giao đến</CustomerButton>}
        <CustomerButton variant="secondary" size="sm" onClick={onEdit}>Sửa</CustomerButton>
        {canDelete ? (
          <CustomerButton
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            Xóa
          </CustomerButton>
        ) : null}
      </div>
      {canDelete && confirmingDelete ? (
        <div className="account-address-confirm" role="alertdialog" aria-label="Xác nhận xóa địa chỉ">
          <p>Xóa địa chỉ “{addressLabel}”?</p>
          <div>
            <CustomerButton variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
              Giữ lại
            </CustomerButton>
            <CustomerButton variant="danger" size="sm" onClick={onDelete}>
              Xóa địa chỉ
            </CustomerButton>
          </div>
        </div>
      ) : null}
    </CustomerCard>
  );
}
