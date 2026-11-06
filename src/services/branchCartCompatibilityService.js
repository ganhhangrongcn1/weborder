import { isProductAvailableForContext } from "./productAvailabilityService.js";
import { findOrderCatalogProduct } from "./reorderService.js";
export function getUnavailableBranchCartItems(cart = [], catalog = [], branch, channel = "web") {
  return cart.filter(item => {
    const product = findOrderCatalogProduct(item,catalog);
    if (!product && (item.autoGiftByPromo || item.stampGift)) return false;
    return !product || !isProductAvailableForContext(product, { branch, channel });
  });
}
export function branchCartItemKey(item) { return String(item.cartId || item.id); }
export default getUnavailableBranchCartItems;
