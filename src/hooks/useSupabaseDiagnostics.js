import { useEffect, useState } from "react";
import { getSupabaseDiagnostics } from "../services/supabase/supabaseDiagnostics.js";

export default function useSupabaseDiagnostics() {
  const [snapshot, setSnapshot] = useState(() => getSupabaseDiagnostics());
  useEffect(() => {
    let timer;
    const update = () => {
      clearInterval(timer);
      if (document.hidden) return;
      setSnapshot(getSupabaseDiagnostics());
      timer = setInterval(() => setSnapshot(getSupabaseDiagnostics()), 10000);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return snapshot;
}
