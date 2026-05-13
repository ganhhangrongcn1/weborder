import { deliveryFee as defaultBaseFee, freeshipMinSubtotal as defaultFreeShipThreshold } from "../constants/storeConfig.js";
import { shippingConfigRepository } from "./repositories/shippingConfigRepository.js";

export const DEFAULT_SHIPPING_CONFIG = {
  baseFeeFirst3Km: defaultBaseFee,
  feePerNextKm: 5000,
  freeShipThreshold: defaultFreeShipThreshold,
  supportShippingEnabled: false,
  maxSupportShipFee: 0,
  customerNote: "",
  maxRadiusKm: 15,
  sourceBranchId: ""
};

function normalizeShippingConfig(config) {
  return {
    ...DEFAULT_SHIPPING_CONFIG,
    ...config,
    baseFeeFirst3Km: Number(config?.baseFeeFirst3Km ?? DEFAULT_SHIPPING_CONFIG.baseFeeFirst3Km),
    feePerNextKm: Number(config?.feePerNextKm ?? DEFAULT_SHIPPING_CONFIG.feePerNextKm),
    freeShipThreshold: Number(config?.freeShipThreshold ?? DEFAULT_SHIPPING_CONFIG.freeShipThreshold),
    supportShippingEnabled: Boolean(config?.supportShippingEnabled),
    maxSupportShipFee: Number(config?.maxSupportShipFee ?? DEFAULT_SHIPPING_CONFIG.maxSupportShipFee),
    maxRadiusKm: Number(config?.maxRadiusKm ?? DEFAULT_SHIPPING_CONFIG.maxRadiusKm),
    customerNote: String(config?.customerNote ?? DEFAULT_SHIPPING_CONFIG.customerNote),
    sourceBranchId: String(config?.sourceBranchId ?? DEFAULT_SHIPPING_CONFIG.sourceBranchId)
  };
}

export function loadShippingConfig() {
  const raw = shippingConfigRepository.get(null);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHIPPING_CONFIG };
  return normalizeShippingConfig(raw);
}

export function saveShippingConfig(config) {
  const next = normalizeShippingConfig(config);
  shippingConfigRepository.set(next);
  return next;
}

export async function loadShippingConfigAsync() {
  const raw = await shippingConfigRepository.getAsync(null);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHIPPING_CONFIG };
  return normalizeShippingConfig(raw);
}

export async function saveShippingConfigAsync(config) {
  const next = normalizeShippingConfig(config);
  await shippingConfigRepository.setAsync(next);
  return next;
}

export async function saveShippingConfigStrictAsync(config) {
  const next = normalizeShippingConfig(config);
  await shippingConfigRepository.setStrictAsync(next);
  return next;
}

export function calculateBaseShippingFeeByConfig(distanceKm, config, fallbackFee = defaultBaseFee) {
  const cfg = config || DEFAULT_SHIPPING_CONFIG;
  const first3KmFee = Number(cfg.baseFeeFirst3Km || fallbackFee);
  const perNextKmFee = Number(cfg.feePerNextKm || 0);
  if (!distanceKm) return first3KmFee;
  if (distanceKm <= 3) return first3KmFee;
  return first3KmFee + Math.ceil(distanceKm - 3) * perNextKmFee;
}
