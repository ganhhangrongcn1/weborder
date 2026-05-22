import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenOrders,
  getNextKitchenOrderAction,
  markKitchenOrderDone,
  subscribeKitchenOrderChanges,
  updateKitchenOrderItemStatus
} from "../services/kitchenOrderService.js";
import { sortKitchenOrdersForBoard } from "../features/kitchen/kitchenOrderGrouping.js";

const REALTIME_RELOAD_DELAY_MS = 500;

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

function getKitchenItemKey(item = {}) {
  return String(item?.sourceItemId || item?.id || "").trim();
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

export default function useKitchenOrders(options = null) {
  const enabled = options?.enabled !== false;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState(() => getTodayDateKey());
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [updatingItemKey, setUpdatingItemKey] = useState("");
  const loadingOrdersRef = useRef(false);
  const realtimeReloadTimerRef = useRef(null);

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
        ...dateRange
      });

      setOrders(result.orders || []);
      setError(
        result.errors?.length
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
  }, [dateFilter, enabled, options]);

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
      unsubscribe = await subscribeKitchenOrderChanges(() => {
        if (!alive) return;
        if (realtimeReloadTimerRef.current) {
          window.clearTimeout(realtimeReloadTimerRef.current);
        }
        realtimeReloadTimerRef.current = window.setTimeout(() => {
          realtimeReloadTimerRef.current = null;
          loadOrders({ silent: true });
        }, REALTIME_RELOAD_DELAY_MS);
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
  }, [enabled, loadOrders]);

  const filteredOrders = useMemo(() => {
    return sortKitchenOrdersForBoard(orders.filter((order) => {
      if (sourceFilter !== "all" && order.sourceType !== sourceFilter) return false;
      if (!orderMatchesStatus(order, statusFilter)) return false;
      if (!orderMatchesSearch(order, search)) return false;
      return true;
    }));
  }, [orders, search, sourceFilter, statusFilter]);

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
    setUpdatingOrderId(orderId);
    setError("");
    setOrders((currentOrders) => currentOrders.map(patchOrderAction(order, action)));

    try {
      const result = await markKitchenOrderDone(order);
      if (!result.ok) {
        setOrders(previousOrders);
        setError(result.message || "Không cập nhật được trạng thái đơn.");
        return;
      }
    } catch (err) {
      setOrders(previousOrders);
      setError(err?.message || "Không cập nhật được trạng thái đơn.");
    } finally {
      setUpdatingOrderId("");
    }
  }, [orders, updatingOrderId]);

  const toggleItemDone = useCallback(async (order, item) => {
    const orderId = String(order?.id || "").trim();
    const itemId = getKitchenItemKey(item);
    if (!orderId || !itemId || updatingItemKey) return;

    const nextStatus = item.status === "done" ? "pending" : "done";
    const nextKey = `${order.sourceType}-${orderId}-${itemId}`;
    const previousOrders = orders;

    setUpdatingItemKey(nextKey);
    setError("");
    setOrders((currentOrders) => currentOrders.map(patchItemStatus(order, item, nextStatus)));

    try {
      const result = await updateKitchenOrderItemStatus(order, item, nextStatus);
      if (!result.ok) {
        setOrders(previousOrders);
        setError(result.message || "Không cập nhật được trạng thái món.");
        return;
      }
    } catch (err) {
      setOrders(previousOrders);
      setError(err?.message || "Không cập nhật được trạng thái món.");
    } finally {
      setUpdatingItemKey("");
    }
  }, [orders, updatingItemKey]);

  return {
    orders,
    filteredOrders,
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
    markDone,
    toggleItemDone,
    reload: () => loadOrders({ silent: true, force: true })
  };
}

export { getTodayDateKey };
