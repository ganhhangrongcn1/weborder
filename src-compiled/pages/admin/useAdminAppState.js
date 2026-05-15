import { isSupabaseConfigSyncEnabled } from "../../services/supabase/runtimeFlags.js";
import useAdminNavigationState from "./state/useAdminNavigationState.js";
import useAdminOrderCrmState from "./state/useAdminOrderCrmState.js";
import useAdminStoreConfigState from "./state/useAdminStoreConfigState.js";
import useAdminUiState from "./state/useAdminUiState.js";
import { useEffect } from "react";

export default function useAdminAppState(orderStorage, routeState = null) {
  const navigationState = useAdminNavigationState();
  const storeConfigState = useAdminStoreConfigState();
  const uiState = useAdminUiState();
  const orderCrmState = useAdminOrderCrmState(orderStorage, {
    section: navigationState.section,
    dashboardDateFrom: uiState.dashboardDateFrom,
    dashboardDateTo: uiState.dashboardDateTo,
    ordersDateFrom: uiState.ordersDateFrom,
    ordersDateTo: uiState.ordersDateTo,
    customersDateFrom: uiState.customersDateFrom,
    customersDateTo: uiState.customersDateTo,
    dashboardChartPreset: uiState.dashboardChartPreset
  });
  const supabaseConfigSyncEnabled = isSupabaseConfigSyncEnabled();

  useEffect(() => {
    if (!routeState) return;
    if (routeState.section) navigationState.setSection(routeState.section);
    if (routeState.activeAdminNav) navigationState.setActiveAdminNav(routeState.activeAdminNav);
    if (routeState.activeSubSection) navigationState.setActiveSubSection(routeState.activeSubSection);
    if (routeState.customerAdminTab) orderCrmState.setCustomerAdminTab(routeState.customerAdminTab);
  }, [routeState]);

  return {
    ...navigationState,
    ...orderCrmState,
    ...storeConfigState,
    ...uiState,
    supabaseConfigSyncEnabled
  };
}
