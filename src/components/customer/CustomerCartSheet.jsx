import CustomerControl from "./CustomerControl.jsx";
import { createPortal } from "react-dom";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";
import Cart from "../app/Cart.jsx";
import Icon from "../Icon.jsx";
import { formatMoney } from "../../utils/format.js";
import { optionModalText } from "../../data/uiText.js";

function CartSection({ action, onAction, children }) {
  return <section className="customer-cart-sheet__items"><div className="customer-cart-sheet__actions">{action && <CustomerControl type="button" onClick={onAction}>{action}</CustomerControl>}</div>{children}</section>;
}

export default function CustomerCartSheet({ cart = [], setCart, subtotal, onClose, onContinue, onEdit, onQuantityChange }) {
  return createPortal(
    <CustomerBottomSheet title="Giỏ hàng" onClose={onClose} className="customer-cart-sheet" showHandle={false} footer={cart.length ? (
      <div className="customer-cart-sheet__footer"><div><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong><small>Phí giao hàng và ưu đãi được tính khi thanh toán.</small></div><CustomerControl type="button" className="customer-primary-action" onClick={onContinue}>Tiếp tục thanh toán</CustomerControl></div>
    ) : null}>
      {cart.length ? <Cart cart={cart} setCart={setCart} updateQty={onQuantityChange} onEditItem={onEdit} isEditableItem={(item) => !String(item.id || "").startsWith("addon-") && !item.autoGiftByPromo} CheckoutCard={CartSection} addonCategory={optionModalText.addonCategory} formatMoney={formatMoney} Icon={Icon} /> : <div className="customer-cart-sheet__empty"><Icon name="cart" size={42} /><h3>Giỏ hàng đang trống</h3><p>Chọn vài món ngon rồi quay lại nhé.</p><CustomerControl type="button" className="customer-primary-action" onClick={onClose}>Tiếp tục chọn món</CustomerControl></div>}
    </CustomerBottomSheet>, document.body
  );
}
