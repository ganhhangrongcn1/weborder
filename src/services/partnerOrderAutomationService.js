import { adminConfigRepository } from "./repositories/adminConfigRepository.js";

export const PARTNER_ORDER_AUTOMATION_CONFIG_KEY = "ghr_partner_order_automation";

export const DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG = Object.freeze({
  grabAutoPrepEnabled: true,
  grabPrepMinutes: 20
});

function clampPrepMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG.grabPrepMinutes;
  return Math.min(30, Math.max(1, Math.round(minutes)));
}

export function normalizePartnerOrderAutomationConfig(value = {}) {
  const config = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    grabAutoPrepEnabled: config.grabAutoPrepEnabled !== false,
    grabPrepMinutes: clampPrepMinutes(config.grabPrepMinutes)
  };
}

export async function getPartnerOrderAutomationConfig() {
  const saved = await adminConfigRepository.getAsync(
    PARTNER_ORDER_AUTOMATION_CONFIG_KEY,
    DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG
  );
  return normalizePartnerOrderAutomationConfig(saved);
}

export async function savePartnerOrderAutomationConfig(value = {}) {
  const nextConfig = normalizePartnerOrderAutomationConfig(value);
  await adminConfigRepository.setAsync(PARTNER_ORDER_AUTOMATION_CONFIG_KEY, nextConfig);
  return nextConfig;
}
