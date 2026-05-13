import { useMemo } from "react";
import { getCurrentRegisteredPhone, initDemoData } from "../../services/customerService.js";
import { addressStorage } from "../../services/addressService.js";
import { orderStorage } from "../../services/orderService.js";
import { loyaltyByPhoneStorage, defaultLoyaltyData } from "../../services/loyaltyService.js";
import { defaultUserDemo } from "../../data/defaultData.js";
import useAppDomainState from "./useAppDomainState.js";
import useCustomerRuntimeState, { getUserStorage } from "./useCustomerRuntimeState.js";

export default function useAppProviders() {
  const userStorage = getUserStorage();
  const isAdminPath = typeof window !== "undefined" && String(window.location.pathname || "").startsWith("/admin");

  const demoData = useMemo(
    () =>
      initDemoData({
        getCurrentRegisteredPhone: () =>
          getCurrentRegisteredPhone({
            userStorage
          }),
        userStorage,
        defaultUserDemo,
        addressStorage,
        loyaltyByPhoneStorage,
        defaultLoyaltyData,
        orderStorage
      }),
    [userStorage]
  );

  const domainState = useAppDomainState();
  const { customerRouteProps } = useCustomerRuntimeState({
    domainState,
    demoData,
    sessionEnabled: !isAdminPath
  });

  return {
    adminAppProps: domainState.adminAppProps,
    customerRouteProps
  };
}
