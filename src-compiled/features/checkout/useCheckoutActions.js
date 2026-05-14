import { buildCreateOrderPayload, validateCheckoutContact } from "../../services/checkoutOrderService.js";

export default function useCheckoutActions({
  setCart,
  createOrderFromCheckout,
  checkoutTotal,
  subtotal,
  checkoutShip,
  baseCheckoutShip,
  autoShipSupport,
  promoDiscount,
  selectedPromo,
  pointsDiscount,
  deliveryDistanceKm,
  deliveryInfo,
  fulfillmentType,
  selectedBranchInfo,
  deliverySourceBranch,
  pickupTimeText,
  navigate,
  onNotice
}) {
  const updateQty = (cartId, delta) => setCart((items) => items.map((item) => {
    if (item.cartId !== cartId) return item;
    if (item.autoGiftByPromo) return item;
    const quantity = Math.max(1, item.quantity + delta);
    return {
      ...item,
      quantity,
      lineTotal: item.unitTotal * quantity
    };
  }));

  const handlePlaceOrder = async () => {
    const validation = validateCheckoutContact({
      deliveryInfo,
      fulfillmentType
    });

    if (!validation.ok) {
      if (typeof onNotice === "function") {
        onNotice({
          title: "Thiếu thông tin giao hàng",
          message: validation.message,
          icon: "warning"
        });
      } else {
        alert(validation.message);
      }
      return;
    }

    const orderPayload = buildCreateOrderPayload({
      checkoutTotal,
      subtotal,
      checkoutShip,
      baseCheckoutShip,
      autoShipSupport,
      promoDiscount,
      selectedPromo,
      pointsDiscount,
      deliveryDistanceKm,
      deliveryInfo,
      fulfillmentType,
      selectedBranchInfo,
      deliverySourceBranch,
      pickupTimeText
    });

    let order = null;
    try {
      order = await createOrderFromCheckout(orderPayload);
    } catch (error) {
      console.error("[checkout] createOrderFromCheckout failed", {
        message: error?.message || String(error || ""),
        code: error?.code || "",
        details: error?.details || "",
        hint: error?.hint || ""
      });
      if (typeof onNotice === "function") {
        onNotice({
          title: "Không thể tạo đơn hàng",
          message: "Không thể ghi đơn lên hệ thống. Vui lòng thử lại sau.",
          icon: "warning"
        });
      } else {
        alert("Không thể tạo đơn hàng. Vui lòng thử lại sau.");
      }
      return;
    }
    if (!order) {
      if (typeof onNotice === "function") {
        onNotice({
          title: "Giỏ hàng trống",
          message: "Vui lòng thêm món trước khi đặt hàng.",
          icon: "warning"
        });
      } else {
        alert("Giỏ hàng đang trống.");
      }
      return;
    }

    navigate("success", "orders");
  };

  return {
    updateQty,
    handlePlaceOrder
  };
}
