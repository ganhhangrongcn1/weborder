export const TOPICS = ['saas_print_bill', 'saas_notifications', 'saas_order_status_change'];
export const WORKER_ID = 'vncloud-primary';
export const SOCKET_URL = 'wss://saas-notification.nexpos.io/ws';

export function readMetadata(raw, allowedHubs) {
  if (typeof raw !== 'string' || raw.length > 128 * 1024) return null;
  let payload;
  try { payload = JSON.parse(raw); } catch { return null; }
  const data = payload?.data;
  if (!data || !TOPICS.includes(data.topic)) return null;
  const ids = Array.isArray(data.hub_ids) ? data.hub_ids : [data.hub_id];
  const hubs = [...new Set(ids.filter(id => typeof id === 'string' && allowedHubs.includes(id)))];
  return hubs.length ? { topic: data.topic, hubs } : null;
}

export function sanitizeReport(value, allowedHubs) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = {
    connected: value.connected === true,
    opens: boundedCount(value.opens),
    closes: boundedCount(value.closes),
    messages: boundedCount(value.messages),
    rejected: boundedCount(value.rejected),
    events: {},
    last_event_at: validTime(value.last_event_at),
    last_message_at: validTime(value.last_message_at),
    started_at: validTime(value.started_at)
  };
  for (const hub of allowedHubs) {
    report.events[hub] = {};
    for (const topic of TOPICS) report.events[hub][topic] = boundedCount(value.events?.[hub]?.[topic]);
  }
  return report;
}
function boundedCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
}
function validTime(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
