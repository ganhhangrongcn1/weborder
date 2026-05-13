import { useEffect, useState } from "react";
import { orderRepository } from "../services/repositories/orderRepository.js";
import { customerRepository } from "../services/repositories/customerRepository.js";
import { STORAGE_KEYS } from "../services/repositories/storageKeys.js";

function isOpenOrderStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized && !["done", "completed", "hoàn tất", "cancelled", "canceled"].includes(normalized);
}

function resolveCurrentOrderCandidate(explicitCurrent, savedCurrent) {
  const allOrders = orderRepository.getAll();
  if (!allOrders.length) return null;

  const savedCurrentId = savedCurrent?.id || savedCurrent?.orderCode || "";
  const explicitCurrentId = explicitCurrent?.id || explicitCurrent?.orderCode || "";
  const preferredPhone = String(
    savedCurrent?.phone ||
    savedCurrent?.customerPhone ||
    savedCurrent?.customerPhoneKey ||
    explicitCurrent?.phone ||
    explicitCurrent?.customerPhone ||
    explicitCurrent?.customerPhoneKey ||
    ""
  ).trim();
  const scopedOrders = preferredPhone
    ? allOrders.filter((order) => {
        const orderPhone = String(order?.phone || order?.customerPhone || order?.customerPhoneKey || "").trim();
        return orderPhone && orderPhone === preferredPhone;
      })
    : [];
  const savedMatch = savedCurrentId
    ? allOrders.find((order) => String(order.id || order.orderCode) === String(savedCurrentId))
    : null;
  const explicitMatch = explicitCurrentId
    ? allOrders.find((order) => String(order.id || order.orderCode) === String(explicitCurrentId))
    : null;
  const latestScopedOpenOrder = scopedOrders.find((order) => isOpenOrderStatus(order?.status));
  const latestScopedOrder = scopedOrders[0] || null;
  const latestOpenOrder = allOrders.find((order) => isOpenOrderStatus(order?.status));

  return latestScopedOpenOrder || savedMatch || explicitMatch || latestScopedOrder || latestOpenOrder || null;
}

export default function useAppCoreState({ normalizeUserProfile, defaultUserProfile }) {
  const [userProfile, setUserProfileState] = useState(() => normalizeUserProfile(customerRepository.getUserProfile(defaultUserProfile)));
  const [currentOrder, setCurrentOrderState] = useState(() => orderRepository.getCurrentOrder(null));
  const [orderStatus, setOrderStatusState] = useState(() => orderRepository.getCurrentOrder(null)?.status || "confirmed");
  const [checkoutPreset, setCheckoutPresetState] = useState({
    fulfillmentType: "delivery",
    selectedBranch: "phu-hoa",
    pickupMode: "soon",
    pickupDate: "2026-05-02",
    pickupClock: "12:30"
  });

  function setUserProfile(value) {
    setUserProfileState(current => {
      const next = typeof value === "function" ? value(current) : value;
      return next;
    });
  }

  function setCurrentOrder(value) {
    setCurrentOrderState(current => {
      const next = typeof value === "function" ? value(current) : value;
      orderRepository.saveCurrentOrder(next);
      if (next?.status) setOrderStatusState(next.status);
      return next;
    });
  }

  function setOrderStatus(nextStatus) {
    setOrderStatusState(nextStatus);
  }

  function setCheckoutPreset(value) {
    setCheckoutPresetState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      return next === current ? current : next;
    });
  }

  useEffect(() => {
    const syncCurrentOrder = () => {
      setCurrentOrderState((current) => {
        const savedCurrent = orderRepository.getCurrentOrder(null);
        const next = resolveCurrentOrderCandidate(current, savedCurrent);
        if (next) {
          orderRepository.saveCurrentOrder(next);
        } else {
          orderRepository.clearCurrentOrder();
        }
        if (next?.status) setOrderStatusState(next.status);
        return next;
      });
    };

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEYS.ordersByPhone || event.key === STORAGE_KEYS.currentOrder) {
        syncCurrentOrder();
      }
    };

    window.addEventListener("ghr:orders-changed", syncCurrentOrder);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("ghr:orders-changed", syncCurrentOrder);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return {
    userProfile,
    setUserProfile,
    currentOrder,
    setCurrentOrder,
    orderStatus,
    setOrderStatus,
    checkoutPreset,
    setCheckoutPreset
  };
}
