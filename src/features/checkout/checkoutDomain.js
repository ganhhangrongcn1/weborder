import { getCustomerKey } from "../../services/storageService.js";
import { storeOrigin } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { getDefaultAddress, estimateDistanceKm } from "./checkoutHelpers.js";
import { calculateBaseShippingFeeByConfig } from "../../services/shippingService.js";

function parseBranchLocation(branch) {
  if (!branch) return null;
  const lat = Number(branch.lat);
  const lng = Number(branch.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const rawLocation = String(branch.location || branch.mapLocation || "").trim();
  if (!rawLocation.includes(",")) return null;
  const [locationLat, locationLng] = rawLocation.split(",").map(Number);
  return Number.isFinite(locationLat) && Number.isFinite(locationLng)
    ? { lat: locationLat, lng: locationLng }
    : null;
}

function normalizeBranchMatchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function branchMatchesId(branch, value) {
  const target = normalizeBranchMatchKey(value);
  if (!branch || !target) return false;
  return [
    branch.id,
    branch.dbId,
    branch.branch_code,
    branch.branchCode,
    branch.legacy_id,
    branch.slug,
    branch.name
  ].some((item) => normalizeBranchMatchKey(item) === target);
}

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
  shippingConfig,
  allowDisabledSourceBranch = false
}) {
  const deliveryEligibleBranches = branches.filter((branch) => branch?.shipEnabled !== false);
  const sourceBranches = allowDisabledSourceBranch ? branches.filter(Boolean) : deliveryEligibleBranches;
  const configuredSourceBranchId = String(selectedDeliveryBranchId || shippingConfig.sourceBranchId || "").trim();
  const deliverySourceBranch =
    sourceBranches.find((branch) => branchMatchesId(branch, selectedDeliveryBranchId)) ||
    sourceBranches.find((branch) => branchMatchesId(branch, shippingConfig.sourceBranchId)) ||
    (configuredSourceBranchId ? null : deliveryEligibleBranches[0] || branches[0]) ||
    null;

  const branchOrigin = parseBranchLocation(deliverySourceBranch);
  const deliveryOrigin = branchOrigin || storeOrigin;

  return {
    deliveryEligibleBranches,
    deliverySourceBranch,
    deliveryOrigin,
    deliveryOriginReady: Boolean(branchOrigin),
    deliveryOriginSource: branchOrigin ? "branch" : "fallback"
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
