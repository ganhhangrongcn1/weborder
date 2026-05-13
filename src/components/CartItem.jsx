import { formatMoney } from "../utils/format.js";

export default function CartItem({ item, onInc, onDec, onRemove }) {
  const toppings = item.toppings.map((topping) => topping.name).join(", ");
  return (
    <div className="flex gap-3 rounded-[24px] bg-white p-3 shadow-soft">
      <img src={item.image} alt={item.name} className="h-20 w-20 rounded-[20px] object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="line-clamp-2 text-sm font-black text-brown">{item.name}</h3>
            <p className="mt-1 text-xs font-semibold text-brown/55">{item.spice}</p>
            {toppings && <p className="mt-1 line-clamp-1 text-xs text-brown/45">+ {toppings}</p>}
            {item.note && <p className="mt-1 line-clamp-1 text-xs text-brown/45">Ghi chú: {item.note}</p>}
          </div>
          <button onClick={() => onRemove(item.cartId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brown/50">X</button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => onDec(item.cartId)} className="qty-btn">-</button>
            <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
            <button onClick={() => onInc(item.cartId)} className="qty-btn text-orange-600">+</button>
          </div>
          <strong className="text-sm font-black text-brown">{formatMoney(item.lineTotal)}</strong>
        </div>
      </div>
    </div>
  );
}
