import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ghr_active_order_floatboard_v1";

function getOrderKey(order = {}) {
  return String(order?.id || order?.orderCode || order?.order_code || "").trim();
}

function readPreference() {
  if (typeof window === "undefined") {
    return { collapsedByOrder: {}, seenSignatureByOrder: {} };
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      collapsedByOrder: stored?.collapsedByOrder && typeof stored.collapsedByOrder === "object"
        ? stored.collapsedByOrder
        : {},
      seenSignatureByOrder: stored?.seenSignatureByOrder && typeof stored.seenSignatureByOrder === "object"
        ? stored.seenSignatureByOrder
        : {}
    };
  } catch {
    return { collapsedByOrder: {}, seenSignatureByOrder: {} };
  }
}

function savePreference(preference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
  }
}

export default function useActiveOrderFloatboard(order, signature = "") {
  const [preference, setPreference] = useState(readPreference);
  const orderKey = getOrderKey(order);
  const isCollapsed = Boolean(orderKey && preference.collapsedByOrder?.[orderKey]);
  const seenSignature = orderKey ? preference.seenSignatureByOrder?.[orderKey] || "" : "";
  const hasUnreadUpdate = Boolean(isCollapsed && seenSignature && signature && seenSignature !== signature);

  useEffect(() => {
    if (!orderKey || !signature || seenSignature) return;
    setPreference((current) => ({
      ...current,
      seenSignatureByOrder: {
        ...current.seenSignatureByOrder,
        [orderKey]: signature
      }
    }));
  }, [orderKey, seenSignature, signature]);

  useEffect(() => {
    savePreference(preference);
  }, [preference]);

  const markCurrentStatusSeen = useCallback(() => {
    if (!orderKey || !signature) return;
    setPreference((current) => ({
      ...current,
      seenSignatureByOrder: {
        ...current.seenSignatureByOrder,
        [orderKey]: signature
      }
    }));
  }, [orderKey, signature]);

  const collapse = useCallback(() => {
    if (!orderKey) return;
    setPreference((current) => ({
      ...current,
      collapsedByOrder: {
        ...current.collapsedByOrder,
        [orderKey]: true
      },
      seenSignatureByOrder: signature
        ? { ...current.seenSignatureByOrder, [orderKey]: signature }
        : current.seenSignatureByOrder
    }));
  }, [orderKey, signature]);

  const expand = useCallback(() => {
    if (!orderKey) return;
    setPreference((current) => ({
      ...current,
      collapsedByOrder: {
        ...current.collapsedByOrder,
        [orderKey]: false
      },
      seenSignatureByOrder: signature
        ? { ...current.seenSignatureByOrder, [orderKey]: signature }
        : current.seenSignatureByOrder
    }));
  }, [orderKey, signature]);

  return {
    isCollapsed,
    hasUnreadUpdate,
    collapse,
    expand,
    markCurrentStatusSeen
  };
}
