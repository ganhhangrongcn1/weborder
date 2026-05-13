import useAdminStoreConfigActions from "./actions/useAdminStoreConfigActions.js";
import useAdminOrderCrmActions from "./actions/useAdminOrderCrmActions.js";
import useAdminLoyaltyActions from "./actions/useAdminLoyaltyActions.js";

export default function useAdminAppActions({
  orderStorage,
  setOrdersSnapshot,
  setCrmSnapshot,
  supabaseConfigSyncEnabled,
  zaloConfig,
  setZaloConfig,
  shippingConfig,
  setShippingConfig,
  setOptionGroupPresetsState
}) {
  const storeConfigActions = useAdminStoreConfigActions({
    supabaseConfigSyncEnabled,
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    setOptionGroupPresetsState
  });
  const orderCrmActions = useAdminOrderCrmActions({
    orderStorage,
    setOrdersSnapshot,
    setCrmSnapshot
  });
  const loyaltyActions = useAdminLoyaltyActions({ orderStorage });

  return {
    ...storeConfigActions,
    ...orderCrmActions,
    ...loyaltyActions
  };
}
