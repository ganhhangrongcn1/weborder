import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMemberLoyaltySnapshot,
  getStoredMemberLoyaltySnapshot
} from "../services/memberLoyaltySnapshotService.js";
import { getDataSource } from "../services/repositories/dataSource.js";
import { getSupabaseCustomerSessionSnapshot, logoutCustomerAuthSession, syncAuthProfileToCustomerRow } from "../services/supabaseAuthService.js";
import { customerRepository } from "../services/repositories/customerRepository.js";

const CUSTOMER_TRACKING_INITIAL_LIMIT = 5;

async function withTimeout(promise, timeoutMs, fallbackValue) {
  let timeoutId = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isPlaceholderName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || normalized === "khách" || normalized === "khách hàng" || normalized === "khach" || normalized === "khach hang";
}

function buildRestoredSessionUser(defaultUserDemo, phone, fallback = {}) {
  const normalizedName = String(fallback?.name || fallback?.fullName || fallback?.displayName || "").trim();
  const fallbackName = String(defaultUserDemo?.name || "").trim();
  const resolvedName = isPlaceholderName(normalizedName)
    ? ""
    : normalizedName || (isPlaceholderName(fallbackName) ? "" : fallbackName);
  return {
    ...defaultUserDemo,
    ...fallback,
    phone,
    name: resolvedName,
    registered: true
  };
}

