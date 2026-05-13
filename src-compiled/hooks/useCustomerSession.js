import { useCallback, useEffect, useMemo, useState } from "react";
import { loyaltyRepository } from "../services/repositories/loyaltyRepository.js";
import { getRuntimeStrategy } from "../services/repositories/runtimeStrategy.js";
import { getDataSource } from "../services/repositories/dataSource.js";
import { getSupabaseCustomerSessionSnapshot, logoutCustomerAuthSession } from "../services/supabaseAuthService.js";
import { customerRepository } from "../services/repositories/customerRepository.js";
import { resolveVoucherUsageFromOrders } from "../services/loyaltyService.js";

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

export default function useCustomerSession({
  enabled = true,
  ordersRealtimeEnabled = false,
  forceRefreshOrdersOnTracking = false,
  demoData,
  getCurrentRegisteredPhone,
  normalizeUserProfile,
  userStorage,
  getCustomerKey,
  orderStorage,
  reconcileLoyaltyFromOrders,
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
  const isSupabaseSource = getDataSource() === "supabase";

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
            await userStorage?.hydrateFromRemote?.();
          } catch (_error) {
            // Continue with best-effort local cache.
          }
          const restoredUser = await customerRepository.getUserByPhoneAsync(authSnapshot.phone);
          const hydratedUser = restoredUser ? { ...restoredUser } : null;
          if (!disposed && hydratedUser) {
            restoredPhoneTarget = authSnapshot.phone;
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
        try {
          await userStorage?.hydrateFromRemote?.();
        } catch (_error) {
          // Continue with best-effort local cache.
        }
        const restoredUser = await customerRepository.getUserByPhoneAsync(pointer.phone);
        if (!disposed && restoredUser) {
          restoredPhoneTarget = pointer.phone;
          setRestoreTargetPhone(pointer.phone);
          userStorage.saveCurrentPhone?.(pointer.phone);
          customerRepository.saveSessionPointer({
            phone: pointer.phone,
            customerId: restoredUser.id || pointer.customerId || pointer.phone,
            authUserId: pointer.authUserId || ""
          });
          setCurrentPhoneState(pointer.phone);
          setDemoUserState(restoredUser);
          log("[customer-session] restore from phone pointer");
          return;
        }
      }

      if (!disposed) {
        customerRepository.clearSessionPointer?.();
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
  }, [enabled, isSupabaseSource, userStorage]);

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
    if (!currentPhone) {
      if (!isSessionRestoring) setIsSessionBootstrapping(false);
      return;
    }
    let disposed = false;
    setIsSessionBootstrapping(true);

    async function hydrateAccountDataOnce() {
      try {
        if (userStorage?.hydrateFromRemote) {
          await userStorage.hydrateFromRemote();
        }

        const [remoteOrders, remoteLoyalty, remoteAddresses] = await Promise.all([
          orderStorage?.getByPhoneAsync
            ? withTimeout(orderStorage.getByPhoneAsync(currentPhone), 6000, orderStorage.getByPhone(currentPhone))
            : Promise.resolve(orderStorage.getByPhone(currentPhone)),
          loyaltyRepository?.getByPhoneAsync
            ? loyaltyRepository.getByPhoneAsync(currentPhone, defaultLoyaltyData)
            : Promise.resolve(loyaltyByPhoneStorage.getByPhone(currentPhone)),
          addressStorage?.getByPhoneAsync ? addressStorage.getByPhoneAsync(currentPhone) : Promise.resolve(addressStorage.getAll(currentPhone))
        ]);

        if (disposed) return;

        const latestUser = userStorage.findByPhone(currentPhone);
        if (latestUser) setDemoUserState(latestUser);
        if (Array.isArray(remoteOrders)) setDemoOrdersState(remoteOrders);
        if (remoteLoyalty) {
          const resolvedLoyalty = {
            ...remoteLoyalty,
            voucherHistory: resolveVoucherUsageFromOrders(remoteLoyalty?.voucherHistory || [], remoteOrders || [])
          };
          setDemoLoyaltyState(resolvedLoyalty);
        }
        if (Array.isArray(remoteAddresses)) setDemoAddressesState(remoteAddresses);
      } catch (_error) {
        // Keep local fallback state.
      } finally {
        if (!disposed) setIsSessionBootstrapping(false);
      }
    }

    hydrateAccountDataOnce();

    return () => {
      disposed = true;
    };
  }, [addressStorage, currentPhone, defaultLoyaltyData, enabled, isSessionRestoring, loyaltyByPhoneStorage, orderStorage, userStorage]);

  useEffect(() => {
    if (!enabled) return;
    if (!forceRefreshOrdersOnTracking) {
      setHasFetchedOrdersOnce(true);
      return;
    }
    if (!currentPhone && !isSessionRestoring) {
      setHasFetchedOrdersOnce(true);
    }
  }, [currentPhone, enabled, forceRefreshOrdersOnTracking, isSessionRestoring]);

  useEffect(() => {
    if (!enabled || !ordersRealtimeEnabled || !currentPhone) return undefined;
    const unsubscribe = orderStorage?.subscribeRealtimeByPhone?.(currentPhone, (orders) => {
      if (Array.isArray(orders)) {
        setDemoOrdersState(orders);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [currentPhone, enabled, orderStorage, ordersRealtimeEnabled]);

  useEffect(() => {
    if (!enabled || !forceRefreshOrdersOnTracking || !currentPhone) return;
    let disposed = false;
    setIsOrdersLoading(true);
    (async () => {
      try {
        const remoteOrders = orderStorage?.getByPhoneAsync
          ? await withTimeout(orderStorage.getByPhoneAsync(currentPhone), 6000, orderStorage.getByPhone(currentPhone))
          : orderStorage.getByPhone(currentPhone);
        if (!disposed && Array.isArray(remoteOrders)) {
          setDemoOrdersState(remoteOrders);
        }
      } catch (_error) {
        // Keep current state when refresh fails.
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
  }, [currentPhone, enabled, forceRefreshOrdersOnTracking, orderStorage]);

  // Realtime address sync is disabled in customer runtime to prevent
  // repeated full-table reads and request spam on Account page.

  useEffect(() => {
    if (!enabled) return undefined;
    if (!currentPhone) return undefined;
    const refreshCustomerData = () => {
      const key = getCustomerKey(currentPhone);
      const latestUser = userStorage.findByPhone(key);
      if (latestUser) setDemoUserState(latestUser);
      setDemoOrdersState(orderStorage.getByPhone(key));
      if (getRuntimeStrategy()?.effectiveSource !== "supabase") {
        const reconciled = reconcileLoyaltyFromOrders(key, orderStorage);
        setDemoLoyaltyState({
          ...reconciled,
          voucherHistory: resolveVoucherUsageFromOrders(reconciled?.voucherHistory || [], orderStorage.getByPhone(key) || [])
        });
      } else {
        const remoteFirst = loyaltyByPhoneStorage.getByPhone(key);
        setDemoLoyaltyState({
          ...remoteFirst,
          voucherHistory: resolveVoucherUsageFromOrders(remoteFirst?.voucherHistory || [], orderStorage.getByPhone(key) || [])
        });
      }
      setDemoAddressesState(addressStorage.getAll(key));
    };

    window.addEventListener("ghr:orders-changed", refreshCustomerData);

    return () => {
      window.removeEventListener("ghr:orders-changed", refreshCustomerData);
    };
  }, [addressStorage, currentPhone, defaultLoyaltyData, enabled, getCustomerKey, loyaltyByPhoneStorage, orderStorage, userStorage, reconcileLoyaltyFromOrders]);

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
      setDemoLoyaltyState(currentStored);
      return currentStored;
    }
    const saved = currentPhone ? loyaltyByPhoneStorage.saveByPhone(currentPhone, nextLoyalty) : loyaltyStorage.save(nextLoyalty);
    setDemoLoyaltyState(saved);
    return saved;
  }, [currentPhone, loyaltyByPhoneStorage, loyaltyStorage]);

  const saveDemoOrders = useCallback((nextOrders) => {
    if (!currentPhone) return nextOrders;
    const byPhone = orderStorage.getAllByPhone();
    const savedByPhone = orderStorage.saveAll({ ...byPhone, [getCustomerKey(currentPhone)]: nextOrders });
    const saved = savedByPhone[getCustomerKey(currentPhone)] || [];
    setDemoOrdersState(saved);
    return saved;
  }, [currentPhone, getCustomerKey, orderStorage]);

  function loginOrRegisterByPhone(phone, name = "", passwordDemo = "", shouldRegister = false) {
    const key = getCustomerKey(phone);
    if (!key) return null;
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
      authUserId: ""
    });
    setCurrentPhoneState(key);
    setDemoUserState(user);
    const linkedOrders = orderStorage.getByPhone(key);
    const linkedLoyaltyBase = shouldRegister
      ? reconcileLoyaltyFromOrders(key, orderStorage)
      : loyaltyByPhoneStorage.getByPhone(key);
    const linkedLoyalty = {
      ...linkedLoyaltyBase,
      voucherHistory: resolveVoucherUsageFromOrders(linkedLoyaltyBase?.voucherHistory || [], linkedOrders || [])
    };
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

  const profileOrders = currentPhone ? demoOrders : [];
  const profileLoyalty = currentPhone ? demoLoyalty : defaultLoyaltyData;
  const storedCurrentUser = currentPhone ? userStorage.findByPhone(currentPhone) : null;
  const sessionCurrentUser = currentPhone && getCustomerKey(demoUser?.phone) === currentPhone ? demoUser : null;
  // Runtime source of truth for customer-authenticated experience:
  // if currentPhone exists, user is treated as signed-in customer in UI flows.
  const isRegisteredCustomer = Boolean(currentPhone);
  const memberProfileName = String(storedCurrentUser?.name || "").trim();
  const resolvedName = memberProfileName || "Khách hàng";
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
    activeDemoUser,
    profileOrders,
    profileLoyalty,
    composedUserProfile,
    setDemoOrdersState,
    setDemoLoyaltyState,
    setDemoAddressesState
  };
}
