import { Navigate, useLocation } from "react-router-dom";
import { adminPathToState } from "../../app/routeState.js";
import AdminApp from "../../pages/admin/AdminApp.jsx";
import AdminAuthBoundary from "../../pages/admin/auth/AdminAuthBoundary.jsx";
import AdminAppErrorBoundary from "../../pages/admin/auth/AdminAppErrorBoundary.jsx";

export default function AppAdminRoutes({ adminAppProps }) {
  const location = useLocation();
  const routeState = adminPathToState(location.pathname);

  if (routeState.inventoryRouteInvalid) {
    return <Navigate to="/admin/inventory/dashboard" replace />;
  }

  return (
    <AdminAuthBoundary>
      {(adminAuth) => (
        <AdminAppErrorBoundary>
          <AdminApp
            {...adminAppProps}
            routeState={routeState}
            adminAuth={adminAuth}
          />
        </AdminAppErrorBoundary>
      )}
    </AdminAuthBoundary>
  );
}
