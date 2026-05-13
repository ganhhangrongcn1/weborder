import { useState } from "react";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppEmptyState from "../../components/app/EmptyState.jsx";
import OrderStatusSheet from "../../pages/customer/tracking/OrderStatusSheet.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatTime } from "../../utils/pureHelpers.js";

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

  const mergedOrders = [...historyOrders, ...fallbackOrder]
    .filter(Boolean)
    .reduce((acc, item) => {
      const key = String(item?.id || item?.orderCode || "").trim();
      if (!key) return acc;
      if (!acc.some((order) => String(order?.id || order?.orderCode || "").trim() === key)) {
        acc.push(item);
      }
      return acc;
    }, []);

  const orders = [...mergedOrders].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  const canViewFullOrderCode = Boolean(currentPhone);
  const maskOrderCode = (code) => String(code || "GHR-****").replace(/GHR-\d{4}/i, "GHR-****");

  const shouldShowLoading = isOrdersLoading && orders.length === 0;
  const shouldShowEmpty = !shouldShowLoading && orders.length === 0;

  const getOrderStatus = (order) => {
    const status = String(order?.status || "").toLowerCase();
    if (status === "pending_zalo" || status === "new") return "Chờ xác nhận";
    if (status === "delivering" || status === "đang giao") return "Đang giao";
    if (status === "completed" || status === "done" || status === "hoàn tất") return "Hoàn tất";
    return "Đang thực hiện";
  };

  const getOrderStep = (order) => {
    const status = String(order?.status || "").toLowerCase();
    const isDeliveryOrder = String(order?.fulfillmentType || "").toLowerCase() !== "pickup";
    if (status === "completed" || status === "done" || status === "hoàn tất") return isDeliveryOrder ? 3 : 2;
    if (isDeliveryOrder && (status === "delivering" || status === "đang giao")) return 2;
    if (["confirmed", "preparing", "cooking", "đang làm"].includes(status)) return 1;
    return 0;
  };

  const formatOrderTime = (value) => (value ? formatTime(value) : "--");

  return (
    <section>
      <AppHeader title="Đơn hàng" onBack={() => navigate("home", "home")} />

      <div className="space-y-4 px-4 pb-6">
        {shouldShowLoading && (
          <AppEmptyState
            icon="bag"
            title="Đang tải đơn hàng"
            message="Đang đồng bộ lịch sử đơn từ hệ thống..."
            className="rounded-[28px] bg-white p-6 shadow-soft"
            center
          />
        )}

        {shouldShowEmpty && (
          <AppEmptyState
            icon="bag"
            title="Chưa có đơn hàng"
            message={
              currentPhone
                ? "Các đơn đã đặt sẽ hiển thị ở đây để bạn dễ mua lại và theo dõi."
                : "Nếu bạn vừa mua bằng số đã đăng ký, hãy đăng nhập để xem lịch sử đơn đầy đủ."
            }
            actionText={currentPhone ? "Đặt món ngay" : "Đăng nhập để xem đơn"}
            onAction={() => (currentPhone ? navigate("menu", "menu") : navigate("account", "account"))}
            className="rounded-[28px] bg-white p-6 shadow-soft"
            center
          />
        )}

        {!shouldShowLoading &&
          orders.map((order) => {
            const status = getOrderStatus(order);
            const isDone = status === "Hoàn tất";
            const isDelivering = status === "Đang giao";
            const items = Array.isArray(order?.items) ? order.items : [];

            return (
              <article
                key={order.orderCode || order.id}
                onClick={() => setSelectedOrder(order)}
                className="cursor-pointer rounded-[28px] bg-white p-4 shadow-soft transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-brown/50">{formatOrderTime(order.createdAt)}</p>
                    <h2 className="mt-1 text-lg font-black text-brown">
                      {canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode)}
                    </h2>
                    <p className="mt-1 text-sm text-brown/60">
                      {items.length} món · {formatMoney(order.totalAmount || 0)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                      isDone
                        ? "bg-green-50 text-green-700"
                        : isDelivering
                          ? "bg-blue-50 text-blue-600"
                          : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 rounded-[22px] bg-cream/70 p-3">
                  {items.slice(0, 3).map((item) => (
                    <div
                      key={item.cartId || `${order.orderCode}-${item.id}-${item.name}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-bold text-brown">{item.name}</p>
                        <p className="text-xs text-brown/50">x{item.quantity || 1}</p>
                      </div>

                      <span className="font-black text-orange-600">
                        {formatMoney(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1))}
                      </span>
                    </div>
                  ))}

                  {items.length > 3 && <p className="text-xs font-bold text-brown/50">+{items.length - 3} món khác</p>}
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    const notice = getStoreBlockNotice?.();
                    if (notice) {
                      setServiceNotice?.(notice);
                      return;
                    }
                    onReorder(order);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[20px] border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-orange-600 shadow-sm"
                >
                  <Icon name="cart" size={17} />
                  Mua lại đơn này
                </button>
              </article>
            );
          })}
      </div>

      {selectedOrder && (
        <OrderStatusSheet
          order={selectedOrder}
          step={getOrderStep(selectedOrder)}
          formatOrderTime={formatOrderTime}
          canViewFullOrderCode={canViewFullOrderCode}
          maskOrderCode={maskOrderCode}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </section>
  );
}
