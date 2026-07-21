import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import AppEmptyState from "../../components/app/EmptyState.jsx";
import { CustomerButton, CustomerCard } from "../../components/customer/CustomerUI.jsx";
import OrderStatusSheet from "../../pages/customer/tracking/OrderStatusSheet.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  claimPartnerOrderPoints,
  getCanonicalOrderBranchName,
  getPartnerOrdersByPhone,
  getOrderSourceBadge,
  mergeCustomerLookupOrders
} from "../../services/partnerOrderService.js";
import { calculateOrderPoints, getLoyaltyRuleConfig } from "../../services/loyaltyService.js";
import { orderStorage } from "../../services/orderService.js";
import { orderRepository } from "../../services/repositories/orderRepository.js";
import {
  getCustomerOrderDisplayStatus,
  getCustomerOrderStatusToneClass
} from "../../services/customerOrderStatusService.js";
import {
  buildCustomerOrderPointStatusMap,
  getCustomerOrderPointStatuses,
  resolveCustomerOrderPointStatus
} from "../../services/customerOrderPointStatusService.js";
import { getCustomerOrderSummary } from "../../services/orderSummaryService.js";
import {
  buildLoyaltyOrderPointLookup,
  resolveOrderPointStatus
} from "../../services/loyaltyLedgerUtils.js";
import useGuestOrderLookup from "./hooks/useGuestOrderLookup.js";
import {
  cancelCustomerUnpaidOrder,
  prepareOrderForPaymentResume
} from "../../services/customerOrderActionService.js";

const ORDER_HISTORY_PAGE_SIZE = 4;
const POST_LOGIN_REDIRECT_KEY = "ghr_post_login_redirect";
const ORDER_DETAIL_INTENT_KEY = "ghr_open_order_detail_intent";
const ORDER_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang xử lý" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã hủy" }
];
const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});
const ORDER_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function getOrderFilterKey(order = {}) {
  const statusKey = getCustomerOrderDisplayStatus(order).key;
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "cancelled";
  return "active";
}

function formatOrderDateTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "--";
  return `${ORDER_DATE_FORMATTER.format(date)} · ${ORDER_TIME_FORMATTER.format(date)}`;
}

function markOrdersPointStatus(orders = [], loyaltyLookup = {}) {
  return (orders || []).map((order) => ({
    ...order,
    pointStatus: resolveOrderPointStatus(order, loyaltyLookup)
  }));
}

function markOrdersPointStatusFromRpc(orders = [], statusMap = new Map(), loyaltyLookup = {}) {
  return (orders || []).map((order) => {
    const pointStatus = resolveCustomerOrderPointStatus(statusMap, order);
    if (pointStatus) {
      return {
        ...order,
        pointStatus
      };
    }
    return {
      ...order,
      pointStatus: resolveOrderPointStatus(order, loyaltyLookup)
    };
  });
}

