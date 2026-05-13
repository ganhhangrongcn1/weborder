import AppAdminRoutes from "./AppAdminRoutes.js";
import AppCustomerRoutes from "./AppCustomerRoutes.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AppRouters({
  isAdminRoute,
  adminAppProps,
  customerRouteProps
}) {
  if (isAdminRoute) {
    return /*#__PURE__*/_jsx(AppAdminRoutes, {
      isAdminRoute: isAdminRoute,
      adminAppProps: adminAppProps
    });
  }
  return /*#__PURE__*/_jsx(AppCustomerRoutes, {
    ...customerRouteProps
  });
}