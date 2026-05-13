export default function Cart({ cart, setCart, updateQty, onEditItem, isEditableItem, CheckoutCard, addonCategory, formatMoney, Icon }) {
  const getToppingRows = (item) => {
    const rows = {};
    (item.toppings || []).forEach((topping) => {
      const key = topping.id || topping.name;
      rows[key] = rows[key] || { name: topping.name, quantity: 0 };
      rows[key].quantity += Number(topping.quantity || 1);
    });
    return Object.values(rows);
  };

  return (
    <CheckoutCard title="Món đã chọn" action={cart.length ? "Xóa tất cả" : ""} onAction={() => setCart([])}>
      <div className="space-y-3">
        {cart.map((item) => (
          <div
            key={item.cartId}
            onClick={() => {
              if (isEditableItem?.(item)) onEditItem?.(item);
            }}
            className={`checkout-cart-item ${item.category === addonCategory ? "checkout-cart-addon" : ""}`}
            style={{ cursor: isEditableItem?.(item) ? "pointer" : "default" }}
          >
            {item.category !== addonCategory && <img src={item.image} alt={item.name} />}
            <div className="min-w-0 flex-1">
              <h3>{item.name}</h3>
              <span className="checkout-spice-pill">{item.autoGiftByPromo ? "Quà tặng" : item.spice}</span>
              {getToppingRows(item).length > 0 && (
                <div className="checkout-topping-list">
                  {getToppingRows(item).map((topping) => (
                    <span key={topping.name}><em>{topping.name}</em><strong>x{topping.quantity}</strong></span>
                  ))}
                </div>
              )}
              {item.note && <div className="checkout-note-pill">Ghi chú: {item.note}</div>}
              <div className="mt-2 flex items-center justify-between gap-2">
                {item.autoGiftByPromo ? (
                  <div className="text-xs text-brown/60">Tự động thêm khi đủ mốc</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={(event) => { event.stopPropagation(); updateQty(item.cartId, -1); }} className="qty-btn">-</button>
                    <span className="w-5 text-center text-sm font-black">{item.quantity}</span>
                    <button onClick={(event) => { event.stopPropagation(); updateQty(item.cartId, 1); }} className="qty-btn text-orange-600">+</button>
                  </div>
                )}
                <div className="text-right">
                  {item.autoGiftByPromo && Number(item.originalLineTotal || 0) > 0 ? (
                    <div className="text-[11px] text-brown/40 line-through">{formatMoney(item.originalLineTotal)}</div>
                  ) : null}
                  <strong>{formatMoney(item.lineTotal)}</strong>
                </div>
              </div>
            </div>
            {item.autoGiftByPromo ? null : (
              <button onClick={(event) => { event.stopPropagation(); setCart((items) => items.filter((cartItem) => cartItem.cartId !== item.cartId)); }} className="checkout-remove" aria-label={`Xóa ${item.name}`}>
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </CheckoutCard>
  );
}
