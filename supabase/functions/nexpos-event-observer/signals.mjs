import { TOPICS, readMetadata } from './policy.mjs';

export const MAX_IDS = 32;
export const DELIVERY_TOPICS = [...TOPICS, 'reconnect'];
export const validOrderId = value => typeof value === 'string'
  && value.length > 0 && value.length <= 128 && !/[\u0000-\u0020\u007f]/.test(value);

export function readSignal(raw, allowedHubs, now = new Date().toISOString()) {
  const metadata = readMetadata(raw, allowedHubs);
  if (!metadata) return null;
  const data = JSON.parse(raw).data;
  // Only this topic's order_ids contract has been verified against live REST.
  const ids = metadata.topic === 'saas_order_status_change' && Array.isArray(data.order_ids)
    && data.order_ids.length > 0 && data.order_ids.length <= MAX_IDS && data.order_ids.every(validOrderId)
    ? [...new Set(data.order_ids)] : [];
  return metadata.hubs.map(hub_id => ({ hub_id, topic: metadata.topic, order_ids: ids, received_at: now }));
}

export function sanitizeSignals(value, allowedHubs) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) return null;
  const result = [];
  for (const signal of value) {
    if (!signal || !allowedHubs.includes(signal.hub_id) || !DELIVERY_TOPICS.includes(signal.topic)) return null;
    const ids = signal.order_ids;
    if (!Array.isArray(ids) || ids.length > MAX_IDS || !ids.every(validOrderId)) return null;
    const time = Date.parse(signal.received_at);
    result.push({ hub_id: signal.hub_id, topic: signal.topic,
      order_ids: signal.topic === 'saas_order_status_change' ? [...new Set(ids)] : [],
      received_at: Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString() });
  }
  return result;
}
