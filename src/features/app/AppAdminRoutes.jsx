import { useLocation } from "react-router-dom";
import { adminPathToState } from "../../app/routeState.js";
import AdminApp from "../../pages/admin/AdminApp.jsx";
import AdminAuthBoundary from "../../pages/admin/auth/AdminAuthBoundary.jsx";

export default function AppAdminRoutes({ adminAppProps }) {
  const location = useLocation();
  const routeState = adminPathToState(location.pathname);

  return (
    <AdminAuthBoundary>
      {(adminAuth) => (
        <AdminApp
          {...adminAppProps}
          routeState={routeState}
          adminAuth={adminAuth}
        />
      )}
    </AdminAuthBoundary>
  );
}
