import { useLocation } from "react-router-dom";
import { adminPathToState } from "../../app/routeState.js";
import AdminApp from "../../pages/admin/AdminApp.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AppAdminRoutes({
  adminAppProps
}) {
  const location = useLocation();
  const routeState = adminPathToState(location.pathname);
  return /*#__PURE__*/_jsx(AdminApp, {
    ...adminAppProps,
    routeState: routeState
  });
}