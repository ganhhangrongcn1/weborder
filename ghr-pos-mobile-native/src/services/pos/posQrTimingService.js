export function createPosQrTiming() {
  const started = Date.now();
  let previous = started;
  const stages = {};
  return {
    mark(name) {
      const now = Date.now();
      stages[name] = Math.max(0, now - previous);
      previous = now;
    },
    finish(ok) {
      // Counts only; never log a customer, cart, token or bank account.
      console.info("[pos-qr-flow]", { ...stages, ok, total_ms: Math.max(0, Date.now() - started) });
    }
  };
}
