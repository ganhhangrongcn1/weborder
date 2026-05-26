export function isRunningAsInstalledApp() {
  if (typeof window === "undefined") return false;

  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const fullscreenMedia = window.matchMedia?.("(display-mode: fullscreen)")?.matches;
  const iosStandalone = window.navigator?.standalone === true;

  return Boolean(standaloneMedia || fullscreenMedia || iosStandalone);
}

export function canRegisterServiceWorker() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in window.navigator &&
    import.meta.env.PROD &&
    import.meta.env.VITE_APK_BUNDLE !== "true"
  );
}

export function registerPwaServiceWorker() {
  if (!canRegisterServiceWorker()) return;

  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
