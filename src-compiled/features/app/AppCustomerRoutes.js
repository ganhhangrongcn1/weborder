import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CustomerAppShell from "./CustomerAppShell.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AppCustomerRoutes(props) {
  const location = useLocation();
  const {
    syncRouteState
  } = props;
  useEffect(() => {
    syncRouteState?.(location.pathname);
  }, [location.pathname, syncRouteState]);
  return /*#__PURE__*/_jsx(CustomerAppShell, {
    ...props
  });
}