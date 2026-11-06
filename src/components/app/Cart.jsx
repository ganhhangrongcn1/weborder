import CustomerControl from "../customer/CustomerControl.jsx";
import { useEffect, useRef, useState } from "react";
import { isToppingAlreadyShownInSpice } from "../../utils/orderItemDisplay.js";

function CartToppingDetails({ rows, compact }) {
  const content = <div className="checkout-topping-list">{rows.map((topping) => <span key={topping.name}><em>{topping.name}</em><strong>x{topping.quantity}</strong></span>)}</div>;
  return compact ? <details className="checkout-cart-options"><summary>{rows.length} lựa chọn · Xem chi tiết</summary>{content}</details> : content;
}

export default function Cart({ cart, setCart, updateQty, onEditItem, isEditableItem, CheckoutCard, addonCategory, formatMoney, Icon, compact = false }) {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [removedItem, setRemovedItem] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }, []);

  const isSpiceOption = (item, topping) => {
    return isToppingAlreadyShownInSpice(item, topping);
  };

  const getToppingRows = (item) => {
    const rows = {};
    (item.toppings || []).forEach((topping) => {
      if (isSpiceOption(item, topping)) return;
      const key = topping.id || topping.name;
      rows[key] = rows[key] || { name: topping.name, quantity: 0 };
      rows[key].quantity += Number(topping.quantity || 1);
    });
    return Object.values(rows);
  };

  const clearUndoState = () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setRemovedItem(null);
  };

  const handleRemoveItem = (item) => {
    if (cart.length <= 1) {
      setIsConfirmingClear(true);
      return;
    }

    const itemIndex = cart.findIndex((cartItem) => cartItem.cartId === item.cartId);
    if (itemIndex < 0) return;

    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setRemovedItem({ item, itemIndex });
    setCart((items) => items.filter((cartItem) => cartItem.cartId !== item.cartId));
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      setRemovedItem(null);
    }, 4000);
  };

  const handleUndoRemove = () => {
    if (!removedItem) return;
    setCart((items) => {
      if (items.some((item) => item.cartId === removedItem.item.cartId)) return items;
      const next = [...items];
      next.splice(Math.min(removedItem.itemIndex, next.length), 0, removedItem.item);
      return next;
    });
    clearUndoState();
  };

  return (
    <CheckoutCard
      title="Món đã chọn"
      className={compact ? "checkout-cart--compact" : ""}
      action={cart.length ? "Xóa tất cả" : ""}
      onAction={() => setIsConfirmingClear(true)}
    >
      {isConfirmingClear ? (
        <div className="checkout-clear-confirm" role="alert">
          <span>
            <strong>Xóa toàn bộ món?</strong>
            <small>Thao tác này sẽ làm trống giỏ hàng.</small>
          </span>
          <div>
            <CustomerControl type="button" onClick={() => setIsConfirmingClear(false)}>Giữ lại</CustomerControl>
            <CustomerControl
              type="button"
              className="is-danger"
              onClick={() => {
                clearUndoState();
                setCart([]);
                setIsConfirmingClear(false);
              }}
            >
              Xóa giỏ
            </CustomerControl>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {cart.map((item) => {
          const originalLineTotal = Number(item.originalLineTotal || 0);
          const lineTotal = Number(item.lineTotal || 0);
          const hasDiscountPrice = originalLineTotal > lineTotal;
          const toppingRows = getToppingRows(item);

          return (
            <article
              key={item.cartId}
              className={`checkout-cart-item ${item.category === addonCategory ? "checkout-cart-addon" : ""}`}
            >
              {item.category !== addonCategory ? (
                item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    width="70"
                    height="70"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="grid h-[70px] w-[70px] place-items-center rounded-[18px] bg-cream text-brown/40 text-xs font-bold">
                    Chưa có ảnh
                  </div>
                )
              ) : null}
              <div className="min-w-0 flex-1">
                <h3>{item.name}</h3>
                {(item.autoGiftByPromo || item.stampGift || item.spice) && <span className="checkout-spice-pill">{(item.autoGiftByPromo || item.stampGift) ? "Quà tặng" : item.spice}</span>}
                {toppingRows.length > 0 && (
                  <CartToppingDetails rows={toppingRows} compact={compact} />
                )}
                {item.note && <div className="checkout-note-pill">Ghi chú: {item.note}</div>}
                {!item.stampGift && isEditableItem?.(item) ? (
                  <CustomerControl
                    type="button"
                    className="checkout-edit-item"
                    onClick={() => onEditItem?.(item)}
                  >
                    Chỉnh món
                  </CustomerControl>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {(item.autoGiftByPromo || item.stampGift) ? (
                    <div className="text-xs text-brown/60">{item.stampGift ? "Quà đổi 10 tem" : "Tự động thêm khi đủ mốc"}</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CustomerControl
                        type="button"
                        onClick={() => updateQty(item.cartId, -1)}
                        className="qty-btn"
                        aria-label={`Giảm số lượng ${item.name}`}
                      >
                        −
                      </CustomerControl>
                      <span className="w-5 text-center text-sm font-black">{item.quantity}</span>
                      <CustomerControl
                        type="button"
                        onClick={() => updateQty(item.cartId, 1)}
                        className="qty-btn text-orange-600"
                        aria-label={`Tăng số lượng ${item.name}`}
                      >
                        +
                      </CustomerControl>
                    </div>
                  )}
                  <div className="text-right">
                    <strong>{formatMoney(lineTotal)}</strong>
                    {hasDiscountPrice ? (
                      <div className="text-[11px] font-semibold text-brown/40 line-through">{formatMoney(originalLineTotal)}</div>
                    ) : null}
                  </div>
                </div>
              </div>
              {item.autoGiftByPromo ? null : (
                <CustomerControl
                  type="button"
                  onClick={() => handleRemoveItem(item)}
                  className="checkout-remove"
                  aria-label={`Xóa ${item.name}`}
                >
                  <Icon name="trash" size={15} />
                </CustomerControl>
              )}
            </article>
          );
        })}
      </div>

      {removedItem ? (
        <div className="checkout-undo" role="status" aria-live="polite">
          <span>
            <strong>Đã xóa món</strong>
            <small>{removedItem.item.name}</small>
          </span>
          <CustomerControl type="button" onClick={handleUndoRemove}>Hoàn tác</CustomerControl>
        </div>
      ) : null}
    </CheckoutCard>
  );
}
