import { useLocation } from "react-router-dom";
import { adminPathToState } from "../../app/routeState.js";
import AdminApp from "../../pages/admin/AdminApp.jsx";

export default function AppAdminRoutes({ adminAppProps }) {
  const location = useLocation();
  const routeState = adminPathToState(location.pathname);

  return <AdminApp {...adminAppProps} routeState={routeState} />;
}
