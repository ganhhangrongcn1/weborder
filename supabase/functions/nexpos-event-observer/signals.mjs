import { TOPICS, readMetadata } from './policy.mjs';

export const MAX_IDS = 32;
export const DELIVERY_TOPICS = [...TOPICS, 'reconnect'];
export const ID_TOPICS = ['saas_order_status_change', 'saas_notifications', 'saas_print_bill'];
export const validOrderId = value => typeof value === 'string'
  && value.length > 0 && value.length <= 128 && !/[\u0000-\u0020\u007f]/.test(value);

export function readSignal(raw, allowedHubs, now = new Date().toISOString()) {
  const metadata = readMetadata(raw, allowedHubs);
  if (!metadata) return null;
  const data = JSON.parse(raw).data;
  // Exact fields verified against live REST + HUB + DB (GF-222, 02/11).
  // A print notification invalidates the snapshot; it never requests printing.
  const candidates = metadata.topic === 'saas_print_bill' ? [data.order_id] : data.order_ids;
  const ids = Array.isArray(candidates) && candidates.length > 0
    && candidates.length <= MAX_IDS && candidates.every(validOrderId)
    ? [...new Set(candidates)] : [];
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
      order_ids: ID_TOPICS.includes(signal.topic) ? [...new Set(ids)] : [],
      received_at: Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString() });
  }
  return result;
}
