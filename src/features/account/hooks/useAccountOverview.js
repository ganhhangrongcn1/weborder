import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_ACCOUNT_SUMMARY,
  getAccountOverview
} from "../../../services/accountOverviewService.js";
import { getCustomerKey } from "../../../services/storageService.js";

const INITIAL_OVERVIEW = {
  summary: null,
  loyalty: null,
  recentOrders: [],
  latestOrder: null,
  error: ""
};

export default function useAccountOverview({
  currentPhone,
  fallbackOrders = [],
  fallbackLoyalty = {}
}) {
  const [overview, setOverview] = useState(INITIAL_OVERVIEW);
  const [isLoading, setIsLoading] = useState(Boolean(currentPhone));
  const requestIdRef = useRef(0);
  const fallbackRef = useRef({
    orders: fallbackOrders,
    loyalty: fallbackLoyalty
  });

  useEffect(() => {
    fallbackRef.current = {
      orders: fallbackOrders,
      loyalty: fallbackLoyalty
    };
  }, [fallbackLoyalty, fallbackOrders]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const phoneKey = getCustomerKey(currentPhone);
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!phoneKey) {
      setOverview(INITIAL_OVERVIEW);
      setIsLoading(false);
      return null;
    }

    if (!silent) setIsLoading(true);

    try {
      const nextOverview = await getAccountOverview(phoneKey, {
        fallbackOrders: fallbackRef.current.orders,
        fallbackLoyalty: fallbackRef.current.loyalty
      });
      if (requestId !== requestIdRef.current) return null;
      setOverview(nextOverview);
      return nextOverview;
    } catch {
      if (requestId !== requestIdRef.current) return null;
      setOverview((current) => ({
        ...current,
        error: "Chưa thể đồng bộ dữ liệu tài khoản. Vui lòng thử lại."
      }));
      return null;
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [currentPhone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentPhone || typeof window === "undefined") return undefined;
    let refreshTimer = null;

    const scheduleRefresh = (event) => {
      const phoneKey = getCustomerKey(currentPhone);
      const changedPhones = Array.isArray(event?.detail?.changedPhones)
        ? event.detail.changedPhones.map((phone) => getCustomerKey(phone)).filter(Boolean)
        : [];
      if (changedPhones.length && !changedPhones.includes(phoneKey)) return;

      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refresh({ silent: true });
      }, 250);
    };

    window.addEventListener("ghr:orders-changed", scheduleRefresh);
    window.addEventListener("ghr:customer-data-changed", scheduleRefresh);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener("ghr:orders-changed", scheduleRefresh);
      window.removeEventListener("ghr:customer-data-changed", scheduleRefresh);
    };
  }, [currentPhone, refresh]);

  return {
    summary: overview.summary || EMPTY_ACCOUNT_SUMMARY,
    hasSummary: Boolean(overview.summary),
    loyalty: overview.loyalty || fallbackLoyalty,
    recentOrders: overview.recentOrders,
    latestOrder: overview.latestOrder,
    error: overview.error,
    isLoading,
    refresh
  };
}
