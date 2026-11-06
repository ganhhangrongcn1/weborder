import { useState } from "react";
import { updateCartItemQuantity } from "../services/cartQuantityService.js";

export default function useCustomerCartSheet({ setCart, openCartItemEditor, onCheckout }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  return {
    isCartOpen,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    updateQuantity: (cartId, delta) => setCart((items) => updateCartItemQuantity(items, cartId, delta)),
    editItem: (item) => {
      setIsCartOpen(false);
      openCartItemEditor(item);
    },
    continueCheckout: () => {
      setIsCartOpen(false);
      onCheckout();
    }
  };
}