function createClaimedPointStatusMap(previousMap = new Map(), order = {}) {
  const nextMap = new Map(previousMap);
  [
    order?.id,
    order?.orderCode,
    order?.order_code,
    order?.displayOrderCode,
    order?.display_order_code,
    order?.partnerOrderId,
    order?.partner_order_id,
    order?.partnerOrderCode,
    order?.partner_order_code
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((key) => {
      nextMap.set(key, "claimed");
    });
  return nextMap;
}

export default function Tracking({
  navigate,
  userProfile,
  currentOrder,
  setCurrentOrder,
  currentPhone,
  hasCustomerAuthSession = false,
  requiresCustomerAuthSession = false,
  isOrdersLoading = false,
  hasFetchedOrdersOnce = false,
  isSessionRestoring = false,
  branches = [],
  demoLoyalty,
  setDemoLoyalty,
  onReorder,
  onOrderSheetVisibilityChange,
  getStoreBlockNotice,
  setServiceNotice,
  checkoutPreset = {}
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showSelectedOrderDetails, setShowSelectedOrderDetails] = useState(false);
  const [visibleOrderCount, setVisibleOrderCount] = useState(ORDER_HISTORY_PAGE_SIZE);
  const [loadedHistoryOrders, setLoadedHistoryOrders] = useState([]);
  const [isHistoryOrdersLoading, setIsHistoryOrdersLoading] = useState(false);
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [isPartnerOrdersLoading, setIsPartnerOrdersLoading] = useState(false);
  const [claimingOrderId, setClaimingOrderId] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [cancelOrderMessage, setCancelOrderMessage] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [orderSummary, setOrderSummary] = useState({
    totalOrders: 0,
    totalSpent: 0,
    claimedPoints: 0,
    pendingPoints: 0
  });
  const [currentOrderPointStatusMap, setCurrentOrderPointStatusMap] = useState(() => new Map());
  const guestLookup = useGuestOrderLookup();
  const canAccessFullOrderHistory = Boolean(
    currentPhone && (!requiresCustomerAuthSession || hasCustomerAuthSession)
  );
  const lastCreatedOrderId = orderRepository.getLastCreatedOrderId();
  const currentDeviceActiveOrder = useMemo(() => {
    if (!currentOrder) return null;
    const currentOrderId = String(currentOrder?.id || currentOrder?.orderCode || "").trim();
    const isCurrentDeviceOrder = Boolean(lastCreatedOrderId) && currentOrderId === lastCreatedOrderId;
    const isTrackableOrder = getOrderFilterKey(currentOrder) === "active" && currentOrder?.sourceType !== "partner";
    return isCurrentDeviceOrder && isTrackableOrder ? currentOrder : null;
  }, [currentOrder, lastCreatedOrderId]);

  useEffect(() => {
    onOrderSheetVisibilityChange?.(Boolean(selectedOrder));
  }, [onOrderSheetVisibilityChange, selectedOrder]);

  useEffect(() => () => {
    onOrderSheetVisibilityChange?.(false);
  }, [onOrderSheetVisibilityChange]);

  const isQrCounterFlow =
    String(checkoutPreset?.orderSource || checkoutPreset?.source || "").toLowerCase() === "qr_counter" ||
    (typeof window !== "undefined" && /^\/qr\/[^/]+/i.test(window.location.pathname || ""));

  const historyOrders = useMemo(
    () => (Array.isArray(userProfile?.orderHistory) ? userProfile.orderHistory : []),
    [userProfile?.orderHistory]
  );
  const baseHistoryOrders = loadedHistoryOrders.length ? loadedHistoryOrders : historyOrders;
  const deferredOrderSearch = useDeferredValue(orderSearch.trim());
  const hasOrderSearch = Boolean(deferredOrderSearch);
  const shouldLoadFullHistory = hasOrderSearch || orderFilter !== "all";
  const orderQueryLimit = shouldLoadFullHistory ? 0 : visibleOrderCount + 1;

  useEffect(() => {
    setVisibleOrderCount(ORDER_HISTORY_PAGE_SIZE);
    setLoadedHistoryOrders([]);
    setPartnerOrders([]);
    setCurrentOrderPointStatusMap(new Map());
    setOrderSearch("");
    setOrderFilter("all");
  }, [canAccessFullOrderHistory, currentPhone]);

  useEffect(() => {
    setVisibleOrderCount(ORDER_HISTORY_PAGE_SIZE);
  }, [hasOrderSearch, orderFilter]);

  useEffect(() => {
    let disposed = false;
    async function loadHistoryOrders() {
      if (!canAccessFullOrderHistory) {
        setLoadedHistoryOrders([]);
        return;
      }
      setIsHistoryOrdersLoading(true);
      try {
        const nextOrders = await orderStorage.getByPhoneAsync(currentPhone, {
          limit: orderQueryLimit
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
  }, [canAccessFullOrderHistory, currentPhone, orderQueryLimit]);

  useEffect(() => {
    let disposed = false;
    async function loadPartnerOrders() {
      if (!canAccessFullOrderHistory) {
        setPartnerOrders([]);
        return;
      }
      setIsPartnerOrdersLoading(true);
      try {
        const nextOrders = await getPartnerOrdersByPhone(currentPhone, {
          limit: orderQueryLimit
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
  }, [canAccessFullOrderHistory, currentPhone, orderQueryLimit]);

  useEffect(() => {
    let disposed = false;

    async function loadCurrentOrderPointStatuses() {
      if (!canAccessFullOrderHistory) {
        setCurrentOrderPointStatusMap(new Map());
        return;
      }

      try {
        const rows = await getCustomerOrderPointStatuses(currentPhone, { limit: 300 });
        if (!disposed) {
          setCurrentOrderPointStatusMap(buildCustomerOrderPointStatusMap(rows));
        }
      } catch (error) {
        if (import.meta?.env?.DEV) {
          console.warn("[orders] load current order point statuses failed", error);
        }
        if (!disposed) {
          setCurrentOrderPointStatusMap(new Map());
        }
      }
    }

    loadCurrentOrderPointStatuses();
    return () => {
      disposed = true;
    };
  }, [canAccessFullOrderHistory, currentPhone, summaryRefreshKey]);

  const mergedOrders = useMemo(
    () => {
      const uniqueOrders = new Map();
      [...baseHistoryOrders, ...(canAccessFullOrderHistory && currentOrder ? [currentOrder] : [])]
        .filter(Boolean)
        .forEach((item) => {
          const key = String(item?.id || item?.orderCode || "").trim();
          if (key && !uniqueOrders.has(key)) uniqueOrders.set(key, item);
        });
      return mergeCustomerLookupOrders([...uniqueOrders.values()], partnerOrders);
    },
    [baseHistoryOrders, canAccessFullOrderHistory, currentOrder, partnerOrders]
  );
  const loyaltyLookup = useMemo(
    () => buildLoyaltyOrderPointLookup(demoLoyalty?.pointHistory || []),
    [demoLoyalty?.pointHistory]
  );
  const resolvedCurrentOrders = useMemo(
    () => markOrdersPointStatusFromRpc(mergedOrders, currentOrderPointStatusMap, loyaltyLookup),
    [currentOrderPointStatusMap, loyaltyLookup, mergedOrders]
  );

  const guestOrders = useMemo(
    () => guestLookup.lookupPhone
      ? guestLookup.orders
      : (currentDeviceActiveOrder ? [currentDeviceActiveOrder] : []),
    [currentDeviceActiveOrder, guestLookup.lookupPhone, guestLookup.orders]
  );
  const orders = useMemo(
    () => [...(canAccessFullOrderHistory ? resolvedCurrentOrders : guestOrders)].sort(
      (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
    ),
    [canAccessFullOrderHistory, guestOrders, resolvedCurrentOrders]
  );
  const searchedOrders = useMemo(() => {
    if (!canAccessFullOrderHistory || !deferredOrderSearch) return orders;
    const keyword = deferredOrderSearch.toLowerCase();
    return orders.filter((order) => {
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
    });
  }, [canAccessFullOrderHistory, deferredOrderSearch, orders]);
  const orderFilterCounts = useMemo(
    () => searchedOrders.reduce((counts, order) => {
      const key = getOrderFilterKey(order);
      counts.all += 1;
      counts[key] += 1;
      return counts;
    }, { all: 0, active: 0, completed: 0, cancelled: 0 }),
    [searchedOrders]
  );
  const filteredOrders = useMemo(
    () => searchedOrders
      .filter((order) => orderFilter === "all" || getOrderFilterKey(order) === orderFilter)
      .sort((a, b) => {
        const activeDifference = Number(getOrderFilterKey(a) !== "active") - Number(getOrderFilterKey(b) !== "active");
        if (activeDifference !== 0) return activeDifference;
        return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
      }),
    [orderFilter, searchedOrders]
  );
  const visibleOrders = filteredOrders.slice(0, visibleOrderCount);
  const canLoadMoreOrders = filteredOrders.length > visibleOrderCount;
  const displayedOrderCount = !hasOrderSearch && orderFilter === "all"
    ? Number(orderSummary.totalOrders || filteredOrders.length)
    : filteredOrders.length;
  const canViewFullOrderCode = canAccessFullOrderHistory || Boolean(currentDeviceActiveOrder && !guestLookup.lookupPhone);
  const maskOrderCode = (code) => String(code || "GHR-****").replace(/GHR-\d{4}/i, "GHR-****");

  useEffect(() => {
    if (selectedOrder || !orders.length || typeof window === "undefined") return;
    let targetCode = new URLSearchParams(window.location.search).get("orderCode");
    let shouldShowDetails = false;
    try {
      const storedIntent = JSON.parse(window.sessionStorage.getItem(ORDER_DETAIL_INTENT_KEY) || "null");
      if (storedIntent?.orderId) {
        targetCode = String(storedIntent.orderId);
        shouldShowDetails = storedIntent.showDetails === true;
        window.sessionStorage.removeItem(ORDER_DETAIL_INTENT_KEY);
      }
    } catch {
    }
    if (!targetCode) return;
    const matchedOrder = orders.find((order) => {
      const id = String(order?.id || "").trim().toLowerCase();
      const code = String(order?.orderCode || "").trim().toLowerCase();
      return id === targetCode.trim().toLowerCase() || code === targetCode.trim().toLowerCase();
    });
    if (matchedOrder) {
      setShowSelectedOrderDetails(shouldShowDetails);
      setSelectedOrder(matchedOrder);
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOpenOrderDetail = (event) => {
      const targetCode = String(event?.detail?.orderId || "").trim().toLowerCase();
      if (!targetCode) return;
      const matchedOrder = orders.find((order) => {
        const id = String(order?.id || "").trim().toLowerCase();
        const code = String(order?.orderCode || "").trim().toLowerCase();
        return id === targetCode || code === targetCode;
      });
      if (!matchedOrder) return;
      try {
        window.sessionStorage.removeItem(ORDER_DETAIL_INTENT_KEY);
      } catch {
      }
      setShowSelectedOrderDetails(event?.detail?.showDetails === true);
      setSelectedOrder(matchedOrder);
    };
    window.addEventListener("ghr:open-order-detail", handleOpenOrderDetail);
    return () => window.removeEventListener("ghr:open-order-detail", handleOpenOrderDetail);
  }, [orders]);

  const shouldShowLoading = (canAccessFullOrderHistory ? (isOrdersLoading || isHistoryOrdersLoading || isPartnerOrdersLoading) : guestLookup.isLoading) && orders.length === 0;
  const shouldShowEmpty = !shouldShowLoading && orders.length === 0 && (canAccessFullOrderHistory || guestLookup.lookupPhone);
  const isOrderListRefreshing = shouldLoadFullHistory && (isHistoryOrdersLoading || isPartnerOrdersLoading);
  const shouldShowFilteredEmpty = !shouldShowLoading && !isOrderListRefreshing && orders.length > 0 && filteredOrders.length === 0;

  const formatOrderTime = (value) => formatOrderDateTime(value);

  const getDisplayOrderCode = (order) => {
    if (order?.sourceType === "partner") return order.displayOrderCode || order.orderCode || "FoodApp";
    return canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode);
  };

  const getOrderTotal = (order) => Number(order?.totalAmount || order?.total || 0);
  const getOrderDisplayAmount = (order) => {
    if (order?.sourceType !== "partner") return getOrderTotal(order);
    const receivedAmount = Number(order?.netReceivedAmount ?? order?.loyaltyEligibleAmount ?? 0);
    return receivedAmount > 0 ? receivedAmount : getOrderTotal(order);
  };
  const getOrderAmountLabel = (order) => {
    const receivedAmount = Number(order?.netReceivedAmount ?? order?.loyaltyEligibleAmount ?? 0);
    return order?.sourceType === "partner" && receivedAmount > 0 ? "Thực nhận" : "Tổng tiền";
  };
  const getClaimablePoints = (order) => {
    const isPartnerOrder = order?.sourceType === "partner";
    const amount = Number(
      isPartnerOrder
        ? order?.loyaltyEligibleAmount || order?.netReceivedAmount || 0
        : order?.pointsBaseAmount || order?.totalAmount || order?.total || 0
    );
    return Math.max(0, Number(calculateOrderPoints(amount, getLoyaltyRuleConfig()) || 0));
  };
  const getOrderRewardPoints = (order) => {
    const expectedPoints = Number(order?.expectedEarnPoints || 0);
    if (expectedPoints > 0) return expectedPoints;
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
    if (pointStatus === "waiting_data") {
      return {
        label: "Chờ đối soát",
        className: "bg-slate-100 text-slate-600"
      };
    }
    if (pointStatus === "expired") {
      return {
        label: "Đã hết hạn tích điểm",
        className: "bg-red-50 text-red-700"
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
      if (!canAccessFullOrderHistory) {
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
  }, [canAccessFullOrderHistory, currentPhone, summaryRefreshKey]);

  const updateClaimedPartnerOrder = (orderId, patch = {}) => {
    setPartnerOrders((items) => items.map((order) => (
      String(order.id) === String(orderId)
        ? { ...order, pointStatus: "claimed", ...patch }
        : order
    )));
  };

  const handleClaimPartnerPoints = async (event, order) => {
    event.stopPropagation();
    if (!canAccessFullOrderHistory || !currentPhone || !order?.id) return;

    const claimKey = order.id || order.orderCode;
    setClaimingOrderId(claimKey);
    try {
      const result = await claimPartnerOrderPoints({
        orderId: order.id,
        orderCode: order.orderCode,
        phone: currentPhone
      });

      if (result.alreadyClaimed) {
        updateClaimedPartnerOrder(order.id);
        setCurrentOrderPointStatusMap((previousMap) => createClaimedPointStatusMap(previousMap, order));
        setSummaryRefreshKey((key) => key + 1);
        setSelectedOrder((selected) => (
          String(selected?.id || "") === String(order.id)
            ? { ...selected, pointStatus: "claimed" }
            : selected
        ));
        setServiceNotice?.({
          title: "Đơn đã được cộng điểm",
          description: result.message || "Điểm của đơn này đã được ghi nhận trước đó.",
          badge: "Tích điểm"
        });
        return;
      }

      if (!result.ok) {
        if (result.pointStatus === "expired") {
          setPartnerOrders((items) => items.map((item) => (
            String(item.id) === String(order.id)
              ? { ...item, pointStatus: "expired" }
              : item
          )));
          setSummaryRefreshKey((key) => key + 1);
          setSelectedOrder((selected) => (
            String(selected?.id || "") === String(order.id)
              ? { ...selected, pointStatus: "expired" }
              : selected
          ));
        }
        setServiceNotice?.({
          title: "Chưa cộng được điểm",
          description: result.message || "Bạn thử lại sau một chút nhé.",
          badge: "Tích điểm"
        });
        return;
      }

      updateClaimedPartnerOrder(order.id);
      setCurrentOrderPointStatusMap((previousMap) => createClaimedPointStatusMap(previousMap, order));
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
            amount: getOrderDisplayAmount(order),
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
    setShowSelectedOrderDetails(false);
    setSelectedOrder(null);
  };

  const openOrderDetails = (order) => {
    const isPartnerOrder = order?.sourceType === "partner";
    setCancelOrderMessage("");
    setShowSelectedOrderDetails(isPartnerOrder || getOrderFilterKey(order) !== "active");
    setSelectedOrder(order);
  };

  const handleContinuePayment = (order) => {
    if (!order) return;
    const nextOrder = prepareOrderForPaymentResume(order);
    setCurrentOrder?.(nextOrder);
    closeSelectedOrder();
    navigate("success", "orders");
  };

  const replaceOrderInView = (nextOrder) => {
    const targetId = String(nextOrder?.id || nextOrder?.orderCode || "").trim();
    if (!targetId) return;
    setLoadedHistoryOrders((orders) => orders.map((item) => (
      String(item?.id || item?.orderCode || "").trim() === targetId ? nextOrder : item
    )));
    setSelectedOrder((current) => (
      String(current?.id || current?.orderCode || "").trim() === targetId ? nextOrder : current
    ));
    setCurrentOrder?.((current) => (
      String(current?.id || current?.orderCode || "").trim() === targetId ? nextOrder : current
    ));
  };

  const handleCancelSelectedOrder = async () => {
    if (!selectedOrder || cancellingOrderId) return;
    const targetId = String(selectedOrder.id || selectedOrder.orderCode || "").trim();
    setCancellingOrderId(targetId);
    setCancelOrderMessage("");
    try {
      const result = await cancelCustomerUnpaidOrder(selectedOrder);
      if (!result.ok) {
        setCancelOrderMessage(result.message || "Chưa thể hủy đơn lúc này.");
        return;
      }
      const nextOrder = prepareOrderForPaymentResume(result.order || {
        ...selectedOrder,
        status: "cancelled",
        kitchenStatus: "cancelled",
        paymentStatus: "cancelled"
      });
      replaceOrderInView(nextOrder);
      setServiceNotice?.({
        badge: "Đã hủy",
        title: "Đơn chưa thanh toán đã được hủy",
        description: "Đơn không được gửi vào bếp và mã thanh toán không còn hiệu lực."
      });
    } catch (error) {
      setCancelOrderMessage(error?.message || "Chưa thể hủy đơn lúc này.");
    } finally {
      setCancellingOrderId("");
    }
  };

  const handleReorderSelectedOrder = () => {
    if (!selectedOrder || typeof onReorder !== "function") return;
    const orderToReorder = selectedOrder;
    closeSelectedOrder();
    onReorder(orderToReorder);
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
    <section className="orders-page">
      <div className="tracking-page-content space-y-4 px-4 pb-6 pt-4">
        {!canAccessFullOrderHistory ? (
          <CustomerCard className="space-y-4">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                <Icon name="gift" size={20} />
              </div>
              <h2 className="mt-3 text-center text-lg font-black text-brown">Tra cứu đơn và tích điểm</h2>
              <p className="mt-2 text-center text-sm leading-6 text-brown/60">
                {isQrCounterFlow
                  ? "Nhập số điện thoại để xem đơn QR tại quầy và đơn website của bạn."
                  : "Nhập số điện thoại để xem đơn và nhận điểm từ Grab, ShopeeFood, Xanh Ngon."}
              </p>
            </div>

            <form onSubmit={guestLookup.handleSubmit} className="flex gap-2">
              <input
                value={guestLookup.phone}
                onChange={(event) => guestLookup.setPhone(event.target.value)}
                name="guestOrderPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-label="Số điện thoại tra cứu đơn"
                placeholder="Ví dụ: 0901 234 567…"
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

        {canAccessFullOrderHistory ? (
          <div className="orders-toolbar">
            <label className="orders-search">
              <Icon name="search" size={16} className="shrink-0 text-orange-600" />
              <span>Tìm đơn</span>
              <i aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  name="orderSearch"
                  autoComplete="off"
                  aria-label="Tìm đơn theo mã hoặc chi nhánh"
                  placeholder="Mã đơn hoặc chi nhánh…"
                />
              </div>
            </label>

            <div className="orders-summary-strip" aria-label="Tổng quan đơn hàng và điểm thưởng">
              <div>
                <p>
                  <Icon name="bag" size={14} />
                  Đã chi
                </p>
                <strong>{formatMoney(orderSummary.totalSpent)}</strong>
                <small>{orderSummary.totalOrders.toLocaleString("vi-VN")} đơn ghi nhận</small>
              </div>
              <div>
                <p>
                  <Icon name="star" size={14} />
                  Điểm đã nhận
                </p>
                <strong>+{orderSummary.claimedPoints.toLocaleString("vi-VN")}</strong>
                <small>điểm Gánh</small>
              </div>
              <div>
                <p>
                  <Icon name="clock" size={14} />
                  Điểm chờ nhận
                </p>
                <strong>+{orderSummary.pendingPoints.toLocaleString("vi-VN")}</strong>
                <small>đang đối soát</small>
              </div>
            </div>

            <div className="orders-filter-tabs" role="group" aria-label="Lọc đơn hàng theo trạng thái">
              {ORDER_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={orderFilter === filter.key}
                  className="orders-filter-tab"
                  onClick={() => setOrderFilter(filter.key)}
                >
                  <span>{filter.label}</span>
                  {filter.key === "all" || (shouldLoadFullHistory && !isOrderListRefreshing) ? (
                    <strong>{(
                      filter.key === "all" && shouldLoadFullHistory && !isOrderListRefreshing
                        ? orderFilterCounts.all
                        : filter.key === "all"
                          ? displayedOrderCount
                          : orderFilterCounts[filter.key]
                    ).toLocaleString("vi-VN")}</strong>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="orders-list-heading" aria-live="polite">
              <div>
                <strong>{orderFilter === "all" ? "Đơn gần đây" : ORDER_FILTERS.find((item) => item.key === orderFilter)?.label}</strong>
                <span>{displayedOrderCount.toLocaleString("vi-VN")} đơn phù hợp</span>
              </div>
              {isOrderListRefreshing ? <em>Đang cập nhật…</em> : null}
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
              canAccessFullOrderHistory
                ? "Các đơn đã đặt sẽ hiển thị ở đây để bạn dễ mua lại và theo dõi."
                : "Nếu bạn vừa mua bằng số đã đăng ký, hãy đăng nhập để xem lịch sử đơn đầy đủ."
            }
            actionText={canAccessFullOrderHistory ? "Đặt món ngay" : "Đăng nhập để xem đơn"}
            onAction={() => (canAccessFullOrderHistory ? navigate("menu", "menu") : navigate("account", "account"))}
            center
          />
        )}

        {shouldShowFilteredEmpty ? (
          <CustomerCard className="orders-no-result" padding="lg" aria-live="polite">
            <span className="orders-no-result__icon"><Icon name="search" size={22} /></span>
            <h2>Không tìm thấy đơn phù hợp</h2>
            <p>Thử nhập mã đơn khác, tên chi nhánh hoặc chọn trạng thái khác.</p>
            <button
              type="button"
              onClick={() => {
                setOrderSearch("");
                setOrderFilter("all");
              }}
            >
              Xóa bộ lọc
            </button>
          </CustomerCard>
        ) : null}

        {!shouldShowLoading &&
          visibleOrders.map((order) => {
            const statusMeta = getCustomerOrderDisplayStatus(order);
            const status = statusMeta.label;
            const isPartnerOrder = order?.sourceType === "partner";
            const sourceBadge = getOrderSourceBadge(order);
            const pointBadge = getPointLabel(order);
            const canClaimPoints = canAccessFullOrderHistory && isPartnerOrder && String(order.pointStatus || "").toLowerCase() === "pending";
            const isClaiming = String(claimingOrderId) === String(order.id || order.orderCode);
            const rewardPoints = getOrderRewardPoints(order);
            const branchName = getOrderBranchName(order);
            const orderItems = Array.isArray(order?.items) ? order.items : [];
            const firstItemName = String(orderItems[0]?.name || "").trim();
            const itemPreview = firstItemName
              ? `${firstItemName}${orderItems.length > 1 ? ` và ${orderItems.length - 1} món khác` : ""}`
              : `${Number(order?.itemCount || 0) || "Chưa rõ"} món`;
            const isActiveOrder = getOrderFilterKey(order) === "active";
            const canTrackJourney = isActiveOrder && !isPartnerOrder;
            const isAwaitingPayment = statusMeta.key === "awaiting_payment" && !isPartnerOrder;

            if (!canAccessFullOrderHistory) {
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
                          {getOrderAmountLabel(order)}: <strong className="text-base text-brown">{formatMoney(getOrderDisplayAmount(order))}</strong>
                        </p>
                        {pointBadge && ["claimed", "waiting_data", "expired"].includes(String(order.pointStatus || "").toLowerCase()) ? (
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
                      {canTrackJourney ? (
                        <button
                          type="button"
                          onClick={() => (isAwaitingPayment ? handleContinuePayment(order) : openOrderDetails(order))}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-600"
                        >
                          <Icon name={isAwaitingPayment ? "qr" : "clock"} size={16} />
                          {isAwaitingPayment ? "Tiếp tục thanh toán" : "Theo dõi hành trình"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </CustomerCard>
              );
            }

            if (canAccessFullOrderHistory) {
              return (
                <CustomerCard
                  as="article"
                  key={order.orderCode || order.id}
                  className={`orders-card ${isActiveOrder ? "orders-card--active" : ""}`}
                >
                  <div className="orders-card__head">
                    <div>
                      <span>{formatOrderTime(order.createdAt || order.orderTime)}</span>
                      <em className={sourceBadge.className}>{sourceBadge.label}</em>
                    </div>
                    <span className={`orders-card__status ${getCustomerOrderStatusToneClass(statusMeta)}`}>
                      {status}
                    </span>
                  </div>

                  <div className="orders-card__body">
                    <h2>{getDisplayOrderCode(order)}</h2>
                    {branchName ? <p>{branchName}</p> : null}
                    <span>{itemPreview}</span>
                  </div>

                  <div className="orders-card__footer">
                    <div className="orders-card__amount">
                      <span>{getOrderAmountLabel(order)}</span>
                      <strong>{formatMoney(getOrderDisplayAmount(order))}</strong>
                    </div>
                    <div className="orders-card__actions">
                    {canClaimPoints ? (
                      <button
                        type="button"
                        disabled={isClaiming}
                        onClick={(event) => handleClaimPartnerPoints(event, order)}
                        className="orders-card__claim"
                      >
                        <Icon name="gift" size={14} className="shrink-0" />
                        {isClaiming ? "Đang nhận…" : `Nhận +${rewardPoints.toLocaleString("vi-VN")}`}
                      </button>
                    ) : pointBadge ? (
                      <span className={`orders-card__points ${pointBadge.className}`}>
                        <Icon name={String(order.pointStatus || "").toLowerCase() === "claimed" ? "check" : "clock"} size={14} className="shrink-0" />
                        {pointBadge.label}
                      </span>
                    ) : null}
                      <button
                        type="button"
                        className="orders-card__detail"
                        aria-label={`${isAwaitingPayment ? "Tiếp tục thanh toán" : canTrackJourney ? "Theo dõi hành trình" : "Xem chi tiết"} đơn ${getDisplayOrderCode(order)}`}
                        onClick={() => (isAwaitingPayment ? handleContinuePayment(order) : openOrderDetails(order))}
                      >
                        <Icon name={isAwaitingPayment ? "qr" : canTrackJourney ? "clock" : "eye"} size={16} />
                        {isAwaitingPayment ? "Thanh toán tiếp" : canTrackJourney ? "Theo dõi hành trình" : "Chi tiết"}
                      </button>
                    </div>
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
          key={`${selectedOrder.id || selectedOrder.orderCode}:${showSelectedOrderDetails ? "detail" : "journey"}`}
          order={selectedOrder}
          formatOrderTime={formatOrderTime}
          branches={branches}
          canViewFullOrderCode={canViewFullOrderCode}
          maskOrderCode={maskOrderCode}
          initialShowDetails={showSelectedOrderDetails}
          canReorder={["completed", "cancelled"].includes(getCustomerOrderDisplayStatus(selectedOrder).key) && typeof onReorder === "function"}
          onReorder={handleReorderSelectedOrder}
          onContinuePayment={() => handleContinuePayment(selectedOrder)}
          onCancelUnpaid={handleCancelSelectedOrder}
          isCancelling={String(cancellingOrderId) === String(selectedOrder.id || selectedOrder.orderCode)}
          cancelMessage={cancelOrderMessage}
          onClose={closeSelectedOrder}
        />
      )}
    </section>
  );
}
