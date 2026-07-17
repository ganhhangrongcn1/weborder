import { getCustomerKey } from "../../services/storageService.js";
import { storeOrigin } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { getDefaultAddress, estimateDistanceKm } from "./checkoutHelpers.js";
import { calculateBaseShippingFeeByConfig } from "../../services/shippingService.js";
import { resolveBranchFromCandidates, resolveOrderBranch } from "../../services/branchIdentityService.js";

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
    branch.branch_uuid,
    branch.branchUuid,
    branch.uuid,
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
  demoAddresses,
  initialDeliveryInfo = null
}) {
  const savedForPhone = getSavedAddressesForPhone(demoAddresses, currentPhone);
  const defaultAddress = currentPhone
    ? getDefaultAddress(savedForPhone.length ? savedForPhone : demoAddresses)
    : null;

  const defaultInfo = {
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

  if (!String(initialDeliveryInfo?.address || "").trim()) return defaultInfo;
  return {
    ...defaultInfo,
    ...initialDeliveryInfo,
    shippingStatus: "NEED_CONFIRM",
    saveToAccount: false
  };
}

function getQrBranchKeyFromPath(pathname = "") {
  const match = String(pathname || "").match(/^\/qr\/([^/]+)(?:\/|$)/i);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1] || "").trim();
  } catch {
    return String(match[1] || "").trim();
  }
}

function isQrCounterOrder(order = {}) {
  const source = String(
    order?.orderSource || order?.order_source || order?.source || order?.channel || order?.platform || ""
  ).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return ["qrcounter", "qrorder", "qrtaiquay", "customerqr"].includes(source);
}

function buildReorderDeliveryInfo(order = {}) {
  const address = String(order?.deliveryAddress || order?.delivery_address || "").trim();
  if (!address || address.toLowerCase() === "khách tự đến lấy") return null;
  return {
    name: String(order?.customerName || order?.orderCustomerName || "").trim(),
    phone: String(order?.customerPhone || order?.rawCustomerPhone || order?.phone || "").trim(),
    address,
    lat: order?.lat ?? null,
    lng: order?.lng ?? null,
    distanceKm: order?.distanceKm ?? order?.distance_km ?? null,
    deliveryFee: null
  };
}

export function buildReorderCheckoutPreset({ order = {}, branches = [], pathname = "" }) {
  const branchList = Array.isArray(branches) ? branches.filter(Boolean) : [];
  const pickupBranches = branchList.filter((branch) => branch?.pickupEnabled !== false);
  const qrBranchKey = getQrBranchKeyFromPath(pathname);
  const qrRouteBranch = qrBranchKey
    ? resolveBranchFromCandidates([qrBranchKey], pickupBranches)
    : null;

  if (qrRouteBranch) {
    return {
      branchUnavailable: false,
      preset: {
        fulfillmentType: "pickup",
        selectedBranch: qrRouteBranch.id,
        selectedDeliveryBranch: "",
        pickupMode: "soon",
        orderSource: "qr_counter",
        source: "qr_counter",
        qrBranchId: String(qrRouteBranch.branch_code || qrRouteBranch.branchCode || qrRouteBranch.id || ""),
        qrBranchLocked: true,
        qrAutoPickupNow: true,
        reorderDeliveryInfo: null
      }
    };
  }

  const fulfillmentType = String(order?.fulfillmentType || order?.fulfillment_type || "").toLowerCase() === "pickup" || isQrCounterOrder(order)
    ? "pickup"
    : "delivery";
  const eligibleBranches = fulfillmentType === "pickup"
    ? pickupBranches
    : branchList.filter((branch) => branch?.shipEnabled !== false);
  const matchedBranch = resolveOrderBranch(order, eligibleBranches);
  const selectedBranchId = String(matchedBranch?.id || "");

  return {
    branchUnavailable: branchList.length > 0 && !matchedBranch,
    preset: {
      fulfillmentType,
      selectedBranch: fulfillmentType === "pickup" ? selectedBranchId : "",
      selectedDeliveryBranch: fulfillmentType === "delivery" ? selectedBranchId : "",
      pickupMode: "soon",
      orderSource: "online",
      source: "online",
      qrBranchId: "",
      qrBranchLocked: false,
      qrAutoPickupNow: false,
      reorderDeliveryInfo: fulfillmentType === "delivery" ? buildReorderDeliveryInfo(order) : null
    }
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
        ...branch,
        id: branch.id,
        name: branch.name,
        address: branch.address,
        branchUuid: branch.branchUuid || branch.branch_uuid || branch.uuid || "",
        branch_uuid: branch.branch_uuid || branch.branchUuid || branch.uuid || "",
        branchCode: branch.branchCode || branch.branch_code || "",
        branch_code: branch.branch_code || branch.branchCode || "",
        legacy_id: branch.legacy_id || branch.legacyId || "",
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
