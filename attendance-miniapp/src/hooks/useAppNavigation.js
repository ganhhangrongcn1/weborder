import { useEffect, useRef, useState } from "react";
import { parseDestination, destinationHash } from "../services/navigationService.js";

export default function useAppNavigation() {
  const [route, setRoute] = useState(() => parseDestination(window.location.hash));
  const depth = useRef(1);
  const initialized = useRef(false);
  useEffect(() => {
    const marker = (level) => ({ ...window.history.state, attendanceNavigation: true, depth: level });
    if (!initialized.current) {
      initialized.current = true;
      const initial = parseDestination(window.location.hash);
      const hash = destinationHash(initial.page, initial.branch);
      window.history.replaceState(marker(0), "", hash);
      window.history.pushState(marker(1), "", hash);
    }
    const sync = () => {
      const next = parseDestination(window.location.hash);
      const level = window.history.state?.attendanceNavigation ? window.history.state.depth : 1;
      if (level === 0) {
        window.history.pushState(marker(1), "", destinationHash(next.page, next.branch));
        depth.current = 1;
      } else {
        depth.current = level;
        if (!window.history.state?.attendanceNavigation) window.history.replaceState(marker(level), "", destinationHash(next.page, next.branch));
      }
      setRoute(next);
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);
  const navigate = (page, branch = "") => {
    const next = destinationHash(page, branch);
    if (next === destinationHash(route.page, route.branch)) return;
    depth.current++;
    window.history.pushState({ attendanceNavigation: true, depth: depth.current }, "", next);
    setRoute({ page, branch });
  };
  const back = () => { if (depth.current > 1) window.history.back(); };
  return { ...route, navigate, back };
}
