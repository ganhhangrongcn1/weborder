// Serialize reads and retain a single merged refresh while a read is running.
export default function createKitchenRefreshQueue() {
  let running = false;
  let pending = null;
  let generation = 0;
  let scope = null;

  const invalidate = () => {
    generation += 1;
    scope = null;
    pending?.waiters.forEach(({ resolve }) => resolve());
    pending = null;
  };

  const drain = async () => {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const next = pending;
        pending = null;
        try {
          await next.execute(next.request, () => next.generation === generation);
          next.waiters.forEach(({ resolve }) => resolve());
        } catch (error) {
          next.waiters.forEach(({ reject }) => reject(error));
        }
      }
    } finally {
      running = false;
    }
  };

  const request = (nextRequest, execute) => {
    if (scope !== nextRequest.scope) {
      invalidate();
      scope = nextRequest.scope;
    }
    return new Promise((resolve, reject) => {
      if (pending) {
        pending.request = {
          ...nextRequest,
          silent: pending.request.silent && nextRequest.silent,
          sourceType: pending.request.sourceType === nextRequest.sourceType
            ? nextRequest.sourceType : ""
        };
        pending.execute = execute;
        pending.waiters.push({ resolve, reject });
      } else {
        pending = { request: nextRequest, execute, generation, waiters: [{ resolve, reject }] };
      }
      void drain();
    });
  };

  return { request, invalidate };
}
