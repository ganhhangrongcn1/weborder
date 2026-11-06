import CustomerBottomSheet from "./CustomerBottomSheet.jsx";
import { CustomerButton } from "./CustomerUI.jsx";
import Icon from "../Icon.jsx";
export default function BranchCartChangeSheet({ guard }) {
  if (!guard.pending) return null;
  const { branch, items } = guard.pending;
  return <CustomerBottomSheet title="Đổi chi nhánh?" onClose={guard.cancel} className="branch-cart-change-sheet"
    footer={<div className="branch-cart-change-actions"><CustomerButton variant="secondary" onClick={guard.cancel}>Giữ chi nhánh hiện tại</CustomerButton><CustomerButton disabled={guard.pending.waiting} onClick={guard.confirm}>Bỏ món và đổi chi nhánh</CustomerButton></div>}>
    {guard.pending.waiting ? <p role="status">Đang kiểm tra thực đơn chi nhánh…</p> : <p className="branch-cart-change-note"><Icon name="warning" size={21} /><span><strong>{branch.name}</strong> không bán các món bên dưới. Các món khác trong giỏ sẽ được giữ lại.</span></p>}
    <ul className="branch-cart-change-list">{items.map((item,index)=><li key={item.cartId || `${item.id}-${index}`}><span>{item.name}</span><small>Số lượng: {item.quantity || 1}</small></li>)}</ul>
  </CustomerBottomSheet>;
}
