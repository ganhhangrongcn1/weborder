import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getPosWebsiteOrders, subscribePosWebsiteOrderChanges } from "../../../services/pos/posPickupOrderService";

// Website orders must not wait for pager/history/payment-session reads.
export default function usePosWebsiteOrderSync({ branchUuid, userId, setPickupOrders, setDeliveryOrders, setLoading, setError }) {
  const worker = useRef(null);
  const refresh = useCallback((options = {}) => worker.current?.refresh(options) || Promise.resolve(), []);
  useEffect(() => {
    setPickupOrders([]);
    setDeliveryOrders([]);
    setError("");
    setLoading(false);
    if (!branchUuid || !userId) return undefined;
    let active = true;
    let running = null;
    let pending = false;
    let pendingSilent = true;
    const load = (options = {}) => {
      if (!active) return Promise.resolve();
      pending = true;
      pendingSilent = pendingSilent && options.silent !== false;
      if (running) return running;
      running = (async () => {
        while (active && pending) {
          const silent = pendingSilent;
          pending = false;
          pendingSilent = true;
          if (!silent) setLoading(true);
          try {
            const orders = await getPosWebsiteOrders({ branchUuid, limit: 80 });
            if (!active) return;
            setPickupOrders(orders.pickupOrders || []);
            setDeliveryOrders(orders.deliveryOrders || []);
            setError("");
          } catch (error) {
            if (active) setError(error?.message || "Không tải được đơn website.");
          } finally {
            if (active) setLoading(false);
          }
        }
      })().finally(() => { running = null; });
      return running;
    };
    const current = { refresh: load };
    worker.current = current;
    void load({ silent: false });
    // Throttle, do not keep postponing a refresh while orders are arriving.
    let eventTimer = null;
    const unsubscribe = subscribePosWebsiteOrderChanges(branchUuid, () => {
      if (!active || eventTimer) return;
      eventTimer = setTimeout(() => { eventTimer = null; void load(); }, 150);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void load();
    }, 5000);
    const appState = AppState.addEventListener("change", state => {
      if (state === "active") void load();
    });
    return () => {
      active = false;
      pending = false;
      clearInterval(timer);
      clearTimeout(eventTimer);
      appState.remove();
      unsubscribe();
      if (worker.current === current) worker.current = null;
    };
  }, [branchUuid, userId, setPickupOrders, setDeliveryOrders, setLoading, setError]);
  return refresh;
}
