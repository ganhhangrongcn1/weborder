import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export default function usePosOfflineAutoSync({ enabled, sync }) {
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => {
      if (AppState.currentState !== "active") return;
      void syncRef.current({ silent: true, onlyWhenQueued: true });
    };
    run();
    const timer = globalThis.setInterval(run, 15000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      globalThis.clearInterval(timer);
      subscription.remove();
    };
  }, [enabled]);
}
