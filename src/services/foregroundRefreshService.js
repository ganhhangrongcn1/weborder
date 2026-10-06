// Refresh read-only data while the page is visible and connected.
export default function startForegroundRefresh(refresh, {
  intervalMs = 60000,
  retryMs = 30000,
  windowTarget = typeof window === "undefined" ? null : window,
  documentTarget = typeof document === "undefined" ? null : document,
  now = Date.now
} = {}) {
  if (!windowTarget || !documentTarget) return () => {};

  let disposed = false;
  let inFlight = false;
  let attempted = false;
  let nextRefreshAt = 0;
  let timer = null;

  const isActive = () => documentTarget.visibilityState !== "hidden"
    && windowTarget.navigator?.onLine !== false;
  const clearTimer = () => {
    if (timer !== null) windowTarget.clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    clearTimer();
    if (disposed || inFlight || !isActive()) return;
    timer = windowTarget.setTimeout(run, Math.max(0, nextRefreshAt - now()));
  };
  async function run() {
    clearTimer();
    if (disposed || inFlight || !isActive()) return;
    if (now() < nextRefreshAt) {
      schedule();
      return;
    }
    inFlight = true;
    const force = attempted;
    attempted = true;
    let succeeded = false;
    try {
      succeeded = await refresh({ force }) !== false;
    } catch {
      // The caller owns the error UI; retry with a bounded delay.
    } finally {
      inFlight = false;
      nextRefreshAt = now() + (succeeded ? intervalMs : retryMs);
      schedule();
    }
  }
  const onResume = () => { void run(); };
  const onPause = () => { clearTimer(); };
  const onVisibility = () => {
    if (isActive()) onResume();
    else onPause();
  };

  windowTarget.addEventListener("focus", onResume);
  windowTarget.addEventListener("online", onResume);
  windowTarget.addEventListener("offline", onPause);
  documentTarget.addEventListener("visibilitychange", onVisibility);
  void run();

  return () => {
    disposed = true;
    clearTimer();
    windowTarget.removeEventListener("focus", onResume);
    windowTarget.removeEventListener("online", onResume);
    windowTarget.removeEventListener("offline", onPause);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
  };
}
