import AppAdminRoutes from "./AppAdminRoutes.jsx";
import AppCustomerRoutes from "./AppCustomerRoutes.jsx";

export default function AppRouters({ isAdminRoute, adminAppProps, customerRouteProps }) {
  if (isAdminRoute) {
    return <AppAdminRoutes isAdminRoute={isAdminRoute} adminAppProps={adminAppProps} />;
  }
  return <AppCustomerRoutes {...customerRouteProps} />;
}
