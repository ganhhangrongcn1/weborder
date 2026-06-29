import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordSiteVisit } from "../services/siteVisitTrackingService.js";

export default function useSiteVisitTracking() {
  const location = useLocation();

  useEffect(() => {
    let disposed = false;

    recordSiteVisit({
      pathname: location.pathname,
      search: location.search
    }).catch((error) => {
      if (disposed) return;
      console.warn("[site-visit-tracking] failed to record visit", error);
    });

    return () => {
      disposed = true;
    };
  }, [location.pathname, location.search]);
}
