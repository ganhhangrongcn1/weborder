// Protocol observed in portal-index-EVJvLL0n.js on 2026-10-04.
export const NEXPOS_SOCKET_URL = "wss://saas-notification.nexpos.io/ws";
export const NEXPOS_TOPICS = "saas_print_bill, saas_notifications, saas_order_status_change";
const ALLOWED_TOPICS = new Set(NEXPOS_TOPICS.split(", "));

export function readEventMetadata(raw, hubId) {
  if (typeof raw !== "string" || raw.length > 128 * 1024) return null;
  try {
    const event = JSON.parse(raw);
    const data = event?.data;
    if (!data || !ALLOWED_TOPICS.has(data.topic)) return null;
    const hubs = Array.isArray(data.hub_ids) ? data.hub_ids : [];
    if (data.hub_id !== hubId && !hubs.includes(hubId)) return null;
    return { topic: data.topic };
  } catch {
    return null;
  }
}

// This engine only counts scoped events. It cannot sync orders or print bills.
// The deployment layer must acquire a distributed lease before starting it.
export default function observeNexpos({
  accessToken,
  hubId,
  durationMs = 240000,
  signal,
  socketFactory = (url) => new globalThis.WebSocket(url),
  timers = globalThis
}) {
  if (!accessToken || !hubId) throw new Error("missing_observer_credentials_or_hub");
  if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 240000) {
    throw new Error("invalid_observation_duration");
  }
  return new Promise((resolve) => {
    const summary = { connections: 0, errors: 0, ignored: 0, events: {}, reason: "duration" };
    let socket = null;
    let finished = false;
    let heartbeat = null;
    let reconnect = null;
    let deadline = null;
    let failures = 0;

    const finish = (reason) => {
      if (finished) return;
      finished = true;
      summary.reason = reason;
      timers.clearTimeout(deadline);
      timers.clearTimeout(reconnect);
      timers.clearInterval(heartbeat);
      signal?.removeEventListener("abort", abort);
      try { socket?.close(); } catch { /* Do not log credentials or payloads. */ }
      resolve(summary);
    };
    const abort = () => finish("aborted");
    const scheduleReconnect = () => {
      if (finished || reconnect !== null) return;
      failures += 1;
      reconnect = timers.setTimeout(() => {
        reconnect = null;
        connect();
      }, Math.min(30000, 3000 * 2 ** Math.min(failures - 1, 4)));
    };
    const connect = () => {
      if (finished) return;
      let current;
      try {
        current = socketFactory(NEXPOS_SOCKET_URL);
        socket = current;
      } catch {
        summary.errors += 1;
        scheduleReconnect();
        return;
      }
      current.addEventListener("open", () => {
        if (finished || current !== socket) return;
        summary.connections += 1;
        try {
          current.send(JSON.stringify({ access_token: accessToken, topic: NEXPOS_TOPICS }));
          timers.clearInterval(heartbeat);
          heartbeat = timers.setInterval(() => {
            if (finished || current !== socket || current.readyState !== 1) return;
            try { current.send(JSON.stringify({ type: "ping" })); }
            catch { current.close(); }
          }, 30000);
        } catch {
          summary.errors += 1;
          finish("handshake_send_failed");
        }
      });
      current.addEventListener("message", (event) => {
        if (finished || current !== socket) return;
        const metadata = readEventMetadata(event.data, hubId);
        if (!metadata) { summary.ignored += 1; return; }
        failures = 0;
        summary.events[metadata.topic] = (summary.events[metadata.topic] || 0) + 1;
      });
      current.addEventListener("error", () => {
        if (finished || current !== socket) return;
        summary.errors += 1;
        finish("socket_error");
      });
      current.addEventListener("close", () => {
        if (finished || current !== socket) return;
        timers.clearInterval(heartbeat);
        heartbeat = null;
        scheduleReconnect();
      });
    };

    if (signal?.aborted) { finish("aborted"); return; }
    signal?.addEventListener("abort", abort, { once: true });
    deadline = timers.setTimeout(() => finish("duration"), durationMs);
    connect();
  });
}
