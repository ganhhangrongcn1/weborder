import { useCallback, useEffect, useState } from "react";
import { isRunningAsInstalledApp } from "../services/pwaInstallService.js";

const dismissedThisSessionKey = "ghr_pwa_install_dismissed_session";

export default function usePwaInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => isRunningAsInstalledApp());
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(dismissedThisSessionKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const updateDisplayMode = () => setIsStandalone(isRunningAsInstalledApp());
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");

    standaloneQuery?.addEventListener?.("change", updateDisplayMode);
    window.addEventListener("appinstalled", updateDisplayMode);

    return () => {
      standaloneQuery?.removeEventListener?.("change", updateDisplayMode);
      window.removeEventListener("appinstalled", updateDisplayMode);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      window.sessionStorage.setItem(dismissedThisSessionKey, "1");
    } catch {
    }
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    await installPromptEvent.userChoice.catch(() => null);
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  return {
    canShowInstallPrompt: Boolean(installPromptEvent) && !isStandalone && !isDismissed,
    dismissInstallPrompt,
    requestInstall
  };
}
