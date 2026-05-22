import { useCallback, useEffect, useRef, useState } from "react";
import tingSound from "../assets/ting.mp3";

const STORAGE_KEY = "ghr_kitchen_sound_enabled";

function getOrderKey(order = {}) {
  return String(
    order?.stableKey ||
      order?.raw?.stable_key ||
      order?.raw?.nexpos_order_id ||
      order?.raw?.display_order_code ||
      order?.displayOrderCode ||
      order?.orderCode ||
      order?.id ||
      ""
  ).trim();
}

export default function useKitchenNewOrderAlert(orders = [], enabled = true) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [newOrderCount, setNewOrderCount] = useState(0);
  const knownOrderIdsRef = useRef(new Set());
  const seenOrderIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const titleTimerRef = useRef(null);
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const unlockingAudioRef = useRef(false);

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

  const unlockAudio = useCallback(async (forceEnable = false) => {
    if (typeof window === "undefined" || !audioRef.current) return false;
    if (unlockingAudioRef.current) return false;

    try {
      unlockingAudioRef.current = true;

      if (forceEnable) {
        setSoundEnabled(true);
        window.localStorage.setItem(STORAGE_KEY, "1");
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.loop = false;
      audioRef.current.volume = 1;
      audioRef.current.muted = false;

      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === "function") {
        await playPromise;
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioUnlockedRef.current = true;
      return true;
    } catch (error) {
      audioUnlockedRef.current = false;
      if (forceEnable) setSoundEnabled(false);
      return false;
    } finally {
      unlockingAudioRef.current = false;
    }
  }, []);

  const playNewOrderSound = useCallback(async () => {
    if (!soundEnabled || !audioRef.current) return;

    try {
      if (!audioUnlockedRef.current) {
        const unlocked = await unlockAudio();
        if (!unlocked) return;
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.loop = false;
      audioRef.current.volume = 1;
      audioRef.current.muted = false;

      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === "function") {
        await playPromise;
      }
    } catch (error) {
      audioUnlockedRef.current = false;
    }
  }, [soundEnabled, unlockAudio]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    audioRef.current = new Audio(tingSound);
    audioRef.current.preload = "auto";
    audioRef.current.playbackRate = 1.08;
    audioRef.current.muted = false;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleFirstUserGesture = () => {
      if (audioUnlockedRef.current) return;
      unlockAudio();
    };

    window.addEventListener("pointerdown", handleFirstUserGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstUserGesture, { passive: true });
    window.addEventListener("keydown", handleFirstUserGesture);

    return () => {
      window.removeEventListener("pointerdown", handleFirstUserGesture);
      window.removeEventListener("touchstart", handleFirstUserGesture);
      window.removeEventListener("keydown", handleFirstUserGesture);
    };
  }, [unlockAudio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  useEffect(() => {
    if (!enabled) {
      knownOrderIdsRef.current = new Set();
      seenOrderIdsRef.current = new Set();
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
      seenOrderIdsRef.current = new Set(currentIds);
      bootstrappedRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seenOrderIdsRef.current.has(id));
    currentIds.forEach((id) => seenOrderIdsRef.current.add(id));
    knownOrderIdsRef.current = new Set(currentIds);

    if (!newIds.length) return;

    setNewOrderCount((count) => {
      const nextCount = count + newIds.length;
      startTitleFlash(nextCount);
      return nextCount;
    });

    if (soundEnabled) {
      playNewOrderSound();
      window.setTimeout(playNewOrderSound, 650);
    }
  }, [enabled, orders, playNewOrderSound, soundEnabled, startTitleFlash, stopTitleFlash]);

  useEffect(() => {
    return () => {
      stopTitleFlash();
    };
  }, [stopTitleFlash]);

  const clearNewOrders = useCallback(() => {
    setNewOrderCount(0);
    stopTitleFlash();
  }, [stopTitleFlash]);

  const toggleSound = useCallback(async () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      audioUnlockedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    await unlockAudio(true);
  }, [soundEnabled, unlockAudio]);

  return {
    soundEnabled,
    newOrderCount,
    toggleSound,
    clearNewOrders
  };
}
