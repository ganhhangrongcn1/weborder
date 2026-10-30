// One in-flight delivery. First signal is sent immediately; arrivals while busy
// remain pending. Cloud ack means the bounded batch is durably queued.
export function createSignalDelivery({ send, onError = () => {}, delay = 250 }) {
  const pending = new Map();
  let running = false, timer, stopped = false, paused = false;
  let retryDelay = delay;
  const schedule = ms => {
    if (timer || stopped || paused) return;
    timer = setTimeout(() => { timer = undefined; void flush(); }, ms);
  };
  async function flush() {
    if (running || stopped || paused || !pending.size) return;
    running = true;
    const batch = [];
    for (const [key, signal] of pending) {
      const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
      const bounded = size(signal) > 6500 ? { ...signal, order_ids: [] } : signal;
      if (batch.length && size([...batch, bounded]) > 7000) break;
      batch.push(bounded);
      pending.delete(key);
    }
    let failed = false;
    try { await send(batch); retryDelay = delay; }
    catch {
      failed = true;
      retryDelay = Math.min(10000, retryDelay * 2);
      for (const signal of batch) merge(signal);
      onError();
    } finally {
      running = false;
      if (pending.size) schedule(failed ? retryDelay : delay);
    }
  }
  function merge(signal) {
    const key = `${signal.hub_id}:${signal.topic}`;
    const previous = pending.get(key);
    if (!previous) { pending.set(key, { ...signal, order_ids: [...signal.order_ids] }); return; }
    const ids = [...new Set([...previous.order_ids, ...signal.order_ids])];
    // An empty set means reconcile the whole HUB; never truncate and lose IDs.
    previous.order_ids = !previous.order_ids.length || !signal.order_ids.length || ids.length > 32 ? [] : ids;
  }
  return {
    push(signals) {
      if (stopped) return;
      for (const signal of signals) merge(signal);
      if (!running && !timer) void flush();
    },
    stop() { stopped = true; clearTimeout(timer); },
    setEnabled(enabled) {
      paused = !enabled;
      if (paused) { clearTimeout(timer); timer = undefined; }
      else void flush();
    },
    pendingCount: () => pending.size
  };
}
