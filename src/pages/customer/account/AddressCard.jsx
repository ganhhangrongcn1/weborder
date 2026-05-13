import Icon from "../../../components/Icon.jsx";

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault
}) {
  return (
    <div className="rounded-[22px] border border-orange-100 bg-cream/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-brown">{address.label}</h3>
            {address.isDefault && <span className="rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black uppercase text-white">GIAO ĐẾN</span>}
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-brown/60">{address.receiverName} · {address.phone}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-brown/60">{address.address}</p>
          {address.note && <p className="mt-1 text-xs text-brown/45">{address.note}</p>}
        </div>
        <Icon name="home" size={18} className="mt-1 shrink-0 text-orange-600" />
      </div>
      <div className="mt-3 flex gap-2">
        {!address.isDefault && <button onClick={onSetDefault} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-xs font-black text-orange-600">Giao đến</button>}
        <button onClick={onEdit} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-xs font-black text-brown/70">Sửa</button>
        <button onClick={onDelete} className="rounded-2xl border border-red-100 bg-white px-4 py-2 text-xs font-black text-red-500">Xóa</button>
      </div>
    </div>
  );
}
