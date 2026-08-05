import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppCustomerRoutes from "../features/app/AppCustomerRoutes.jsx";

const AppAdminRoutes = lazy(() => import("../features/app/AppAdminRoutes.jsx"));
const KitchenPage = lazy(() => import("../features/kitchen/KitchenPage.jsx"));
const DownloadPage = lazy(() => import("../pages/DownloadPage.jsx"));
const BanhKemBanhTrangPage = lazy(() => import("../pages/BanhKemBanhTrangPage.jsx"));
const QrCodeToolPage = lazy(() => import("../pages/QrCodeToolPage.jsx"));
const SupervisionRoute = lazy(() => import("../features/supervision/SupervisionRoute.jsx"));

function RouteLoadingFallback() {
  return (
    <main
      aria-live="polite"
      aria-label="Đang mở trang"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fff7ec",
        color: "#3d2414",
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        fontWeight: 700,
        textAlign: "center"
      }}
    >
      Đang mở trang…
    </main>
  );
}

export default function AppRoutes({ adminAppProps, customerRouteProps }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
      <Route path="/review-rewards" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId/menu" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId/checkout" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId/orders" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId/loyalty" element={<AppCustomerRoutes {...customerRouteProps} />} />
      <Route path="/qr/:branchId/account" element={<AppCustomerRoutes {...customerRouteProps} />} />

      <Route path="/kitchen" element={<KitchenPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/pos" element={<Navigate to="/download" replace />} />
      <Route path="/qrcode" element={<QrCodeToolPage />} />
      <Route path="/banhkembanhtrang" element={<BanhKemBanhTrangPage branches={adminAppProps?.branches || []} />} />
      <Route path="/giamsat" element={<SupervisionRoute />} />
      <Route path="/checklist" element={<Navigate to="/giamsat" replace />} />
      <Route path="/chesklist" element={<Navigate to="/giamsat" replace />} />
      <Route path="/supervision" element={<Navigate to="/giamsat" replace />} />

      <Route path="/admin" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/grab-finance" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/menu" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/orders" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/partner-reviews" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/review-rewards" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/shifts" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/employees" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/supervision" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/customers" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/loyalty" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/accounts" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/zalo" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/downloads" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/settings/shipping" element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/ui" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/promotions" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />
      <Route path="/admin/cakes" element={<AppAdminRoutes adminAppProps={adminAppProps} />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