export default function useCustomerSession({
  enabled = true,
  ordersRealtimeEnabled = false,
  guestOrderPhone = "",
  forceRefreshOrdersOnTracking = false,
  demoData,
  getCurrentRegisteredPhone,
  normalizeUserProfile,
  userStorage,
  getCustomerKey,
  orderStorage,
  loyaltyByPhoneStorage,
  loyaltyStorage,
  addressStorage,
  setCurrentOrder,
  defaultUserDemo,
  defaultLoyaltyData,
  navigate,
  userProfile,
  getOrderStats,
  getMemberRank
}) {
  const [demoUser, setDemoUserState] = useState(demoData.user);
  const [demoAddresses, setDemoAddressesState] = useState(demoData.addresses);
  const [demoLoyalty, setDemoLoyaltyState] = useState(demoData.loyalty);
  const [demoOrders, setDemoOrdersState] = useState(demoData.orders);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [hasFetchedOrdersOnce, setHasFetchedOrdersOnce] = useState(false);
  const [isSessionRestoring, setIsSessionRestoring] = useState(true);
  const [isSessionBootstrapping, setIsSessionBootstrapping] = useState(true);
  const [restoreTargetPhone, setRestoreTargetPhone] = useState("");
  const [currentPhone, setCurrentPhoneState] = useState(() => getCurrentRegisteredPhone());
  const [hasCustomerAuthSession, setHasCustomerAuthSession] = useState(false);
  const isSupabaseSource = getDataSource() === "supabase";
  const canLoadProtectedCustomerData = Boolean(
    currentPhone && (!isSupabaseSource || hasCustomerAuthSession)
  );
  const orderLookupPhone = canLoadProtectedCustomerData
    ? currentPhone
    : (!isSupabaseSource ? getCustomerKey(guestOrderPhone) : "");

  useEffect(() => {
    setHasFetchedOrdersOnce(false);
  }, [currentPhone]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    setIsSessionRestoring(true);
    setIsSessionBootstrapping(true);
    setRestoreTargetPhone("");

    async function restoreCustomerSession() {
      let restoredPhoneTarget = "";
      const log = (...args) => {
        if (import.meta?.env?.DEV) console.info(...args);
      };

      if (isSupabaseSource) {
        const authSnapshot = await getSupabaseCustomerSessionSnapshot();
        if (authSnapshot?.ok && authSnapshot.phone) {
          try {
            await syncAuthProfileToCustomerRow();
          } catch {
          }
          const restoredUser = await customerRepository.getUserByPhoneAsync(authSnapshot.phone);
          const hydratedUser = restoredUser
            ? { ...restoredUser }
            : buildRestoredSessionUser(defaultUserDemo, authSnapshot.phone, {
                name: authSnapshot.name,
                email: authSnapshot.email || "",
                authUserId: authSnapshot.authUserId || ""
              });
          if (!disposed && hydratedUser) {
            restoredPhoneTarget = authSnapshot.phone;
            setHasCustomerAuthSession(true);
            setRestoreTargetPhone(authSnapshot.phone);
            userStorage.saveCurrentPhone?.(authSnapshot.phone);
            customerRepository.saveSessionPointer({
              phone: authSnapshot.phone,
              customerId: hydratedUser.id || authSnapshot.phone,
              authUserId: authSnapshot.authUserId || ""
            });
            setCurrentPhoneState(authSnapshot.phone);
            setDemoUserState(hydratedUser);
            log("[customer-session] restore from supabase auth");
            return;
          }
        }
      }

      const pointer = customerRepository.getSessionPointer?.() || {};
      if (pointer?.phone) {
        const restoredUser = await customerRepository.getUserByPhoneAsync(pointer.phone);
        const hydratedUser = restoredUser || (isSupabaseSource ? buildRestoredSessionUser(defaultUserDemo, pointer.phone) : null);
        if (!disposed && hydratedUser) {
          restoredPhoneTarget = pointer.phone;
          setHasCustomerAuthSession(false);
          setRestoreTargetPhone(pointer.phone);
          userStorage.saveCurrentPhone?.(pointer.phone);
          customerRepository.saveSessionPointer({
            phone: pointer.phone,
            customerId: hydratedUser.id || pointer.customerId || pointer.phone,
            authUserId: pointer.authUserId || ""
          });
          setCurrentPhoneState(pointer.phone);
          setDemoUserState(hydratedUser);
          log("[customer-session] restore from phone pointer");
          return;
        }
      }

      if (!disposed) {
        customerRepository.clearSessionPointer?.();
        setHasCustomerAuthSession(false);
        setCurrentPhoneState("");
        setRestoreTargetPhone("");
        restoredPhoneTarget = "";
        log("[customer-session] restore failed, show lookup/login");
      }
      return restoredPhoneTarget;
    }

    withTimeout(restoreCustomerSession(), 4000, "").then((targetPhone) => {
      if (disposed) return;
      setIsSessionRestoring(false);
      if (!targetPhone) {
        setIsSessionBootstrapping(false);
      }
    });
    return () => {
      disposed = true;
    };
  }, [defaultUserDemo, enabled, isSupabaseSource, userStorage]);

  useEffect(() => {
    if (!enabled) return;
    if (!isSessionRestoring) return;
    if (!restoreTargetPhone) return;
    const current = getCustomerKey(currentPhone);
    const target = getCustomerKey(restoreTargetPhone);
    if (current && target && current === target) {
      setIsSessionRestoring(false);
      setRestoreTargetPhone("");
    }
  }, [currentPhone, enabled, getCustomerKey, isSessionRestoring, restoreTargetPhone]);

  useEffect(() => {
    if (!enabled) return;
    if (!canLoadProtectedCustomerData) {
      if (!isSessionRestoring) setIsSessionBootstrapping(false);
      return;
    }
    if (isSessionRestoring) return;
    let disposed = false;
    setIsSessionBootstrapping(true);

    async function hydrateAccountDataOnce() {
      try {
        const [remoteUser, remoteOrders, remoteAddresses] = await Promise.all([
          customerRepository.getUserByPhoneAsync(currentPhone),
          orderStorage?.getByPhoneAsync
            ? withTimeout(
                orderStorage.getByPhoneAsync(currentPhone, { limit: CUSTOMER_TRACKING_INITIAL_LIMIT }),
                6000,
                orderStorage.getByPhone(currentPhone).slice(0, CUSTOMER_TRACKING_INITIAL_LIMIT)
              )
            : Promise.resolve(orderStorage.getByPhone(currentPhone)),
          addressStorage?.getByPhoneAsync ? addressStorage.getByPhoneAsync(currentPhone) : Promise.resolve(addressStorage.getAll(currentPhone))
        ]);
        const remoteLoyalty = await getMemberLoyaltySnapshot(currentPhone, {
          orders: remoteOrders,
          fallback: defaultLoyaltyData
        });

        if (disposed) return;

        const latestUser = remoteUser || userStorage.findByPhone(currentPhone);
        if (latestUser) setDemoUserState(latestUser);
        if (Array.isArray(remoteOrders)) setDemoOrdersState(remoteOrders);
        if (remoteLoyalty) setDemoLoyaltyState(remoteLoyalty);
        if (Array.isArray(remoteAddresses)) setDemoAddressesState(remoteAddresses);
      } catch {
      } finally {
        if (!disposed) setIsSessionBootstrapping(false);
      }
    }

    hydrateAccountDataOnce();

    return () => {
      disposed = true;
    };
  }, [addressStorage, canLoadProtectedCustomerData, currentPhone, defaultLoyaltyData, enabled, isSessionRestoring, orderStorage, userStorage]);

  useEffect(() => {
    if (!enabled) return;
    if (!forceRefreshOrdersOnTracking) {
      setHasFetchedOrdersOnce(true);
      return;
    }
    if (!orderLookupPhone && !isSessionRestoring) {
      setHasFetchedOrdersOnce(true);
    }
  }, [enabled, forceRefreshOrdersOnTracking, isSessionRestoring, orderLookupPhone]);

  useEffect(() => {
    if (!enabled || !ordersRealtimeEnabled || !orderLookupPhone) return undefined;
    const unsubscribe = orderStorage?.subscribeRealtimeByPhone?.(orderLookupPhone, (orders) => {
      if (Array.isArray(orders)) {
        setDemoOrdersState(orders);
        if (orders[0]) setCurrentOrder(orders[0]);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [enabled, orderLookupPhone, orderStorage, ordersRealtimeEnabled]);

  useEffect(() => {
    if (!enabled || currentPhone || !orderLookupPhone) return;
    let disposed = false;
    (async () => {
      try {
        const remoteOrders = orderStorage?.getByPhoneAsync
          ? await withTimeout(
              orderStorage.getByPhoneAsync(orderLookupPhone, { limit: CUSTOMER_TRACKING_INITIAL_LIMIT }),
              6000,
              orderStorage.getByPhone(orderLookupPhone).slice(0, CUSTOMER_TRACKING_INITIAL_LIMIT)
            )
          : orderStorage.getByPhone(orderLookupPhone);
        if (!disposed && Array.isArray(remoteOrders)) {
          setDemoOrdersState(remoteOrders);
          if (remoteOrders[0]) setCurrentOrder(remoteOrders[0]);
        }
      } catch {
      }
    })();
    return () => {
      disposed = true;
    };
  }, [currentPhone, enabled, orderLookupPhone, orderStorage]);

  useEffect(() => {
    if (!enabled || !forceRefreshOrdersOnTracking || !orderLookupPhone) return;
    let disposed = false;
    setIsOrdersLoading(true);
    (async () => {
      try {
        const remoteOrders = orderStorage?.getByPhoneAsync
          ? await withTimeout(
              orderStorage.getByPhoneAsync(orderLookupPhone, { limit: CUSTOMER_TRACKING_INITIAL_LIMIT }),
              6000,
              orderStorage.getByPhone(orderLookupPhone).slice(0, CUSTOMER_TRACKING_INITIAL_LIMIT)
            )
          : orderStorage.getByPhone(orderLookupPhone);
        if (!disposed && Array.isArray(remoteOrders)) {
          setDemoOrdersState(remoteOrders);
          if (remoteOrders[0]) setCurrentOrder(remoteOrders[0]);
        }
      } catch {
      } finally {
        if (!disposed) {
          setIsOrdersLoading(false);
          setHasFetchedOrdersOnce(true);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [enabled, forceRefreshOrdersOnTracking, orderLookupPhone, orderStorage]);

  // Realtime address sync is disabled in customer runtime to prevent
  // repeated full-table reads and request spam on Account page.

  useEffect(() => {
    if (!enabled) return undefined;
    if (!canLoadProtectedCustomerData) return undefined;
    let refreshTimer = null;

    const refreshCustomerData = () => {
      const key = getCustomerKey(currentPhone);
      const latestUser = userStorage.findByPhone(key);
      const localOrders = orderStorage.getByPhone(key) || [];
      if (latestUser) setDemoUserState(latestUser);
      setDemoOrdersState(localOrders);
      setDemoLoyaltyState(
        getStoredMemberLoyaltySnapshot(key, {
          orders: localOrders,
          fallback: defaultLoyaltyData
        })
      );
      setDemoAddressesState(addressStorage.getAll(key));
    };

    const scheduleRefreshCustomerData = (event) => {
      const key = getCustomerKey(currentPhone);
      const changedPhones = Array.isArray(event?.detail?.changedPhones)
        ? event.detail.changedPhones.map((phone) => getCustomerKey(phone)).filter(Boolean)
        : [];
      if (changedPhones.length && !changedPhones.includes(key)) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshCustomerData();
      }, 120);
    };

    window.addEventListener("ghr:orders-changed", scheduleRefreshCustomerData);

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      window.removeEventListener("ghr:orders-changed", scheduleRefreshCustomerData);
    };
  }, [addressStorage, canLoadProtectedCustomerData, currentPhone, defaultLoyaltyData, enabled, getCustomerKey, orderStorage, userStorage]);

  const saveDemoUser = useCallback((nextUser) => {
    const saved = userStorage.upsertUser(nextUser);
    setDemoUserState(saved);
    return saved;
  }, [userStorage]);

  const saveDemoAddresses = useCallback((nextAddresses) => {
    const saved = currentPhone ? addressStorage.saveAll(nextAddresses, currentPhone) : nextAddresses;
    setDemoAddressesState(saved);
    return saved;
  }, [addressStorage, currentPhone]);

  const saveDemoLoyalty = useCallback((nextLoyalty) => {
    const currentStored = currentPhone ? loyaltyByPhoneStorage.getByPhone(currentPhone) : loyaltyStorage.get();
    const hasChanged = JSON.stringify(currentStored || {}) !== JSON.stringify(nextLoyalty || {});
    if (!hasChanged) {
      const currentOrders = currentPhone ? orderStorage.getByPhone(currentPhone) : [];
      const snapshot = getStoredMemberLoyaltySnapshot(currentPhone, {
        orders: currentOrders,
        fallback: currentStored
      });
      setDemoLoyaltyState(snapshot);
      return snapshot;
    }
    const saved = currentPhone ? loyaltyByPhoneStorage.saveByPhone(currentPhone, nextLoyalty) : loyaltyStorage.save(nextLoyalty);
    const currentOrders = currentPhone ? orderStorage.getByPhone(currentPhone) : [];
    const snapshot = getStoredMemberLoyaltySnapshot(currentPhone, {
      orders: currentOrders,
      fallback: saved
    });
    setDemoLoyaltyState(snapshot);
    return snapshot;
  }, [currentPhone, loyaltyByPhoneStorage, loyaltyStorage, orderStorage]);

  const saveDemoOrders = useCallback((nextOrders) => {
    if (!currentPhone) return nextOrders;
    const byPhone = orderStorage.getAllByPhone();
    const savedByPhone = orderStorage.saveAll({ ...byPhone, [getCustomerKey(currentPhone)]: nextOrders });
    const saved = savedByPhone[getCustomerKey(currentPhone)] || [];
    setDemoOrdersState(saved);
    return saved;
  }, [currentPhone, getCustomerKey, orderStorage]);

  function loginOrRegisterByPhone(phone, name = "", passwordDemo = "", shouldRegister = false, options = {}) {
    const key = getCustomerKey(phone);
    if (!key) return null;
    const authUserId = String(options?.authUserId || "").trim();
    const nextHasCustomerAuthSession = Boolean(options?.hasCustomerAuthSession);
    const existing = userStorage.findByPhone(key);
    const isRegistered = Boolean(existing?.registered || existing?.passwordDemo);
    if (!shouldRegister && !isRegistered && !isSupabaseSource) return null;
    const user = shouldRegister
      ? userStorage.upsertUser({
          ...existing,
          phone: key,
          name: name || existing?.name || "",
          passwordDemo: passwordDemo || existing?.passwordDemo || "",
          registered: true
        })
      : (existing || userStorage.upsertUser({
          ...defaultUserDemo,
          phone: key,
          name: name || existing?.name || "",
          registered: true
        }));
    userStorage.saveCurrentPhone?.(key);
    customerRepository.saveSessionPointer?.({
      phone: key,
      customerId: user?.id || key,
      authUserId
    });
    setHasCustomerAuthSession(nextHasCustomerAuthSession);
    setCurrentPhoneState(key);
    setDemoUserState(user);
    const linkedOrders = orderStorage.getByPhone(key);
    const linkedLoyalty = getStoredMemberLoyaltySnapshot(key, {
      orders: linkedOrders,
      fallback: loyaltyByPhoneStorage.getByPhone(key)
    });
    const linkedAddresses = addressStorage.getAll(key);
    setDemoOrdersState(linkedOrders);
    setDemoLoyaltyState(linkedLoyalty);
    setDemoAddressesState(linkedAddresses);
    setCurrentOrder(null);
    return { user, linkedOrders, linkedLoyalty, linkedAddresses, isNew: !existing };
  }

  async function logoutDemoUser() {
    userStorage.clearCurrentPhone?.();
    customerRepository.clearSessionPointer?.();
    setHasCustomerAuthSession(false);
    setCurrentPhoneState("");
    setRestoreTargetPhone("");
    setIsSessionRestoring(false);
    setIsSessionBootstrapping(false);
    setDemoUserState(defaultUserDemo);
    setDemoLoyaltyState(defaultLoyaltyData);
    setDemoOrdersState([]);
    setDemoAddressesState([]);
    setCurrentOrder(null);
    navigate("account", "account");
    if (isSupabaseSource) {
      logoutCustomerAuthSession().catch(() => {
        // Ignore background logout error to keep instant UX.
      });
    }
  }

  const profileOrders = orderLookupPhone ? demoOrders : [];
  const profileLoyalty = currentPhone ? demoLoyalty : defaultLoyaltyData;
  const storedCurrentUser = currentPhone ? userStorage.findByPhone(currentPhone) : null;
  const sessionCurrentUser = currentPhone && getCustomerKey(demoUser?.phone) === currentPhone ? demoUser : null;
  // Runtime source of truth for member UI context:
  // currentPhone means the app knows which member data to load.
  // Protected RPC actions must additionally require hasCustomerAuthSession.
  const isRegisteredCustomer = Boolean(currentPhone);
  const memberProfileName = String(storedCurrentUser?.name || "").trim();
  const sessionProfileName = String(sessionCurrentUser?.name || "").trim();
  const resolvedName = [memberProfileName, sessionProfileName]
    .map((value) => String(value || "").trim())
    .find((value) => !isPlaceholderName(value)) || "";
  const activeDemoUser = currentPhone
    ? {
        ...defaultUserDemo,
        ...(sessionCurrentUser || {}),
        ...(storedCurrentUser || {}),
        phone: currentPhone,
        name: resolvedName
      }
    : defaultUserDemo;

  const composedUserProfile = useMemo(() => {
    const orderStats = getOrderStats(profileOrders);
    return normalizeUserProfile({
      ...userProfile,
      name: activeDemoUser.name,
      email: "",
      phone: activeDemoUser.phone,
      points: profileLoyalty.totalPoints,
      totalOrders: orderStats.totalOrders,
      totalSpent: orderStats.totalSpent,
      memberRank: getMemberRank(orderStats.totalSpent),
      addresses: demoAddresses.map((address) => ({ id: address.id, title: address.label, detail: address.address, active: address.isDefault })),
      orderHistory: profileOrders,
      pointHistory: profileLoyalty.pointHistory || userProfile.pointHistory,
      checkinStreak: profileLoyalty.checkinStreak
    });
  }, [activeDemoUser.name, activeDemoUser.phone, demoAddresses, getMemberRank, getOrderStats, normalizeUserProfile, profileLoyalty, profileOrders, userProfile]);

  return {
    currentPhone,
    demoUser,
    demoAddresses,
    demoLoyalty,
    demoOrders,
    isOrdersLoading,
    hasFetchedOrdersOnce,
    isSessionRestoring,
    isSessionBootstrapping,
    saveDemoUser,
    saveDemoAddresses,
    saveDemoLoyalty,
    saveDemoOrders,
    loginOrRegisterByPhone,
    logoutDemoUser,
    isRegisteredCustomer,
    hasCustomerAuthSession,
    requiresCustomerAuthSession: isSupabaseSource,
    activeDemoUser,
    profileOrders,
    profileLoyalty,
    composedUserProfile,
    setDemoOrdersState,
    setDemoLoyaltyState,
    setDemoAddressesState
  };
}
