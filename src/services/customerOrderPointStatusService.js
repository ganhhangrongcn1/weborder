import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { getCustomerKey } from "./storageService.js";

function toText(value = "") {
  return String(value || "").trim();
}

export async function getCustomerOrderPointStatuses(phone = "", options = {}) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) return [];
  return coreSupabaseRepository.getCustomerOrderPointStatuses(phoneKey, options);
}

export function buildCustomerOrderPointStatusMap(rows = []) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const status = toText(row?.point_status || row?.pointStatus).toLowerCase();
    if (!status) return;
    [
      row?.source_order_id,
      row?.sourceOrderId,
      row?.order_code,
      row?.orderCode,
      row?.display_order_code,
      row?.displayOrderCode
    ]
      .map(toText)
      .filter(Boolean)
      .forEach((key) => map.set(key, status));
  });

  return map;
}

export function resolveCustomerOrderPointStatus(statusMap = new Map(), order = {}) {
  const keys = [
    order?.id,
    order?.orderCode,
    order?.order_code,
    order?.displayOrderCode,
    order?.display_order_code,
    order?.partnerOrderId,
    order?.partner_order_id,
    order?.partnerOrderCode,
    order?.partner_order_code
  ]
    .map(toText)
    .filter(Boolean);

  for (const key of keys) {
    const status = toText(statusMap?.get?.(key)).toLowerCase();
    if (status) return status;
  }
  return "";
}

export default {
  getCustomerOrderPointStatuses,
  buildCustomerOrderPointStatusMap,
  resolveCustomerOrderPointStatus
};
