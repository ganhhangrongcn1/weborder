import { getCustomerKey } from "../../services/storageService.js";
import { storeOrigin } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { getDefaultAddress, estimateDistanceKm } from "./checkoutHelpers.js";
import { calculateBaseShippingFeeByConfig } from "../../services/shippingService.js";

export function getSavedAddressesForPhone(demoAddresses = [], currentPhone = "") {
  if (!currentPhone) return [];
  const phoneKey = getCustomerKey(currentPhone);
  return demoAddresses.filter((address) => getCustomerKey(address.phone) === phoneKey);
}

export function createInitialDeliveryInfo({
  currentPhone,
  demoUser,
  demoAddresses
}) {
  const savedForPhone = getSavedAddressesForPhone(demoAddresses, currentPhone);
  const defaultAddress = currentPhone
    ? getDefaultAddress(savedForPhone.length ? savedForPhone : demoAddresses)
    : null;

  return {
    name: defaultAddress?.receiverName || demoUser?.name || "Khách",
    phone: defaultAddress?.phone || currentPhone || "",
    address: defaultAddress?.address || "",
    lat: defaultAddress?.lat ?? null,
    lng: defaultAddress?.lng ?? null,
    distanceKm: defaultAddress?.distanceKm ?? null,
    deliveryFee: defaultAddress?.deliveryFee ?? null,
    shippingStatus: defaultAddress?.deliveryFee ? "OK" : "NEED_CONFIRM",
    saveToAccount: false
  };
}

export function resolveDeliveryContext({
  branches = [],
  selectedDeliveryBranchId,
  shippingConfig
}) {
  const deliveryEligibleBranches = branches.filter((branch) => branch?.shipEnabled !== false);
  const deliverySourceBranch =
    deliveryEligibleBranches.find((branch) => branch.id === selectedDeliveryBranchId) ||
    deliveryEligibleBranches.find((branch) => branch.id === shippingConfig.sourceBranchId) ||
    deliveryEligibleBranches[0] ||
    branches[0] ||
    null;

  const deliveryOrigin = deliverySourceBranch?.lat && deliverySourceBranch?.lng
    ? { lat: Number(deliverySourceBranch.lat), lng: Number(deliverySourceBranch.lng) }
    : storeOrigin;

  return {
    deliveryEligibleBranches,
    deliverySourceBranch,
    deliveryOrigin
  };
}

export function resolvePickupBranches(branches = []) {
  const mappedBranches = Array.isArray(branches) && branches.length
    ? branches
      .filter((branch) => branch?.pickupEnabled !== false)
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        time: branch.time || "Đang mở"
      }))
    : defaultPickupBranches;

  return mappedBranches.filter(Boolean);
}

export function buildDeliveryInfoFromAddress({
  address,
  shippingConfig,
  deliveryFee
}) {
  const distance = address.distanceKm || estimateDistanceKm(address.address);
  const recalculatedDeliveryFee = calculateBaseShippingFeeByConfig(distance, shippingConfig, deliveryFee);

  return {
    nextInfo: {
      name: address.receiverName,
      phone: address.phone,
      address: address.address,
      lat: address.lat,
      lng: address.lng,
      distanceKm: distance,
      deliveryFee: recalculatedDeliveryFee,
      shippingStatus: "OK",
      saveToAccount: false
    },
    distanceKm: distance,
    recalculatedDeliveryFee
  };
}

export function normalizeDeliveryInfoOnSave({
  nextInfo,
  shippingConfig,
  deliveryFee
}) {
  const nextDistance = nextInfo.distanceKm || estimateDistanceKm(nextInfo.address);
  const recalculatedDeliveryFee = calculateBaseShippingFeeByConfig(nextDistance, shippingConfig, deliveryFee);
  return {
    normalizedInfo: {
      ...nextInfo,
      distanceKm: nextDistance,
      deliveryFee: recalculatedDeliveryFee
    },
    nextDistance,
    recalculatedDeliveryFee
  };
}
