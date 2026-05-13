export const STORAGE_KEYS = {
  cartDraft: "ghr_cart",
  currentOrder: "ghr_current_order",
  lastCreatedOrderId: "ghr_last_created_order_id",
  users: "ghr_users",
  currentPhone: "ghr_current_phone",
  currentCustomerPhone: "ghr_current_customer_phone",
  currentCustomerId: "ghr_current_customer_id",
  currentAuthUserId: "ghr_current_auth_user_id",
  ordersByPhone: "ghr_orders_by_phone",
  addressesByPhone: "ghr_addresses_by_phone",
  loyaltyDemo: "ghr_loyalty_demo",
  loyaltyByPhone: "ghr_loyalty_by_phone",
  crmCustomers: "ghr_customers",
  crmLoyalty: "ghr_loyalty",
  shippingConfig: "ghr_shipping_config",
  zaloConfig: "ghr_zalo_config",
  optionGroupPresets: "ghr_option_group_presets",
  legacyOrderStatus: "ghr_order_status",
  legacyUserProfile: "ghr_user_profile"
};

export const LOCAL_ONLY_STORAGE_KEYS = [
  STORAGE_KEYS.cartDraft,
  STORAGE_KEYS.currentOrder,
  STORAGE_KEYS.currentPhone,
  STORAGE_KEYS.loyaltyDemo,
  STORAGE_KEYS.legacyOrderStatus,
  STORAGE_KEYS.legacyUserProfile
];

export const LEGACY_STORAGE_KEYS = [
  "ghr_users_demo",
  "ghr_user_demo",
  STORAGE_KEYS.loyaltyDemo,
  STORAGE_KEYS.legacyOrderStatus,
  STORAGE_KEYS.legacyUserProfile
];

export const CUSTOMER_DATA_STORAGE_KEYS = [
  STORAGE_KEYS.users,
  STORAGE_KEYS.ordersByPhone,
  STORAGE_KEYS.addressesByPhone,
  STORAGE_KEYS.loyaltyByPhone
];

export const ADMIN_CONFIG_STORAGE_KEYS = [
  STORAGE_KEYS.crmCustomers,
  STORAGE_KEYS.crmLoyalty,
  STORAGE_KEYS.shippingConfig,
  STORAGE_KEYS.zaloConfig,
  STORAGE_KEYS.optionGroupPresets
];

export function isCustomerDataStorageKey(key) {
  return CUSTOMER_DATA_STORAGE_KEYS.includes(key);
}
