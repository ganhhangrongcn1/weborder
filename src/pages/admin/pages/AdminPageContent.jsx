import AdminDashboardPage from "./AdminDashboardPage.jsx";
import AdminOrdersPage from "./AdminOrdersPage.jsx";
import AdminCustomersPage from "./AdminCustomersPage.jsx";
import AdminMenuPage from "./AdminMenuPage.jsx";
import AdminStorePage from "./AdminStorePage.jsx";
import AdminPromoPage from "./AdminPromoPage.jsx";
import AdminCakesPage from "./AdminCakesPage.jsx";
import AdminShiftOverviewPage from "./AdminShiftOverviewPage.jsx";
import AdminEmployeesPage from "./AdminEmployeesPage.jsx";
import AdminSupervisionPage from "./AdminSupervisionPage.jsx";
import AdminPartnerReviewsPage from "./AdminPartnerReviewsPage.jsx";
import AdminReviewRewardsPage from "./AdminReviewRewardsPage.jsx";
import AdminGrabFinancePage from "./AdminGrabFinancePage.jsx";
import { lazy, Suspense } from "react";
import AdminGrabMarketingPage from "./AdminGrabMarketingPage.jsx";

const InventoryWorkspace = lazy(() => import("../inventory/InventoryWorkspace.jsx"));

function InventoryLoadingState() {
  return <div className="inventory-state inventory-state--loading" role="status">Đang mở Quản lý kho…</div>;
}

export default function AdminPageContent({ section, ...props }) {
  if (section === "dashboard") {
    return <AdminDashboardPage {...props} />;
  }

  if (section === "grab-finance") {
    return <AdminGrabFinancePage {...props} />;
  }
  if (section === "grab-marketing") return <AdminGrabMarketingPage {...props} />;

  if (section === "orders") {
    return <AdminOrdersPage {...props} />;
  }

  if (section === "shifts") {
    return <AdminShiftOverviewPage {...props} />;
  }

  if (section === "employees") {
    return <AdminEmployeesPage {...props} />;
  }

  if (section === "supervision") {
    return <AdminSupervisionPage {...props} />;
  }

  if (section === "partner-reviews") {
    return <AdminPartnerReviewsPage {...props} />;
  }

  if (section === "review-rewards") {
    return <AdminReviewRewardsPage {...props} />;
  }

  if (section === "customers") {
    return <AdminCustomersPage {...props} />;
  }

  if (section === "cakes") {
    return <AdminCakesPage {...props} />;
  }

  if (section === "menu") {
    return <AdminMenuPage {...props} />;
  }

  if (section === "inventory") {
    return (
      <Suspense fallback={<InventoryLoadingState />}>
        <InventoryWorkspace {...props} />
      </Suspense>
    );
  }

  if (section === "store") {
    return <AdminStorePage {...props} />;
  }

  if (section === "promo") {
    return <AdminPromoPage {...props} />;
  }

  return null;
}
