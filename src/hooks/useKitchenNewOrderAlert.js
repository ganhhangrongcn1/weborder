import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ghr_kitchen_sound_enabled";

function getOrderKey(order = {}) {
  return String(order?.id || order?.orderCode || "").trim();
}

function playTone() {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
  gain.connect(context.destination);

  [880, 1175].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.08);
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.08);
    oscillator.stop(context.currentTime + 0.42);
  });

  window.setTimeout(() => {
    context.close().catch(() => {});
  }, 600);
}

export default function useKitchenNewOrderAlert(orders = [], enabled = true) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [newOrderCount, setNewOrderCount] = useState(0);
  const knownOrderIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const titleTimerRef = useRef(null);

  const stopTitleFlash = useCallback(() => {
    if (titleTimerRef.current) {
      window.clearInterval(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }, []);

  const startTitleFlash = useCallback((count) => {
    if (typeof document === "undefined" || count <= 0) return;
    stopTitleFlash();

    let alertVisible = true;
    document.title = `(${count}) Đơn bếp mới`;
    titleTimerRef.current = window.setInterval(() => {
      document.title = alertVisible
        ? `(${count}) Đơn bếp mới`
        : originalTitleRef.current;
      alertVisible = !alertVisible;
    }, 1000);
  }, [stopTitleFlash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  useEffect(() => {
    if (!enabled) {
      knownOrderIdsRef.current = new Set();
      bootstrappedRef.current = false;
      setNewOrderCount(0);
      stopTitleFlash();
      return;
    }

    const activeOrders = orders.filter((order) => {
      const status = String(order?.kitchenStatus || "").toLowerCase();
      return !["done", "ready", "cancelled", "preorder"].includes(status);
    });
    const currentIds = activeOrders.map(getOrderKey).filter(Boolean);

    if (!bootstrappedRef.current) {
      knownOrderIdsRef.current = new Set(currentIds);
      bootstrappedRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !knownOrderIdsRef.current.has(id));
    knownOrderIdsRef.current = new Set(currentIds);

    if (!newIds.length) return;

    setNewOrderCount((count) => {
      const nextCount = count + newIds.length;
      startTitleFlash(nextCount);
      return nextCount;
    });

    if (soundEnabled) {
      playTone();
      window.setTimeout(playTone, 650);
    }
  }, [enabled, orders, soundEnabled, startTitleFlash, stopTitleFlash]);

  useEffect(() => {
    return () => {
      stopTitleFlash();
    };
  }, [stopTitleFlash]);

  const clearNewOrders = useCallback(() => {
    setNewOrderCount(0);
    stopTitleFlash();
  }, [stopTitleFlash]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((value) => {
      if (!value) playTone();
      return !value;
    });
  }, []);

  return {
    soundEnabled,
    newOrderCount,
    toggleSound,
    clearNewOrders
  };
}
