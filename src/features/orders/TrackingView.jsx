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
import { orderStorage } from "../../services/orderService.js";
import {
  getCustomerOrderDisplayStatus,
  getCustomerOrderStatusToneClass
} from "../../services/customerOrderStatusService.js";
import { getCustomerOrderSummary } from "../../services/orderSummaryService.js";
import useGuestOrderLookup from "./hooks/useGuestOrderLookup.js";

const ORDER_HISTORY_PAGE_SIZE = 4;
const POST_LOGIN_REDIRECT_KEY = "ghr_post_login_redirect";

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
  const [visibleOrderCount, setVisibleOrderCount] = useState(ORDER_HISTORY_PAGE_SIZE);
  const [loadedHistoryOrders, setLoadedHistoryOrders] = useState([]);
  const [isHistoryOrdersLoading, setIsHistoryOrdersLoading] = useState(false);
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [isPartnerOrdersLoading, setIsPartnerOrdersLoading] = useState(false);
  const [claimingOrderId, setClaimingOrderId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [orderSummary, setOrderSummary] = useState({
    totalOrders: 0,
    totalSpent: 0,
    claimedPoints: 0,
    pendingPoints: 0
  });
  const guestLookup = useGuestOrderLookup();

  const historyOrders = Array.isArray(userProfile?.orderHistory) ? userProfile.orderHistory : [];
  const baseHistoryOrders = loadedHistoryOrders.length ? loadedHistoryOrders : historyOrders;
  const fallbackOrder = currentPhone && currentOrder ? [currentOrder] : [];

  useEffect(() => {
    setVisibleOrderCount(ORDER_HISTORY_PAGE_SIZE);
    setLoadedHistoryOrders([]);
    setPartnerOrders([]);
  }, [currentPhone]);

  useEffect(() => {
    let disposed = false;
    async function loadHistoryOrders() {
      if (!currentPhone) {
        setLoadedHistoryOrders([]);
        return;
      }
      setIsHistoryOrdersLoading(true);
      try {
        const nextOrders = await orderStorage.getByPhoneAsync(currentPhone, {
          limit: visibleOrderCount + 1
        });
        if (!disposed) setLoadedHistoryOrders(nextOrders);
      } finally {
        if (!disposed) setIsHistoryOrdersLoading(false);
      }
    }

    loadHistoryOrders();
    return () => {
      disposed = true;
    };
  }, [currentPhone, visibleOrderCount]);

  useEffect(() => {
    let disposed = false;
    async function loadPartnerOrders() {
      if (!currentPhone) {
        setPartnerOrders([]);
        return;
      }
      setIsPartnerOrdersLoading(true);
      try {
        const nextOrders = await getPartnerOrdersByPhone(currentPhone, {
          limit: visibleOrderCount + 1
        });
        if (!disposed) setPartnerOrders(nextOrders);
      } finally {
        if (!disposed) setIsPartnerOrdersLoading(false);
      }
    }

    loadPartnerOrders();
    return () => {
      disposed = true;
    };
  }, [currentPhone, visibleOrderCount]);

  const mergedOrders = mergeCustomerLookupOrders(
    [...baseHistoryOrders, ...fallbackOrder]
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

  const orders = [...(currentPhone ? mergedOrders : guestLookup.orders)].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  const searchedOrders = currentPhone && orderSearch.trim()
    ? orders.filter((order) => {
        const keyword = orderSearch.trim().toLowerCase();
        const haystack = [
          order?.orderCode,
          order?.displayOrderCode,
          order?.branchName,
          order?.pickupBranchName,
          order?.deliveryBranchName,
          order?.source,
          order?.partnerSource
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        return haystack.includes(keyword);
      })
    : orders;
  const visibleOrders = searchedOrders.slice(0, visibleOrderCount);
  const canLoadMoreOrders = searchedOrders.length > visibleOrderCount;
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

  const shouldShowLoading = (currentPhone ? (isOrdersLoading || isHistoryOrdersLoading || isPartnerOrdersLoading) : guestLookup.isLoading) && orders.length === 0;
  const shouldShowEmpty = !shouldShowLoading && orders.length === 0 && (currentPhone || guestLookup.lookupPhone);

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
  const getOrderRewardPoints = (order) => {
    const savedPoints = Number(order?.pointsEarned || 0);
    return savedPoints > 0 ? savedPoints : getClaimablePoints(order);
  };
  const getOrderBranchName = (order) => {
    return getCanonicalOrderBranchName(order, branches);
  };
  const getPointLabel = (order) => {
    const pointStatus = String(order.pointStatus || "").toLowerCase();
    if (pointStatus === "claimed") {
      return {
        label: "Đã tích điểm",
        className: "bg-green-50 text-green-700"
      };
    }
    return {
      label: "Chưa tích điểm",
      className: "bg-yellow-400 text-white"
    };
  };
  useEffect(() => {
    let disposed = false;
    async function loadOrderSummary() {
      if (!currentPhone) {
        setOrderSummary({
          totalOrders: 0,
          totalSpent: 0,
          claimedPoints: 0,
          pendingPoints: 0
        });
        return;
      }

      try {
        const nextSummary = await getCustomerOrderSummary(currentPhone);
        if (!disposed) setOrderSummary(nextSummary);
      } catch (error) {
        if (import.meta?.env?.DEV) {
          console.warn("[orders] load customer order summary failed", error);
        }
      }
    }

    loadOrderSummary();
    return () => {
      disposed = true;
    };
  }, [currentPhone, summaryRefreshKey]);

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
      setSummaryRefreshKey((key) => key + 1);
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

  const handleGuestPointLogin = (order) => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          POST_LOGIN_REDIRECT_KEY,
          JSON.stringify({
            target: "orders",
            phone: guestLookup.lookupPhone || guestLookup.phone || "",
            orderId: String(order?.id || order?.orderCode || "")
          })
        );
      } catch {
      }
    }
    navigate("account", "account");
  };

  return (
    <section>
      <AppHeader title="Đơn hàng" subtitle="Theo dõi trạng thái và đặt lại món cũ" onBack={() => navigate("home", "home")} />

      <div className="tracking-page-content space-y-4 px-4 pb-6">
        {!currentPhone ? (
          <CustomerCard className="space-y-4">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                <Icon name="gift" size={20} />
              </div>
              <h2 className="mt-3 text-center text-lg font-black text-brown">Tra cứu đơn và tích điểm</h2>
              <p className="mt-2 text-center text-sm leading-6 text-brown/60">
                Nhập số điện thoại để xem đơn và nhận điểm từ Grab, ShopeeFood, Xanh Ngon.
              </p>
            </div>

            <form onSubmit={guestLookup.handleSubmit} className="flex gap-2">
              <input
                value={guestLookup.phone}
                onChange={(event) => guestLookup.setPhone(event.target.value)}
                placeholder="Nhập số điện thoại"
                inputMode="tel"
                className="min-w-0 flex-1 rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={guestLookup.isLoading}
                className="shrink-0 rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange disabled:opacity-60"
              >
                {guestLookup.isLoading ? "Đang tìm" : "Tra cứu"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("account", "account")}
              className="w-full rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-600"
            >
              Đăng nhập để xem đầy đủ
            </button>

            {guestLookup.notice ? (
              <div className="rounded-2xl bg-cream/70 px-4 py-3 text-sm font-bold text-brown/65">
                {guestLookup.notice}
              </div>
            ) : null}
          </CustomerCard>
        ) : null}

        {currentPhone ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1.1fr] gap-2">
              <button
                type="button"
                className="rounded-2xl border border-orange-100 bg-white px-3 py-3 text-left shadow-soft"
              >
                <span className="flex items-center gap-2 text-xs font-black uppercase text-orange-600">
                  <Icon name="bag" size={15} />
                  Quản lý đơn
                </span>
                <span className="mt-1 block truncate text-[11px] font-bold text-brown/55">
                  Chi tiết và điểm thưởng
                </span>
              </button>
              <label className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-3 shadow-soft">
                <Icon name="search" size={17} />
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Tìm đơn"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-brown outline-none placeholder:text-brown/40"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 divide-x divide-orange-100 rounded-2xl border border-orange-100 bg-white px-2 py-3 shadow-soft">
              <div className="px-2">
                <p className="text-[11px] font-black uppercase text-brown/55">Tổng {orderSummary.totalOrders} đơn</p>
                <strong className="mt-1 block text-lg font-black text-orange-600">{formatMoney(orderSummary.totalSpent)}</strong>
              </div>
              <div className="px-2 text-center">
                <p className="text-[11px] font-black uppercase text-brown/55">Đã nhận</p>
                <strong className="mt-1 block text-lg font-black text-green-600">+{orderSummary.claimedPoints.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="px-2 text-right">
                <p className="text-[11px] font-black uppercase text-brown/55">Chờ nhận</p>
                <strong className="mt-1 block text-lg font-black text-orange-600">+{orderSummary.pendingPoints.toLocaleString("vi-VN")}</strong>
              </div>
            </div>
          </div>
        ) : null}

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
          visibleOrders.map((order) => {
            const statusMeta = getCustomerOrderDisplayStatus(order);
            const status = statusMeta.label;
            const isPartnerOrder = order?.sourceType === "partner";
            const sourceBadge = getOrderSourceBadge(order);
            const pointBadge = getPointLabel(order);
            const canClaimPoints = currentPhone && isPartnerOrder && String(order.pointStatus || "").toLowerCase() === "pending";
            const isClaiming = String(claimingOrderId) === String(order.id || order.orderCode);
            const rewardPoints = getOrderRewardPoints(order);
            const branchName = getOrderBranchName(order);

            if (!currentPhone) {
              return (
                <CustomerCard as="article" key={order.orderCode || order.id}>
                  <div className="flex items-start gap-3">
                    <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-sm font-black ${sourceBadge.className}`}>
                      {sourceBadge.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-black text-brown">
                            Đơn #{getDisplayOrderCode(order)}
                          </h2>
                          <p className="mt-1 text-xs font-semibold leading-5 text-brown/55">
                            {formatOrderTime(order.createdAt)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-2xl px-3 py-1 text-xs font-black ${getCustomerOrderStatusToneClass(statusMeta)}`}>
                          {status}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-orange-100 pt-3">
                        <p className="text-sm text-brown/60">
                          Tổng tiền: <strong className="text-base text-brown">{formatMoney(getOrderTotal(order))}</strong>
                        </p>
                        {pointBadge && String(order.pointStatus || "").toLowerCase() === "claimed" ? (
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${pointBadge.className}`}>
                            {pointBadge.label}
                          </span>
                        ) : pointBadge ? (
                          <button
                            type="button"
                            onClick={() => handleGuestPointLogin(order)}
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${pointBadge.className}`}
                          >
                            {pointBadge.label}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CustomerCard>
              );
            }

            if (currentPhone) {
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
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h2 className="truncate customer-title-md">
                          {getDisplayOrderCode(order)}
                        </h2>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${sourceBadge.className}`}>
                          {sourceBadge.label}
                        </span>
                      </div>
                      {branchName ? (
                        <p className="mt-2 truncate text-xs font-black uppercase text-brown/70">{branchName}</p>
                      ) : null}
                    </div>

                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${getCustomerOrderStatusToneClass(statusMeta)}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <strong className="text-lg font-black text-orange-600">
                      {formatMoney(getOrderTotal(order))}
                    </strong>
                    {canClaimPoints ? (
                      <button
                        type="button"
                        disabled={isClaiming}
                        onClick={(event) => handleClaimPartnerPoints(event, order)}
                        className="shrink-0 rounded-full bg-gradient-main px-4 py-2 text-sm font-black text-white shadow-orange disabled:opacity-60"
                      >
                        {isClaiming ? "Đang cộng..." : `+${rewardPoints.toLocaleString("vi-VN")}`}
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-orange-600">
                        +{rewardPoints.toLocaleString("vi-VN")}
                      </span>
                    )}
                  </div>
                </CustomerCard>
              );
            }

            return null;
          })}

        {!shouldShowLoading && canLoadMoreOrders ? (
          <CustomerButton
            variant="soft"
            full
            disabled={isHistoryOrdersLoading || isPartnerOrdersLoading}
            onClick={() => setVisibleOrderCount((count) => count + ORDER_HISTORY_PAGE_SIZE)}
          >
            {isHistoryOrdersLoading || isPartnerOrdersLoading ? "Đang tải thêm..." : "Xem thêm đơn hàng"}
          </CustomerButton>
        ) : null}
      </div>

      {selectedOrder && (
            <OrderStatusSheet
              order={selectedOrder}
              step={getCustomerOrderDisplayStatus(selectedOrder).step}
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
