import { useEffect, useState } from "react";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppEmptyState from "../../components/app/EmptyState.jsx";
import { CustomerButton, CustomerCard } from "../../components/customer/CustomerUI.jsx";
import OrderStatusSheet from "../../pages/customer/tracking/OrderStatusSheet.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatTime } from "../../utils/pureHelpers.js";
import {
  claimPartnerOrderPoints,
  getCanonicalOrderBranchName,
  getPartnerOrdersByPhone,
  getOrderSourceBadge,
  mergeCustomerLookupOrders
} from "../../services/partnerOrderService.js";
import { calculateOrderPoints, getLoyaltyRuleConfig } from "../../services/loyaltyService.js";

const STATUS_TONE = {
  done: "bg-green-50 text-green-700",
  delivering: "bg-blue-50 text-blue-600",
  active: "bg-orange-50 text-orange-600"
};

export default function Tracking({
  navigate,
  userProfile,
  currentOrder,
  currentPhone,
  isOrdersLoading = false,
  hasFetchedOrdersOnce = false,
  isSessionRestoring = false,
  branches = [],
  demoLoyalty,
  setDemoLoyalty,
  onReorder,
  getStoreBlockNotice,
  setServiceNotice
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [isPartnerOrdersLoading, setIsPartnerOrdersLoading] = useState(false);
  const [claimingOrderId, setClaimingOrderId] = useState("");

  const historyOrders = Array.isArray(userProfile?.orderHistory) ? userProfile.orderHistory : [];
  const fallbackOrder = currentPhone && currentOrder ? [currentOrder] : [];

  useEffect(() => {
    let disposed = false;
    async function loadPartnerOrders() {
      if (!currentPhone) {
        setPartnerOrders([]);
        return;
      }
      setIsPartnerOrdersLoading(true);
      try {
        const nextOrders = await getPartnerOrdersByPhone(currentPhone);
        if (!disposed) setPartnerOrders(nextOrders);
      } finally {
        if (!disposed) setIsPartnerOrdersLoading(false);
      }
    }

    loadPartnerOrders();
    return () => {
      disposed = true;
    };
  }, [currentPhone]);

  const mergedOrders = mergeCustomerLookupOrders(
    [...historyOrders, ...fallbackOrder]
    .filter(Boolean)
    .reduce((acc, item) => {
      const key = String(item?.id || item?.orderCode || "").trim();
      if (!key) return acc;
      if (!acc.some((order) => String(order?.id || order?.orderCode || "").trim() === key)) {
        acc.push(item);
      }
      return acc;
    }, []),
    partnerOrders
  );

  const orders = [...mergedOrders].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  const canViewFullOrderCode = Boolean(currentPhone);
  const maskOrderCode = (code) => String(code || "GHR-****").replace(/GHR-\d{4}/i, "GHR-****");

  useEffect(() => {
    if (selectedOrder || !orders.length || typeof window === "undefined") return;
    const targetCode = new URLSearchParams(window.location.search).get("orderCode");
    if (!targetCode) return;
    const matchedOrder = orders.find((order) => {
      const id = String(order?.id || "").trim().toLowerCase();
      const code = String(order?.orderCode || "").trim().toLowerCase();
      return id === targetCode.trim().toLowerCase() || code === targetCode.trim().toLowerCase();
    });
    if (matchedOrder) setSelectedOrder(matchedOrder);
  }, [orders, selectedOrder]);

  const shouldShowLoading = (isOrdersLoading || isPartnerOrdersLoading) && orders.length === 0;
  const shouldShowEmpty = !shouldShowLoading && orders.length === 0;

  const getOrderStatus = (order) => {
    const status = String(order?.status || order?.orderStatus || "").toLowerCase();
    if (status === "pending_zalo" || status === "new") return "Chờ xác nhận";
    if (status === "delivering" || status === "đang giao") return "Đang giao";
    if (status === "completed" || status === "done" || status === "hoàn tất") return "Hoàn tất";
    return "Đang thực hiện";
  };

  const getOrderStep = (order) => {
    const status = String(order?.status || order?.orderStatus || "").toLowerCase();
    const isDeliveryOrder = String(order?.fulfillmentType || "").toLowerCase() !== "pickup";
    if (status === "completed" || status === "done" || status === "hoàn tất") return isDeliveryOrder ? 3 : 2;
    if (isDeliveryOrder && (status === "delivering" || status === "đang giao")) return 2;
    if (["confirmed", "preparing", "cooking", "đang làm"].includes(status)) return 1;
    return 0;
  };

  const getStatusTone = (status) => {
    if (status === "Hoàn tất") return STATUS_TONE.done;
    if (status === "Đang giao") return STATUS_TONE.delivering;
    return STATUS_TONE.active;
  };

  const formatOrderTime = (value) => (value ? formatTime(value) : "--");

  const getDisplayOrderCode = (order) => {
    if (order?.sourceType === "partner") return order.displayOrderCode || order.orderCode || "FoodApp";
    return canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode);
  };

  const getOrderTotal = (order) => Number(order?.totalAmount || order?.total || 0);
  const getClaimablePoints = (order) => {
    const amount = Number(order?.pointsBaseAmount || order?.totalAmount || order?.total || 0);
    return Math.max(0, Number(calculateOrderPoints(amount, getLoyaltyRuleConfig()) || 0));
  };
  const getOrderBranchName = (order) => {
    return getCanonicalOrderBranchName(order, branches);
  };

  const updateClaimedPartnerOrder = (orderId, patch = {}) => {
    setPartnerOrders((items) => items.map((order) => (
      String(order.id) === String(orderId)
        ? { ...order, pointStatus: "claimed", ...patch }
        : order
    )));
  };

  const handleClaimPartnerPoints = async (event, order) => {
    event.stopPropagation();
    if (!currentPhone || !order?.id) return;

    const claimKey = order.id || order.orderCode;
    setClaimingOrderId(claimKey);
    try {
      const result = await claimPartnerOrderPoints({
        orderId: order.id,
        orderCode: order.orderCode,
        phone: currentPhone
      });

      if (!result.ok) {
        setServiceNotice?.({
          title: "Chưa cộng được điểm",
          description: result.message || "Bạn thử lại sau một chút nhé.",
          badge: "Tích điểm"
        });
        return;
      }

      updateClaimedPartnerOrder(order.id);
      setSelectedOrder((selected) => (
        String(selected?.id || "") === String(order.id)
          ? { ...selected, pointStatus: "claimed" }
          : selected
      ));
      setDemoLoyalty?.({
        ...(demoLoyalty || {}),
        totalPoints: result.totalPoints,
        pointHistory: [
          {
            id: `partner-point-${order.id}`,
            type: "PARTNER_ORDER_EARN",
            orderId: order.orderCode,
            displayOrderCode: order.displayOrderCode || order.orderCode,
            partnerOrderCode: order.orderCode,
            source: order.partnerSource || order.source || "",
            points: result.points,
            amount: getOrderTotal(order),
            title: `Cộng điểm từ đơn ${order.displayOrderCode || order.orderCode}`,
            note: getOrderBranchName(order),
            createdAt: new Date().toISOString()
          },
          ...((demoLoyalty?.pointHistory || []).filter((entry) => String(entry?.id || "") !== `partner-point-${order.id}`))
        ]
      });
      setServiceNotice?.({
        title: "Đã cộng điểm",
        description: `Bạn vừa nhận ${result.points.toLocaleString("vi-VN")} điểm từ đơn ${order.displayOrderCode || order.orderCode}.`,
        badge: "Thành công"
      });
    } finally {
      setClaimingOrderId("");
    }
  };

  const closeSelectedOrder = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("orderCode")) {
        url.searchParams.delete("orderCode");
        const nextUrl = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }
    setSelectedOrder(null);
  };

  return (
    <section>
      <AppHeader title="Đơn hàng" subtitle="Theo dõi trạng thái và đặt lại món cũ" onBack={() => navigate("home", "home")} />

      <div className="tracking-page-content space-y-4 px-4 pb-6">
        {shouldShowLoading && (
          <AppEmptyState
            icon="bag"
            title="Đang tải đơn hàng"
            message="Đang đồng bộ lịch sử đơn từ hệ thống..."
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
            center
          />
        )}

        {!shouldShowLoading &&
          orders.map((order) => {
            const status = getOrderStatus(order);
            const items = Array.isArray(order?.items) ? order.items : [];
            const isPartnerOrder = order?.sourceType === "partner";
            const sourceBadge = getOrderSourceBadge(order);
            const canClaimPoints = isPartnerOrder && String(order.pointStatus || "").toLowerCase() === "pending";
            const hasClaimedPoints = isPartnerOrder && String(order.pointStatus || "").toLowerCase() === "claimed";
            const isClaiming = String(claimingOrderId) === String(order.id || order.orderCode);
            const claimablePoints = getClaimablePoints(order);
            const branchName = getOrderBranchName(order);

            return (
              <CustomerCard
                as="article"
                key={order.orderCode || order.id}
                onClick={() => setSelectedOrder(order)}
                interactive
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="customer-caption">{formatOrderTime(order.createdAt)}</p>
                    <h2 className="mt-1 truncate customer-title-md">
                      {getDisplayOrderCode(order)}
                    </h2>
                    <p className="mt-1 customer-body">
                      {items.length} món · {formatMoney(getOrderTotal(order))}
                    </p>
                    {branchName ? (
                      <p className="mt-1 truncate text-xs font-semibold text-brown/45">{branchName}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${sourceBadge.className}`}>
                      {sourceBadge.label}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${getStatusTone(status)}`}>
                      {status}
                    </span>
                  </div>
                </div>

                <CustomerCard tone="soft" padding="sm" className="mt-4 space-y-2 shadow-none">
                  {items.slice(0, 3).map((item, index) => (
                    <div
                      key={item.cartId || `${order.orderCode}-${item.id || "item"}-${item.name || "name"}-${index}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-brown">{item.name}</p>
                        <p className="text-xs text-brown/50">x{item.quantity || 1}</p>
                      </div>

                      <span className="shrink-0 font-black text-orange-600">
                        {formatMoney(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1))}
                      </span>
                    </div>
                  ))}

                  {items.length > 3 && <p className="customer-caption">+{items.length - 3} món khác</p>}
                  {!items.length && isPartnerOrder ? (
                    <p className="text-sm font-semibold text-brown/55">Đơn từ foodapp, món sẽ hiển thị khi dữ liệu NexPOS đồng bộ đủ.</p>
                  ) : null}
                </CustomerCard>

                {canClaimPoints ? (
                  <CustomerButton
                    variant="primary"
                    full
                    className="mt-3"
                    disabled={isClaiming}
                    onClick={(event) => handleClaimPartnerPoints(event, order)}
                  >
                    {isClaiming ? "Đang cộng điểm..." : `+ ${claimablePoints.toLocaleString("vi-VN")} điểm`}
                  </CustomerButton>
                ) : hasClaimedPoints ? (
                  <div className="mt-3 rounded-2xl bg-green-50 px-4 py-3 text-center text-sm font-black text-green-700">
                    Đã cộng điểm
                  </div>
                ) : null}

                {!isPartnerOrder ? (
                <CustomerButton
                  variant="soft"
                  full
                  icon="cart"
                  className="mt-3"
                  onClick={(event) => {
                    event.stopPropagation();
                    const notice = getStoreBlockNotice?.();
                    if (notice) {
                      setServiceNotice?.(notice);
                      return;
                    }
                    onReorder(order);
                  }}
                >
                  Mua lại đơn này
                </CustomerButton>
                ) : null}
              </CustomerCard>
            );
          })}
      </div>

      {selectedOrder && (
        <OrderStatusSheet
          order={selectedOrder}
          step={getOrderStep(selectedOrder)}
          formatOrderTime={formatOrderTime}
          branches={branches}
          canViewFullOrderCode={canViewFullOrderCode}
          maskOrderCode={maskOrderCode}
          onClose={closeSelectedOrder}
        />
      )}
    </section>
  );
}
