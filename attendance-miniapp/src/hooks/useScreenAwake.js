import { useEffect, useState } from "react";

// Demo uses the browser API when available, never calls the Zalo keepScreen API.
export default function useScreenAwake(enabled) {
  const [status, setStatus] = useState("off");
  useEffect(() => {
    let current = true; let lock; let sequence = 0;
    const release = () => { lock?.release().catch(() => {}); lock = null; };
    const sync = async () => {
      const request = ++sequence;
      release();
      if (!enabled || document.visibilityState !== "visible") { if (current) setStatus("off"); return; }
      if (!navigator.wakeLock) { if (current) setStatus("demo"); return; }
      try {
        const next = await navigator.wakeLock.request("screen");
        if (!current || request !== sequence || document.visibilityState !== "visible") { await next.release(); return; }
        lock = next; setStatus("on");
      } catch { if (current) setStatus("demo"); }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", release);
    return () => { current = false; release(); document.removeEventListener("visibilitychange", sync); window.removeEventListener("pagehide", release); };
  }, [enabled]);
  return status;
}
