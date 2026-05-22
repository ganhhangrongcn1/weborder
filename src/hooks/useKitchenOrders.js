import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenOrders,
  getNextKitchenOrderAction,
  markKitchenOrderDone,
  subscribeKitchenOrderChanges
} from "../services/kitchenOrderService.js";
import {
  claimMonthlyCustomerGift,
  enrichKitchenOrdersWithMonthlyGifts
} from "../services/kitchenCustomerRewardService.js";
import {
  sortKitchenDoneOrders,
  sortKitchenOrdersForBoard
} from "../features/kitchen/kitchenOrderGrouping.js";

const REALTIME_RELOAD_DELAY_MS = 2000;
const ITEM_REALTIME_RELOAD_DELAY_MS = 5000;
const RECENT_ORDER_ITEM_SYNC_MS = 2 * 60 * 1000;
const RECENTLY_CLOSED_SUPPRESS_MS = 30000;
const DONE_ORDER_PAGE_SIZE = 20;

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(dateKey = "") {
  if (!dateKey) return { dateFrom: "", dateTo: "" };

  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString()
  };
}

function getTimeValue(value = "") {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTimeInRange(value = "", range = {}) {
  const timeValue = getTimeValue(value);
  if (!timeValue) return false;

  const fromValue = getTimeValue(range.dateFrom);
  const toValue = getTimeValue(range.dateTo);

  if (fromValue && timeValue < fromValue) return false;
  if (toValue && timeValue >= toValue) return false;
  return true;
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function orderMatchesStatus(order = {}, statusFilter = "active") {
  const status = normalizeText(order.kitchenStatus || order.status);
  const orderStatus = normalizeText(order.status);
  const isWebsite = order.sourceType === "website";
  const isWebsiteHandoff = ["ready_for_pickup", "ready_for_delivery", "delivering"].includes(orderStatus);
  const isLegacyWebsiteDone = isWebsite && ["done", "completed"].includes(status) && !isWebsiteHandoff;

  if (statusFilter === "all") return true;
  if (statusFilter === "done") return ["done", "completed"].includes(orderStatus) || isLegacyWebsiteDone || (order.sourceType === "partner" && ["done", "completed"].includes(status));
  if (statusFilter === "cancelled") return status === "cancelled";
  if (isLegacyWebsiteDone) return false;
  return !["done", "completed", "cancelled", "preorder"].includes(orderStatus) && !(order.sourceType === "partner" && ["done", "completed", "cancelled", "preorder"].includes(status));
}

function normalizeSourceKey(value = "") {
  const key = normalizeText(value);
  if (!key) return "other";
  if (["grab", "grabfood"].includes(key)) return "grabfood";
  if (["shopee", "shopeefood"].includes(key)) return "shopeefood";
  if (["xanhngon", "xanh_ngon", "xanh ngon"].includes(key)) return "xanhngon";
  if (["weborder", "online"].includes(key)) return "website";
  return key;
}

function orderMatchesSource(order = {}, sourceFilter = "all") {
  const filter = normalizeText(sourceFilter);
  if (filter === "all") return true;

  const sourceType = normalizeText(order.sourceType);
  const source = normalizeSourceKey(order.source);

  if (filter === "partner") return sourceType === "partner";
  if (filter === "website") return sourceType === "website" && source === "website";
  if (filter === "pickup") return sourceType === "website" && source === "pickup";
  if (filter === "qr_counter") return sourceType === "website" && source === "qr_counter";
  if (filter === "grabfood") return source === "grabfood";
  if (filter === "shopeefood") return source === "shopeefood";
  if (filter === "xanhngon") return source === "xanhngon";

  return source === filter;
}

function orderMatchesSearch(order = {}, search = "") {
  const query = normalizeText(search);
  if (!query) return true;

  const orderText = [
    order.orderCode,
    order.displayOrderCode,
    order.platform,
    order.branchName,
    order.customerName,
    order.customerPhone,
    order.status,
    order.displayStatus
  ].join(" ");

  const itemText = (order.items || [])
    .map((item) => [item.name, item.note, ...(item.options || [])].join(" "))
    .join(" ");

  return normalizeText(`${orderText} ${itemText}`).includes(query);
}

function isSameKitchenOrder(first = {}, second = {}) {
  return (
    String(first?.sourceType || "") === String(second?.sourceType || "") &&
    String(first?.id || "") === String(second?.id || "")
  );
}

function normalizeKitchenOrderRuntimeKey(order = {}, value = "") {
  const id = String(value || "").trim();
  if (!id) return "";
  if (id.includes(":")) return id;
  return `${String(order?.sourceType || "order").trim() || "order"}:${id}`;
}

function getKitchenOrderRuntimeKeys(order = {}) {
  const raw = order?.raw && typeof order.raw === "object" ? order.raw : {};
  const keys = [
    order?.stableKey,
    raw?.stable_key,
    raw?.nexpos_order_id,
    raw?.display_order_code,
    raw?.order_code,
    raw?.id,
    order?.displayOrderCode,
    order?.orderCode,
    order?.id
  ]
    .map((value) => normalizeKitchenOrderRuntimeKey(order, value))
    .filter(Boolean);

  return Array.from(new Set(keys));
}

function getKitchenOrderRuntimeKey(order = {}) {
  return getKitchenOrderRuntimeKeys(order)[0] || "";
}

function rememberRecentlyClosedOrder(order = {}, expiresAt = 0, recentlyClosed = new Map()) {
  getKitchenOrderRuntimeKeys(order).forEach((key) => {
    recentlyClosed.set(key, expiresAt);
  });
}

function forgetRecentlyClosedOrder(order = {}, recentlyClosed = new Map()) {
  getKitchenOrderRuntimeKeys(order).forEach((key) => {
    recentlyClosed.delete(key);
  });
}

function getRecentlyClosedExpiresAt(order = {}, recentlyClosed = new Map()) {
  return getKitchenOrderRuntimeKeys(order).reduce((latestExpiresAt, key) => {
    const expiresAt = Number(recentlyClosed.get(key) || 0);
    return expiresAt > latestExpiresAt ? expiresAt : latestExpiresAt;
  }, 0);
}

function ordersShareRuntimeKey(first = {}, second = {}) {
  const firstKeys = new Set(getKitchenOrderRuntimeKeys(first));
  return getKitchenOrderRuntimeKeys(second).some((key) => firstKeys.has(key));
}

function getKitchenItemKey(item = {}) {
  return String(item?.sourceItemId || item?.id || "").trim();
}

function getRealtimeOrderId(change = {}) {
  const row = change?.payload?.new || change?.payload?.old || {};
  if (change?.table === "order_items") return String(row.order_id || "").trim();
  if (change?.table === "partner_order_items") return String(row.partner_order_id || "").trim();
  return String(row.id || row.order_code || row.display_order_code || "").trim();
}

function isRealtimeItemTable(table = "") {
  return table === "order_items" || table === "partner_order_items";
}

function getKitchenOrderIds(order = {}) {
  return [
    order.id,
    order.orderCode,
    order.displayOrderCode,
    order.raw?.id,
    order.raw?.order_code,
    order.raw?.display_order_code
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function findOrderByRealtimeOrderId(orderId = "", currentOrders = []) {
  const key = String(orderId || "").trim();
  if (!key) return null;
  return (Array.isArray(currentOrders) ? currentOrders : []).find((order) => (
    getKitchenOrderIds(order).includes(key)
  )) || null;
}

function shouldReloadForItemRealtime(change = {}, currentOrders = []) {
  if (!isRealtimeItemTable(change?.table)) return true;

  const matchedOrder = findOrderByRealtimeOrderId(getRealtimeOrderId(change), currentOrders);
  if (!matchedOrder) return false;
  if (!Array.isArray(matchedOrder.items) || matchedOrder.items.length === 0) return true;

  const orderTimeValue = getTimeValue(matchedOrder.createdAt || matchedOrder.orderTime || matchedOrder.raw?.created_at || matchedOrder.raw?.order_time);
  return Boolean(orderTimeValue && Date.now() - orderTimeValue <= RECENT_ORDER_ITEM_SYNC_MS);
}

function realtimeEventMatchesDate(change = {}, dateRange = {}, currentOrders = []) {
  const row = change?.payload?.new || change?.payload?.old || {};

  if (change?.table === "orders") {
    return isTimeInRange(row.created_at, dateRange);
  }

  if (change?.table === "partner_orders") {
    return isTimeInRange(row.order_time || row.created_at, dateRange);
  }

  const changedOrderId = getRealtimeOrderId(change);
  if (!changedOrderId) return true;

  return Boolean(findOrderByRealtimeOrderId(changedOrderId, currentOrders));
}

function shouldSuppressAfterDoneAction(order = {}, action = null) {
  return Boolean(
    action?.settleOrder ||
      order.sourceType === "partner" ||
      action?.type === "partner_done"
  );
}

function getKitchenItemDisplayStatus(status = "") {
  return status === "done" ? "Đã xong" : "Chưa xong";
}

function getBranchDisplayStatus(status = "", kitchenStatus = "", fulfillmentType = "") {
  const normalizedStatus = String(status || "").toLowerCase();
  const normalizedKitchen = String(kitchenStatus || "").toLowerCase();
  const fulfillment = String(fulfillmentType || "").toLowerCase();

  if (["done", "completed"].includes(normalizedStatus)) return "Hoàn thành";
  if (normalizedStatus === "delivering") return "Đang giao";
  if (normalizedStatus === "ready_for_pickup" || (fulfillment === "pickup" && normalizedKitchen === "ready")) return "Chờ khách lấy";
  if (normalizedStatus === "ready_for_delivery" || (fulfillment === "delivery" && normalizedKitchen === "ready")) return "Chờ shipper";
  if (normalizedKitchen === "done") return "Đã xong";
  if (normalizedKitchen === "ready") return "Sẵn sàng";
  if (normalizedKitchen === "cooking") return "Đang làm";
  if (normalizedKitchen === "confirmed") return "Đã nhận";
  return "Đang chờ";
}

function patchOrderAction(targetOrder = {}, action = null) {
  const now = new Date().toISOString();

  return (order = {}) => {
    if (!isSameKitchenOrder(order, targetOrder)) return order;
    const nextStatus = action?.nextStatus || order.status;
    const nextKitchenStatus = action?.nextKitchenStatus || "done";

    return {
      ...order,
      status: nextStatus,
      kitchenStatus: nextKitchenStatus,
      displayStatus: getBranchDisplayStatus(nextStatus, nextKitchenStatus, order.fulfillmentType),
      doneAt: now,
      raw: {
        ...(order.raw || {}),
        status: order.sourceType === "website" ? nextStatus : order.raw?.status,
        kitchen_status: order.sourceType === "website" ? nextKitchenStatus : order.raw?.kitchen_status,
        kitchen_work_status: order.sourceType === "partner" ? nextKitchenStatus : order.raw?.kitchen_work_status,
        kitchen_done_at: now
      }
    };
  };
}

function patchItemStatus(targetOrder = {}, targetItem = {}, nextStatus = "pending") {
  const now = new Date().toISOString();
  const targetItemKey = getKitchenItemKey(targetItem);

  return (order = {}) => {
    if (!isSameKitchenOrder(order, targetOrder)) return order;

    return {
      ...order,
      items: (order.items || []).map((item) => {
        if (getKitchenItemKey(item) !== targetItemKey) return item;

        return {
          ...item,
          status: nextStatus,
          displayStatus: getKitchenItemDisplayStatus(nextStatus),
          doneAt: nextStatus === "done" ? now : "",
          raw: {
            ...(item.raw || {}),
            kitchen_item_status: nextStatus,
            kitchen_done_at: nextStatus === "done" ? now : null
          }
        };
      })
    };
  };
}

function patchMonthlyGiftClaim(targetOrder = {}, gift = {}) {
  return (order = {}) => {
    if (!isSameKitchenOrder(order, targetOrder)) return order;

    return {
      ...order,
      monthlyGift: {
        ...(order.monthlyGift || {}),
        claimed: true,
        canClaim: false,
        claimedAt: gift?.claimed_at || new Date().toISOString(),
        claimedOrderCode: gift?.claimed_order_code || order.displayOrderCode || order.orderCode || "",
        claimedByName: gift?.claimed_by_name || ""
      }
    };
  };
}

export default function useKitchenOrders(options = null) {
  const enabled = options?.enabled !== false;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState(() => getTodayDateKey());
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [doneOrderLimit, setDoneOrderLimit] = useState(DONE_ORDER_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [updatingItemKey] = useState("");
  const [claimingGiftOrderId, setClaimingGiftOrderId] = useState("");
  const loadingOrdersRef = useRef(false);
  const realtimeReloadTimerRef = useRef(null);
  const recentlyClosedOrderKeysRef = useRef(new Map());
  const currentOrdersRef = useRef([]);

  useEffect(() => {
    currentOrdersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    setDoneOrderLimit(DONE_ORDER_PAGE_SIZE);
  }, [dateFilter, sourceFilter, statusFilter]);

  const stabilizeRecentlyClosedOrders = useCallback((list = [], currentOrders = []) => {
    const now = Date.now();
    const recentlyClosed = recentlyClosedOrderKeysRef.current;
    const stableOrders = [];

    (Array.isArray(list) ? list : []).forEach((order) => {
      const expiresAt = getRecentlyClosedExpiresAt(order, recentlyClosed);
      if (!expiresAt) {
        stableOrders.push(order);
        return;
      }

      if (expiresAt <= now) {
        forgetRecentlyClosedOrder(order, recentlyClosed);
        stableOrders.push(order);
        return;
      }

      if (!orderMatchesStatus(order, "active")) {
        forgetRecentlyClosedOrder(order, recentlyClosed);
        stableOrders.push(order);
        return;
      }

      const optimisticClosedOrder = (Array.isArray(currentOrders) ? currentOrders : []).find((currentOrder) => (
        ordersShareRuntimeKey(currentOrder, order) && !orderMatchesStatus(currentOrder, "active")
      ));

      if (optimisticClosedOrder) {
        stableOrders.push(optimisticClosedOrder);
      }
    });

    return stableOrders;
  }, []);

  const loadOrders = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (loadingOrdersRef.current && !force) return;
    loadingOrdersRef.current = true;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const dateRange = getDateRange(dateFilter);
      const result = await getKitchenOrders({
        ...(options || {}),
        ...dateRange,
        statusFilter,
        sourceFilter,
        doneLimit: statusFilter === "done" ? doneOrderLimit + 1 : 0
      });
      const giftResult = await enrichKitchenOrdersWithMonthlyGifts(result.orders || [], {
        dateKey: dateFilter,
        dateFrom: dateRange.dateFrom
      });
      const hasReadError = Boolean(result.errors?.length || giftResult.error);

      setOrders((currentOrders) => (
        stabilizeRecentlyClosedOrders(giftResult.orders || result.orders || [], currentOrders)
      ));
      setError(
        hasReadError
          ? "Một nguồn đơn chưa đọc được. Các nguồn còn lại vẫn đang hiển thị."
          : ""
      );
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err?.message || "Không tải được danh sách đơn bếp.");
    } finally {
      loadingOrdersRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFilter, doneOrderLimit, enabled, sourceFilter, stabilizeRecentlyClosedOrders, statusFilter, options]);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      return;
    }
    loadOrders();
  }, [enabled, loadOrders]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let unsubscribe = () => {};

    async function startRealtime() {
      unsubscribe = await subscribeKitchenOrderChanges((change) => {
        if (!alive) return;
        const dateRange = getDateRange(dateFilter);
        if (!realtimeEventMatchesDate(change, dateRange, currentOrdersRef.current)) return;
        if (!shouldReloadForItemRealtime(change, currentOrdersRef.current)) return;

        if (realtimeReloadTimerRef.current) {
          window.clearTimeout(realtimeReloadTimerRef.current);
        }
        realtimeReloadTimerRef.current = window.setTimeout(() => {
          realtimeReloadTimerRef.current = null;
          loadOrders({ silent: true });
        }, isRealtimeItemTable(change.table) ? ITEM_REALTIME_RELOAD_DELAY_MS : REALTIME_RELOAD_DELAY_MS);
      });
    }

    startRealtime();

    return () => {
      alive = false;
      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }
      unsubscribe?.();
    };
  }, [dateFilter, enabled, loadOrders]);

  const filteredOrders = useMemo(() => {
    const matchedOrders = orders.filter((order) => {
      if (!orderMatchesSource(order, sourceFilter)) return false;
      if (!orderMatchesStatus(order, statusFilter)) return false;
      if (!orderMatchesSearch(order, search)) return false;
      return true;
    });

    if (statusFilter === "done") {
      return sortKitchenDoneOrders(matchedOrders).slice(0, doneOrderLimit);
    }

    return sortKitchenOrdersForBoard(matchedOrders);
  }, [doneOrderLimit, orders, search, sourceFilter, statusFilter]);

  const canLoadMoreDoneOrders = useMemo(() => {
    if (statusFilter !== "done") return false;
    const doneMatches = orders.filter((order) => {
      if (!orderMatchesSource(order, sourceFilter)) return false;
      if (!orderMatchesStatus(order, "done")) return false;
      if (!orderMatchesSearch(order, search)) return false;
      return true;
    });
    return doneMatches.length > doneOrderLimit;
  }, [doneOrderLimit, orders, search, sourceFilter, statusFilter]);

  const loadMoreDoneOrders = useCallback(() => {
    setDoneOrderLimit((limit) => limit + DONE_ORDER_PAGE_SIZE);
  }, []);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((order) => orderMatchesStatus(order, "active"));
    const doneOrders = orders.filter((order) => orderMatchesStatus(order, "done"));
    const cancelledOrders = orders.filter((order) => orderMatchesStatus(order, "cancelled"));
    const partnerOrders = orders.filter((order) => order.sourceType === "partner");
    const websiteOrders = orders.filter((order) => order.sourceType === "website");

    return {
      total: orders.length,
      active: activeOrders.length,
      done: doneOrders.length,
      cancelled: cancelledOrders.length,
      partner: partnerOrders.length,
      website: websiteOrders.length
    };
  }, [orders]);

  const markDone = useCallback(async (order) => {
    const orderId = String(order?.id || "").trim();
    if (!orderId || updatingOrderId) return;
    const action = getNextKitchenOrderAction(order);
    if (!action) return;

    const previousOrders = orders;
    const shouldSuppressReloadEcho = shouldSuppressAfterDoneAction(order, action);
    const orderRuntimeKey = getKitchenOrderRuntimeKey(order);
    if (shouldSuppressReloadEcho && orderRuntimeKey) {
      rememberRecentlyClosedOrder(
        order,
        Date.now() + RECENTLY_CLOSED_SUPPRESS_MS,
        recentlyClosedOrderKeysRef.current
      );
    }

    setUpdatingOrderId(orderId);
    setError("");
    setOrders((currentOrders) => currentOrders.map(patchOrderAction(order, action)));

    try {
      const result = await markKitchenOrderDone(order);
      if (!result.ok) {
        if (orderRuntimeKey) forgetRecentlyClosedOrder(order, recentlyClosedOrderKeysRef.current);
        setOrders(previousOrders);
        setError(result.message || "Không cập nhật được trạng thái đơn.");
        return;
      }
    } catch (err) {
      if (orderRuntimeKey) forgetRecentlyClosedOrder(order, recentlyClosedOrderKeysRef.current);
      setOrders(previousOrders);
      setError(err?.message || "Không cập nhật được trạng thái đơn.");
    } finally {
      setUpdatingOrderId("");
    }
  }, [orders, updatingOrderId]);

  const toggleItemDone = useCallback((order, item) => {
    const orderId = String(order?.id || "").trim();
    const itemId = getKitchenItemKey(item);
    if (!orderId || !itemId || updatingItemKey) return;

    const nextStatus = item.status === "done" ? "pending" : "done";
    setError("");
    setOrders((currentOrders) => currentOrders.map(patchItemStatus(order, item, nextStatus)));
  }, [updatingItemKey]);

  const claimGift = useCallback(async (order) => {
    const orderId = String(order?.id || "").trim();
    if (!orderId || claimingGiftOrderId) return;

    const previousOrders = orders;
    setClaimingGiftOrderId(orderId);
    setError("");

    try {
      const result = await claimMonthlyCustomerGift(order, {
        dateKey: dateFilter,
        profileId: options?.profileId || "",
        profileName: options?.profileName || ""
      });

      if (!result.ok) {
        setError(result.message || "Không xác nhận được quà khách quen.");
        return;
      }

      setOrders((currentOrders) => currentOrders.map(patchMonthlyGiftClaim(order, result.gift || {})));
      if (result.alreadyClaimed) {
        setError(result.message || "Khách này đã được tặng quà trong tháng.");
      }
    } catch (err) {
      setOrders(previousOrders);
      setError(err?.message || "Không xác nhận được quà khách quen.");
    } finally {
      setClaimingGiftOrderId("");
    }
  }, [claimingGiftOrderId, dateFilter, options, orders]);

  return {
    orders,
    filteredOrders,
    canLoadMoreDoneOrders,
    stats,
    loading,
    refreshing,
    error,
    dateFilter,
    setDateFilter,
    sourceFilter,
    setSourceFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    lastUpdatedAt,
    updatingOrderId,
    updatingItemKey,
    claimingGiftOrderId,
    loadMoreDoneOrders,
    markDone,
    toggleItemDone,
    claimGift,
    reload: () => loadOrders({ silent: true, force: true })
  };
}

export { getTodayDateKey };
