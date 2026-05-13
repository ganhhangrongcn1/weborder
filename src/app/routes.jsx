import { Navigate, Route, Routes } from "react-router-dom";
import AppAdminRoutes from "../features/app/AppAdminRoutes.jsx";
import AppCustomerRoutes from "../features/app/AppCustomerRoutes.jsx";

export default function AppRoutes({ adminAppProps, customerRouteProps }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

      <Route path="/home" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/menu" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/cart" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/checkout" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/success" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/profile" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/orders" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/loyalty" element={<AppCustomerRoutes {...customerRouteProps} />} />

      <Route path="/admin" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/menu" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/orders" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/customers" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/loyalty" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/zalo" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/shipping" element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/ui" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/promotions" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
