import Icon from "../../../components/Icon.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault
}) {
  return (
    <CustomerCard tone="soft" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-brown">{address.label}</h3>
            {address.isDefault && <span className="rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black uppercase text-white">Giao đến</span>}
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-brown/60">{address.receiverName} · {address.phone}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-brown/60">{address.address}</p>
          {address.note && <p className="mt-1 text-xs text-brown/45">{address.note}</p>}
        </div>
        <Icon name="home" size={18} className="mt-1 shrink-0 text-orange-600" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!address.isDefault && <CustomerButton variant="soft" size="sm" onClick={onSetDefault}>Giao đến</CustomerButton>}
        <CustomerButton variant="secondary" size="sm" onClick={onEdit}>Sửa</CustomerButton>
        <CustomerButton variant="danger" size="sm" onClick={onDelete}>Xóa</CustomerButton>
      </div>
    </CustomerCard>
  );
}
