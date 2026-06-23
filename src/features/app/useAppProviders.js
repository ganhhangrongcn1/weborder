import { useMemo } from "react";
import { getCurrentRegisteredPhone, initDemoData } from "../../services/customerService.js";
import { addressStorage } from "../../services/addressService.js";
import { orderStorage } from "../../services/orderService.js";
import { loyaltyByPhoneStorage, defaultLoyaltyData } from "../../services/loyaltyService.js";
import { defaultUserDemo } from "../../data/defaultData.js";
import useAppDomainState from "./useAppDomainState.js";
import useCustomerRuntimeState, { getUserStorage } from "./useCustomerRuntimeState.js";

function isCustomerRuntimePath(pathname = "") {
  const path = String(pathname || "").trim().toLowerCase();
  if (!path) return true;

  return (
    path === "/" ||
    path === "/home" ||
    path === "/menu" ||
    path === "/cart" ||
    path === "/checkout" ||
    path === "/success" ||
    path === "/profile" ||
    path === "/orders" ||
    path === "/loyalty" ||
    path.startsWith("/qr/")
  );
}

export default function useAppProviders() {
  const userStorage = getUserStorage();
  const currentPathname = typeof window !== "undefined" ? String(window.location.pathname || "") : "/";
  const customerRuntimeEnabled = isCustomerRuntimePath(currentPathname);

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
    sessionEnabled: customerRuntimeEnabled
  });

  return {
    adminAppProps: domainState.adminAppProps,
    customerRouteProps
  };
}
