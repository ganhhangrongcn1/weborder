import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CustomerAppShell from "./CustomerAppShell.jsx";

export default function AppCustomerRoutes(props) {
  const location = useLocation();
  const { syncRouteState } = props;

  useEffect(() => {
    syncRouteState?.(location.pathname);
  }, [location.pathname, syncRouteState]);

  return <CustomerAppShell {...props} />;
}
