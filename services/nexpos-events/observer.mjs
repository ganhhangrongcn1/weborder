import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { readMetadata, SOCKET_URL, TOPICS } from '../../supabase/functions/nexpos-event-observer/policy.mjs';
import { readSignal } from '../../supabase/functions/nexpos-event-observer/signals.mjs';
import { createSignalDelivery } from './signalDelivery.mjs';

const endpoint = process.env.GHR_OBSERVER_URL;
if (!endpoint || new URL(endpoint).origin !== 'https://qjaklysckgzdfjthzkzu.supabase.co') {
  throw new Error('invalid_observer_endpoint');
}
const token = (await readFile(process.env.GHR_OBSERVER_TOKEN_FILE || '/etc/ghr-nexpos-observer/worker-token', 'utf8')).trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('invalid_worker_token');
const state = {
  connected: false, opens: 0, closes: 0, messages: 0, rejected: 0, events: {},
  started_at: new Date().toISOString(), last_event_at: null, last_message_at: null,
  delivery_mode: 'metadata', worker_version: 'order-id-v1'
};
let stopping = false;
let socket;
let immediateMode = false;
let backoff = 3000;
const abort = new AbortController();
async function call(body) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-worker-token': token },
    body: JSON.stringify(body), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)])
  });
  if (!response.ok) throw new Error(`observer_http_${response.status}`);
  return response.json();
}
const delivery = createSignalDelivery({
  send: async signals => {
    const result = await call({ action: 'events', signals });
    if (!result.ok) throw new Error('signal_not_queued');
  },
  onError: () => console.log('signal_delivery_retry')
});
async function connect(config) {
  await new Promise(resolve => {
    socket = new WebSocket(SOCKET_URL);
    const sessionStarted = Date.now();
    const connecting = setTimeout(() => socket.close(), 15_000);
    let lastReceived = Date.now();
    const heartbeat = setInterval(() => {
      if (Date.now() - lastReceived > 90_000 || Date.now() - sessionStarted > 10 * 60_000) socket.close();
      else if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(connecting);
      clearInterval(heartbeat);
      state.connected = false;
      state.closes++;
      if (Date.now() - sessionStarted > 60_000) backoff = 3000;
      resolve();
    };
    socket.addEventListener('open', () => {
      clearTimeout(connecting);
      socket.send(JSON.stringify({ access_token: config.access_token, topic: TOPICS.join(', ') }));
      state.connected = true;
      state.opens++;
      if (immediateMode) delivery.push(config.hub_ids.map(hub_id => ({
        hub_id, topic: 'reconnect', order_ids: [], received_at: new Date().toISOString()
      })));
      console.log('socket_open observe');
    });
    socket.addEventListener('message', event => {
      lastReceived = Date.now();
      state.messages++;
      state.last_message_at = new Date().toISOString();
      const metadata = readMetadata(event.data, config.hub_ids);
      if (!metadata) { state.rejected++; return; }
      state.last_event_at = new Date().toISOString();
      if (immediateMode) {
        const signals = readSignal(event.data, config.hub_ids, state.last_event_at);
        if (signals) delivery.push(signals);
      }
      for (const hub of metadata.hubs) {
        state.events[hub] ||= {};
        state.events[hub][metadata.topic] = (state.events[hub][metadata.topic] || 0) + 1;
      }
      console.log('scoped_event', metadata.topic);
    });
    socket.addEventListener('close', finish);
    socket.addEventListener('error', () => { socket.close(); finish(); });
  });
}
async function reports() {
  while (!stopping) {
    try {
      const result = await call({ action: 'report', report: state });
      // Stop an obsolete scope immediately; a fresh bootstrap enforces changes.
      if (JSON.stringify([...result.hub_ids].sort()) !== JSON.stringify([...activeHubs].sort())) socket?.close();
      if (Boolean(result.id_sync_enabled) !== immediateMode) socket?.close();
    } catch {
      // Fail closed when enrollment is revoked or cloud authorization is unavailable.
      socket?.close();
      if (!stopping) console.log('report_unavailable');
    }
    await sleep(30_000, undefined, { signal: abort.signal }).catch(() => {});
  }
}
let activeHubs = [];
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  stopping = true;
  abort.abort();
  delivery.stop();
  socket?.close();
});
const reporting = reports();
while (!stopping) {
  try {
    const config = await call({ action: 'bootstrap' });
    if (config.mode !== 'observe' || !Array.isArray(config.hub_ids) || !config.hub_ids.length) throw new Error('invalid_scope');
    activeHubs = config.hub_ids;
    immediateMode = config.id_sync_enabled === true;
    delivery.setEnabled(immediateMode);
    state.delivery_mode = immediateMode ? 'immediate-v1' : 'metadata';
    await connect(config);
  } catch { if (!stopping) console.log('connection_unavailable'); }
  if (!stopping) await sleep(backoff + Math.random() * 1000, undefined, { signal: abort.signal }).catch(() => {});
  backoff = Math.min(60_000, backoff * 2);
}
await reporting;
