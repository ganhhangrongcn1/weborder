import { useState } from "react";
import Icon from "../../components/Icon.js";
import AppHeader from "../../components/app/Header.js";
import AppEmptyState from "../../components/app/EmptyState.js";
import OrderStatusSheet from "../../pages/customer/tracking/OrderStatusSheet.js";
import { formatMoney } from "../../utils/format.js";
import { formatTime } from "../../utils/pureHelpers.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Tracking({
  navigate,
  userProfile,
  currentOrder,
  currentPhone,
  isOrdersLoading = false,
  hasFetchedOrdersOnce = false,
  isSessionRestoring = false,
  onReorder,
  getStoreBlockNotice,
  setServiceNotice
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const historyOrders = Array.isArray(userProfile?.orderHistory) ? userProfile.orderHistory : [];
  const fallbackOrder = currentPhone && currentOrder ? [currentOrder] : [];
  const mergedOrders = [...historyOrders, ...fallbackOrder].filter(Boolean).reduce((acc, item) => {
    const key = String(item?.id || item?.orderCode || "").trim();
    if (!key) return acc;
    if (!acc.some(order => String(order?.id || order?.orderCode || "").trim() === key)) {
      acc.push(item);
    }
    return acc;
  }, []);
  const orders = [...mergedOrders].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  const canViewFullOrderCode = Boolean(currentPhone);
  const maskOrderCode = code => String(code || "GHR-****").replace(/GHR-\d{4}/i, "GHR-****");
  const shouldShowLoading = isOrdersLoading && orders.length === 0;
  const shouldShowEmpty = !shouldShowLoading && orders.length === 0;
  const getOrderStatus = order => {
    const status = String(order?.status || "").toLowerCase();
    if (status === "pending_zalo" || status === "new") return "Chờ xác nhận";
    if (status === "delivering" || status === "đang giao") return "Đang giao";
    if (status === "completed" || status === "done" || status === "hoàn tất") return "Hoàn tất";
    return "Đang thực hiện";
  };
  const getOrderStep = order => {
    const status = String(order?.status || "").toLowerCase();
    const isDeliveryOrder = String(order?.fulfillmentType || "").toLowerCase() !== "pickup";
    if (status === "completed" || status === "done" || status === "hoàn tất") return isDeliveryOrder ? 3 : 2;
    if (isDeliveryOrder && (status === "delivering" || status === "đang giao")) return 2;
    if (["confirmed", "preparing", "cooking", "đang làm"].includes(status)) return 1;
    return 0;
  };
  const formatOrderTime = value => value ? formatTime(value) : "--";
  return /*#__PURE__*/_jsxs("section", {
    children: [/*#__PURE__*/_jsx(AppHeader, {
      title: "\u0110\u01A1n h\xE0ng",
      onBack: () => navigate("home", "home")
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pb-6",
      children: [shouldShowLoading && /*#__PURE__*/_jsx(AppEmptyState, {
        icon: "bag",
        title: "\u0110ang t\u1EA3i \u0111\u01A1n h\xE0ng",
        message: "\u0110ang \u0111\u1ED3ng b\u1ED9 l\u1ECBch s\u1EED \u0111\u01A1n t\u1EEB h\u1EC7 th\u1ED1ng...",
        className: "rounded-[28px] bg-white p-6 shadow-soft",
        center: true
      }), shouldShowEmpty && /*#__PURE__*/_jsx(AppEmptyState, {
        icon: "bag",
        title: "Ch\u01B0a c\xF3 \u0111\u01A1n h\xE0ng",
        message: currentPhone ? "Các đơn đã đặt sẽ hiển thị ở đây để bạn dễ mua lại và theo dõi." : "Nếu bạn vừa mua bằng số đã đăng ký, hãy đăng nhập để xem lịch sử đơn đầy đủ.",
        actionText: currentPhone ? "Đặt món ngay" : "Đăng nhập để xem đơn",
        onAction: () => currentPhone ? navigate("menu", "menu") : navigate("account", "account"),
        className: "rounded-[28px] bg-white p-6 shadow-soft",
        center: true
      }), !shouldShowLoading && orders.map(order => {
        const status = getOrderStatus(order);
        const isDone = status === "Hoàn tất";
        const isDelivering = status === "Đang giao";
        const items = Array.isArray(order?.items) ? order.items : [];
        return /*#__PURE__*/_jsxs("article", {
          onClick: () => setSelectedOrder(order),
          className: "cursor-pointer rounded-[28px] bg-white p-4 shadow-soft transition active:scale-[0.99]",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "flex items-start justify-between gap-3",
            children: [/*#__PURE__*/_jsxs("div", {
              children: [/*#__PURE__*/_jsx("p", {
                className: "text-xs text-brown/50",
                children: formatOrderTime(order.createdAt)
              }), /*#__PURE__*/_jsx("h2", {
                className: "mt-1 text-lg font-black text-brown",
                children: canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode)
              }), /*#__PURE__*/_jsxs("p", {
                className: "mt-1 text-sm text-brown/60",
                children: [items.length, " m\xF3n \xB7 ", formatMoney(order.totalAmount || 0)]
              })]
            }), /*#__PURE__*/_jsx("span", {
              className: `shrink-0 rounded-full px-3 py-1 text-xs font-black ${isDone ? "bg-green-50 text-green-700" : isDelivering ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`,
              children: status
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "mt-4 space-y-2 rounded-[22px] bg-cream/70 p-3",
            children: [items.slice(0, 3).map(item => /*#__PURE__*/_jsxs("div", {
              className: "flex items-start justify-between gap-3 text-sm",
              children: [/*#__PURE__*/_jsxs("div", {
                children: [/*#__PURE__*/_jsx("p", {
                  className: "font-bold text-brown",
                  children: item.name
                }), /*#__PURE__*/_jsxs("p", {
                  className: "text-xs text-brown/50",
                  children: ["x", item.quantity || 1]
                })]
              }), /*#__PURE__*/_jsx("span", {
                className: "font-black text-orange-600",
                children: formatMoney(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1))
              })]
            }, item.cartId || `${order.orderCode}-${item.id}-${item.name}`)), items.length > 3 && /*#__PURE__*/_jsxs("p", {
              className: "text-xs font-bold text-brown/50",
              children: ["+", items.length - 3, " m\xF3n kh\xE1c"]
            })]
          }), /*#__PURE__*/_jsxs("button", {
            onClick: event => {
              event.stopPropagation();
              const notice = getStoreBlockNotice?.();
              if (notice) {
                setServiceNotice?.(notice);
                return;
              }
              onReorder(order);
            },
            className: "mt-3 flex w-full items-center justify-center gap-2 rounded-[20px] border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-orange-600 shadow-sm",
            children: [/*#__PURE__*/_jsx(Icon, {
              name: "cart",
              size: 17
            }), "Mua l\u1EA1i \u0111\u01A1n n\xE0y"]
          })]
        }, order.orderCode || order.id);
      })]
    }), selectedOrder && /*#__PURE__*/_jsx(OrderStatusSheet, {
      order: selectedOrder,
      step: getOrderStep(selectedOrder),
      formatOrderTime: formatOrderTime,
      canViewFullOrderCode: canViewFullOrderCode,
      maskOrderCode: maskOrderCode,
      onClose: () => setSelectedOrder(null)
    })]
  });
}