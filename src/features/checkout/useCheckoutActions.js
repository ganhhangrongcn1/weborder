import { buildCreateOrderPayload, validateCheckoutContact } from "../../services/checkoutOrderService.js";

import { getCheckoutVoucherErrorMessage } from "../../services/checkoutOrderService.js";

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
  pointsSpent,
  pointsDiscount,
  deliveryDistanceKm,
  deliveryInfo,
  fulfillmentType,
  selectedBranchInfo,
  deliverySourceBranch,
  pickupTimeText,
  orderSource = "online",
  paymentMethod = "COD",
  navigate,
  onNotice,
  onVoucherRejected,
  repriceCartNow
}) {
  const updateQty = (cartId, delta) => setCart((items) => items.map((item) => {
    if (item.cartId !== cartId) return item;
    if (item.autoGiftByPromo) return item;
    const quantity = Math.max(1, item.quantity + delta);
    return {
      ...item,
      quantity,
      lineTotal: item.unitTotal * quantity,
      originalLineTotal: Number(item.originalUnitTotal || 0) > Number(item.unitTotal || 0)
        ? Number(item.originalUnitTotal || 0) * quantity
        : item.originalLineTotal
    };
  }));

  const handlePlaceOrder = async () => {
    const priceRefresh = typeof repriceCartNow === "function"
      ? repriceCartNow()
      : { changed: false };
    if (priceRefresh.changed) {
      if (typeof onNotice === "function") {
        onNotice({
          title: "Giá món đã được cập nhật",
          message: "Giỏ hàng vừa được đồng bộ theo giá hiện tại. Anh/chị kiểm tra lại tổng tiền rồi bấm đặt món lần nữa.",
          icon: "warning"
        });
      } else {
        alert("Giỏ hàng vừa được cập nhật theo giá hiện tại. Vui lòng kiểm tra lại tổng tiền rồi đặt món lần nữa.");
      }
      return;
    }

    console.info("[checkout-debug] handlePlaceOrder:start", {
      hasDeliveryName: Boolean(deliveryInfo?.name),
      hasDeliveryPhone: Boolean(deliveryInfo?.phone),
      hasDeliveryAddress: Boolean(deliveryInfo?.address),
      fulfillmentType
    });
    const validation = validateCheckoutContact({
      deliveryInfo,
      fulfillmentType
    });
    console.info("[checkout-debug] handlePlaceOrder:validation", validation);

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
      pointsSpent,
      pointsDiscount,
      deliveryDistanceKm,
      deliveryInfo,
      fulfillmentType,
      selectedBranchInfo,
      deliverySourceBranch,
      pickupTimeText,
      orderSource,
      paymentMethod
    });
    console.info("[checkout-debug] handlePlaceOrder:payload", {
      totalAmount: orderPayload.totalAmount,
      pointsBaseAmount: orderPayload.pointsBaseAmount,
      phone: orderPayload?.deliveryInfo?.phone || "",
      fulfillmentType: orderPayload.fulfillmentType
    });

    let order = null;
    try {
      order = await createOrderFromCheckout(orderPayload);
      console.info("[checkout-debug] handlePlaceOrder:createOrderFromCheckout:ok", {
        orderCode: order?.orderCode || order?.id || ""
      });
    } catch (error) {
      console.error("[checkout] createOrderFromCheckout failed", {
        message: error?.message || String(error || ""),
        code: error?.code || "",
        details: error?.details || "",
        hint: error?.hint || ""
      });
      const voucherMessage = getCheckoutVoucherErrorMessage(error);
      if (voucherMessage) {
        if (typeof onVoucherRejected === "function") onVoucherRejected();
        if (typeof onNotice === "function") {
          onNotice({
            title: "Voucher không còn áp dụng được",
            message: voucherMessage,
            icon: "warning"
          });
        } else {
          alert(voucherMessage);
        }
        return;
      }
      const isOrderTimeout = [
        "CHECKOUT_ORDER_TIMEOUT",
        "ORDER_REMOTE_WRITE_TIMEOUT",
        "ORDER_REMOTE_VERIFY_TIMEOUT"
      ].includes(String(error?.code || ""));
      if (typeof onNotice === "function") {
        onNotice({
          title: isOrderTimeout ? "Kết nối chưa ổn định" : "Không thể tạo đơn hàng",
          message: isOrderTimeout
            ? "Hệ thống chưa xác nhận được đơn. Vui lòng kiểm tra mạng và bấm đặt món lại; đơn sẽ dùng lại cùng mã để không bị trùng."
            : "Không thể ghi đơn lên hệ thống. Vui lòng thử lại sau.",
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
