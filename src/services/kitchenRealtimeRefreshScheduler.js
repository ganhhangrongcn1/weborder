// Keep the earliest deadline: later events must never postpone a waiting order.
export default function createKitchenRealtimeRefreshScheduler(onRefresh, timers = globalThis) {
  let pending = null;
  let timer = null;
  let deadline = 0;
  const now = () => timers.now ? timers.now() : Date.now();
  const flush = () => {
    const next = pending;
    pending = null;
    timer = null;
    deadline = 0;
    if (next) onRefresh(next);
  };
  return {
    schedule({ sourceType = "", receivedAt = now(), item = false }) {
      pending = pending ? {
        sourceType: pending.sourceType === sourceType ? sourceType : "",
        receivedAt: Math.max(pending.receivedAt, receivedAt)
      } : { sourceType, receivedAt };
      const nextDeadline = now() + (item ? 750 : 250);
      if (timer !== null && deadline <= nextDeadline) return;
      if (timer !== null) timers.clearTimeout(timer);
      deadline = nextDeadline;
      timer = timers.setTimeout(flush, Math.max(0, deadline - now()));
    },
    cancel() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      pending = null;
      deadline = 0;
    }
  };
}
